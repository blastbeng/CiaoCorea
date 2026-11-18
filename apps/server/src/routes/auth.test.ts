import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { getCourse } from '@ciaocorea/curriculum';
import type { CourseListResponse, SessionUser } from '@ciaocorea/shared';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDb, type Db } from '../db/client';
import { ensureSeedUser } from '../seed/bootstrap';
import { createInvite, revokeInvite } from '../repo/invites';
import { isInviteCodeShape, normalizeInviteCode } from '../auth/codes';

const SEED_EMAIL = 'seed@example.test';
const SEED_PASSWORD = 'laprimalezione';

interface Server {
  app: FastifyInstance;
  db: Db;
}

const open: Server[] = [];

/**
 * Server su database temporaneo, con la modalità di registrazione scelta di
 * volta in volta: è l'unico modo di provare i tre comportamenti (chiusa, con
 * codice, aperta) senza toccare l'ambiente del test d'integrazione.
 */
async function makeServer(registration: Record<string, string> = {}): Promise<Server> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciaocorea-reg-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: tmpDir,
    WEB_DIST: path.join(tmpDir, 'web-dist-assente'),
    ...registration,
  });
  const db = openDb(config.databaseFile);
  await ensureSeedUser(db, {
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    displayName: 'Seed',
  });
  const app = await buildApp({ db, config });
  const server: Server = { app, db };
  open.push(server);
  return server;
}

async function register(
  app: FastifyInstance,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: { error?: string; user?: SessionUser }; cookie: string }> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload });
  return {
    status: response.statusCode,
    body: response.json() as { error?: string; user?: SessionUser },
    cookie: response.cookies[0] ? `cc_session=${response.cookies[0].value}` : '',
  };
}

afterEach(async () => {
  while (open.length > 0) {
    const server = open.pop()!;
    await server.app.close();
    server.db.close();
  }
});

describe('codici di invito', () => {
  it('normalizza le forme e riconosce la forma di un codice generato', () => {
    expect(normalizeInviteCode('  ab cd-efgh jklm  ')).toBe('ABCDEFGHJKLM');
    expect(isInviteCodeShape('ABCD-EFGH-JKLM')).toBe(true);
    // Dodici simboli senza I, O, 0, 1: un codice scritto a mano si riconosce.
    expect(isInviteCodeShape('codice della maestra')).toBe(false);
    expect(isInviteCodeShape('ABCDEFGHJKLM')).toBe(true);
  });
});

describe('registrazione chiusa', () => {
  it('rifiuta ogni iscrizione e lo dice alla pagina di accesso', async () => {
    const { app } = await makeServer();
    const info = await app.inject({ method: 'GET', url: '/api/auth/registration' });
    expect(info.json()).toMatchObject({ mode: 'closed', closed: true, needsCode: false });

    const result = await register(app, {
      displayName: 'Anna',
      email: 'anna@example.test',
      password: 'sopralatavola',
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toBe('registration_closed');
  });
});

describe('registrazione con codice', () => {
  it('vuole il codice, apre la sessione e consuma il posto', async () => {
    const { app, db } = await makeServer({ REGISTRATION_MODE: 'invite' });
    const invite = createInvite(db, { label: 'corso A' });

    const senza = await register(app, {
      displayName: 'Anna',
      email: 'anna@example.test',
      password: 'sopralatavola',
    });
    expect(senza.status).toBe(400);
    expect(senza.body.error).toBe('code_required');

    const dentro = await register(app, {
      displayName: 'Anna',
      email: 'anna@example.test',
      password: 'sopralatavola',
      code: invite.code.toLowerCase().replace(/-/g, ''),
    });
    expect(dentro.status).toBe(201);
    expect(dentro.body.user).toMatchObject({ email: 'anna@example.test', displayName: 'Anna' });
    expect(dentro.cookie.startsWith('cc_session=')).toBe(true);

    // Il codice è scritto in modi diversi e conta lo stesso; in database non
    // c'è in chiaro, quindi qui lo si ritrova solo per via dell'hash.
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: dentro.cookie } });
    expect(me.statusCode).toBe(200);

    const secondo = await register(app, {
      displayName: 'Anna Seconda',
      email: 'anna2@example.test',
      password: 'sopralatavola',
      code: invite.code,
    });
    expect(secondo.status).toBe(403);
    expect(secondo.body.error).toBe('invalid_code');
  });

  it('un codice con due posti apre due account e poi finisce', async () => {
    const { app, db } = await makeServer({ REGISTRATION_MODE: 'invite' });
    const invite = createInvite(db, { label: 'corso B', maxUses: 2 });

    for (const email of ['uno@example.test', 'due@example.test']) {
      const result = await register(app, {
        displayName: email.split('@')[0],
        email,
        password: 'sopralatavola',
        code: invite.code,
      });
      expect(result.status).toBe(201);
    }

    const terzo = await register(app, {
      displayName: 'Tre',
      email: 'tre@example.test',
      password: 'sopralatavola',
      code: invite.code,
    });
    expect(terzo.status).toBe(403);
  });

  it('un codice revocato non apre più nulla', async () => {
    const { app, db } = await makeServer({ REGISTRATION_MODE: 'invite' });
    const invite = createInvite(db, { label: 'da ritirate' });
    expect(revokeInvite(db, invite.id)).toBe(1);

    const result = await register(app, {
      displayName: 'Anna',
      email: 'anna@example.test',
      password: 'sopralatavola',
      code: invite.code,
    });
    expect(result.status).toBe(403);
  });

  it('il codice madre apre più account senza consumarsi', async () => {
    const { app } = await makeServer({
      REGISTRATION_MODE: 'invite',
      REGISTRATION_CODE: 'CORSo-A2-2026',
    });

    for (const email of ['a@example.test', 'b@example.test']) {
      const result = await register(app, {
        displayName: 'Allievo',
        email,
        password: 'sopralatavola',
        code: 'corso a2 2026',
      });
      expect(result.status).toBe(201);
    }
  });

  it('non lascia due account con la stessa email', async () => {
    const { app } = await makeServer({ REGISTRATION_MODE: 'open' });
    const first = await register(app, {
      displayName: 'Anna',
      email: 'anna@example.test',
      password: 'sopralatavola',
    });
    expect(first.status).toBe(201);

    const second = await register(app, {
      displayName: 'Anna bis',
      email: 'ANNA@example.test ',
      password: 'sopralatavola',
    });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('email_taken');
  });

  it('rifiuta i dati malformati', async () => {
    const { app } = await makeServer({ REGISTRATION_MODE: 'open' });

    const emailCorta = await register(app, {
      displayName: 'Anna',
      email: 'non-sono-unemail',
      password: 'sopralatavola',
    });
    expect(emailCorta.status).toBe(400);
    expect(emailCorta.body.error).toBe('invalid_email');

    const passwordCorta = await register(app, {
      displayName: 'Anna',
      email: 'anna@example.test',
      password: 'corta',
    });
    expect(passwordCorta.status).toBe(400);

    const nomeMancante = await register(app, {
      displayName: '',
      email: 'anna@example.test',
      password: 'sopralatavola',
    });
    expect(nomeMancante.status).toBe(400);
  });

  it('limita le iscrizioni dalla stessa macchina', async () => {
    const { app } = await makeServer({
      REGISTRATION_MODE: 'open',
      LOGIN_MAX_ATTEMPTS: '3',
    });

    let last = 0;
    for (let i = 0; i < 6; i += 1) {
      const result = await register(app, {
        displayName: `Allievo ${i}`,
        email: `allievo${i}@example.test`,
        password: 'sopralatavola',
      });
      last = result.status;
    }
    expect(last).toBe(429);
  });

  it('ognuno comincia da zero: i progressi non si mescolano', async () => {
    const { app } = await makeServer({ REGISTRATION_MODE: 'open' });

    // Il seed chiude la prima lezione del primo corso.
    const seedLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: SEED_EMAIL, password: SEED_PASSWORD },
    });
    const seedCookie = `cc_session=${seedLogin.cookies[0]?.value}`;
    const lesson = getCourse('hangul')!.units[0]!.lessons[0]!;
    await app.inject({
      method: 'POST',
      url: `/api/courses/hangul/lessons/${lesson.id}/attempts`,
      headers: { cookie: seedCookie },
      payload: {
        mode: 'lesson',
        durationMs: 60000,
        answers: lesson.exercises.map((exercise) => ({
          exerciseId: exercise.id,
          response: (exercise as { answer: string }).answer,
        })),
      },
    });

    const newcomer = await register(app, {
      displayName: 'Nuovo',
      email: 'nuovo@example.test',
      password: 'sopralatavola',
    });
    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: newcomer.cookie },
    });
    expect(dashboard.statusCode).toBe(200);

    const payload = dashboard.json() as CourseListResponse;
    const hangul = payload.courses.find((course) => course.slug === 'hangul');
    expect(hangul?.stats.passed).toBe(0);
    expect(hangul?.units[0]?.lessons[0]?.state).toBe('available');
    expect(payload.summary.lessonsPassed).toBe(0);
  });
});
