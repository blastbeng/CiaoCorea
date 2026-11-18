import { z } from 'zod';
import type { LoginResponse } from '@ciaocorea/shared';
import type { Ctx } from '../http/context';
import type { FastifyInstance, FastifyReply, FastifyRequest } from '../http/types';
import { hashPassword, simulateVerify, verifyPassword } from '../auth/password';
import { createRateLimiter } from '../auth/rateLimit';
import { SESSION_COOKIE, createSession, destroyOtherSessions, destroySession } from '../auth/sessions';
import {
  createUser,
  findUserByEmail,
  findUserById,
  listLocalAccounts,
  toSessionUser,
  updatePasswordHash,
} from '../repo/users';
import { currentUser, readCookie, requireAuth, type AuthedRequest } from '../auth/guard';
import type { AccountsResponse } from '../types';

const loginSchema = z.object({
  email: z.string().trim().min(2).max(200),
  password: z.string().min(1).max(200),
});

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  email: z.string().trim().min(3).max(200),
  password: z.string().min(8).max(200),
});

const passwordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8).max(200),
});

/**
 * Il nome con cui si entra non deve per forza essere un'email: qui non c'è un
 * servizio pubblico da proteggere, c'è un profilo su un computer. Resta però un
 * identificatore unico e senza spazi, perché è quello che compare nella
 * schermata di scelta dell'utente.
 */
const ACCOUNT_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^[a-z0-9._-]{2,40}$/;

export function setSessionCookie(
  ctx: Ctx,
  reply: FastifyReply,
  token: string,
  _expiresAt: string,
): void {
  // Nel browser non c'è un header da scrivere: il cookie resta il nome del
  // canale, e il client lo traduce nel token che tiene in localStorage.
  reply.setCookie(SESSION_COOKIE, token, { path: '/' });
}

export function clearSessionCookie(_ctx: Ctx, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/**
 * Accesso, iscrizione e cambio utente di un portale che vive nella scheda.
 *
 * Non c'è un invito da consumare e non c'è una modalità di registrazione da
 * rispettare: creare un account è una decisione locale, e la schermata di
 * accesso deve solo permettere di riprendere un profilo esistente o aprirne
 * uno nuovo. La password serve a non confondere due studenti sullo stesso
 * computer, non a difendere un server che qui non esiste.
 */
export async function registerAuthRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const limiter = createRateLimiter(ctx.config.loginMaxAttempts, ctx.config.loginWindowMs);

  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Nome e password sono obbligatori.' });
    }

    const email = parsed.data.email.toLowerCase();
    const limit = limiter.hit(`login:${email}`);
    if (!limit.allowed) {
      return reply
        .code(429)
        .header('retry-after', String(limit.retryAfterSeconds))
        .send({
          error: 'rate_limited',
          message: `Troppi tentativi. Riprova fra ${Math.ceil(limit.retryAfterSeconds / 60)} minuti.`,
        });
    }

    const user = findUserByEmail(ctx.db, email);
    if (!user) {
      await simulateVerify();
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'Nome o password non corretti.' });
    }

    const valid = await verifyPassword(parsed.data.password, user.password_hash);
    if (!valid) {
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'Nome o password non corretti.' });
    }

    limiter.reset(`login:${email}`);

    const session = createSession(ctx.db, user.id, ctx.config.sessionDays, request.headers['user-agent']);
    setSessionCookie(ctx, reply, session.token, session.expiresAt);

    const body: LoginResponse = { user: toSessionUser(user) };
    return reply.send(body);
  });

  /**
   * Creare un account e basta: nessun codice, nessuna email da confermare.
   * Chi si iscrive è già dentro, perché la prima cosa da fare dopo aver scelto
   * un nome è cominciare la prima lezione, non controllare una casella.
   */
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: 'Controlla i dati: nome (2 caratteri) e password di almeno 8 caratteri.',
      });
    }

    const limit = limiter.hit('register');
    if (!limit.allowed) {
      return reply
        .code(429)
        .header('retry-after', String(limit.retryAfterSeconds))
        .send({
          error: 'rate_limited',
          message: `Troppi tentativi. Riprova fra ${Math.ceil(limit.retryAfterSeconds / 60)} minuti.`,
        });
    }

    const email = parsed.data.email.toLowerCase();
    if (!ACCOUNT_SHAPE.test(email)) {
      return reply.code(400).send({
        error: 'invalid_email',
        message: 'Usa un nome semplice (lettere, numeri, punto, trattino) oppure un’email.',
      });
    }

    if (findUserByEmail(ctx.db, email)) {
      return reply.code(409).send({
        error: 'email_taken',
        message: 'Questo nome è già usato su questo computer: scegline un altro o accedi.',
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    ctx.db.exec('BEGIN');
    try {
      const row = createUser(ctx.db, {
        email,
        displayName: parsed.data.displayName,
        passwordHash,
      });
      ctx.db.exec('COMMIT');

      const session = createSession(ctx.db, row.id, ctx.config.sessionDays, request.headers['user-agent']);
      setSessionCookie(ctx, reply, session.token, session.expiresAt);

      return reply.code(201).send({ user: toSessionUser(row) });
    } catch (error) {
      ctx.db.exec('ROLLBACK');
      request.log.error(error);
      return reply
        .code(400)
        .send({ error: 'registration_failed', message: 'Non è stato possibile creare l’account.' });
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) destroySession(ctx.db, token);
    clearSessionCookie(ctx, reply);
    return reply.send({ ok: true });
  });

  app.post(
    '/api/auth/password',
    { preHandler: requireAuth(ctx) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user, sessionToken } = request as AuthedRequest;

      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          message: 'La nuova password deve avere almeno 8 caratteri.',
        });
      }

      const limit = limiter.hit(`pwd:${user.id}`);
      if (!limit.allowed) {
        return reply
          .code(429)
          .header('retry-after', String(limit.retryAfterSeconds))
          .send({
            error: 'rate_limited',
            message: `Troppi tentativi. Riprova fra ${Math.ceil(limit.retryAfterSeconds / 60)} minuti.`,
          });
      }

      const row = findUserById(ctx.db, user.id);
      if (!row) {
        return reply.code(404).send({ error: 'not_found', message: 'Utente inesistente.' });
      }

      const valid = await verifyPassword(parsed.data.current, row.password_hash);
      if (!valid) {
        return reply
          .code(401)
          .send({ error: 'wrong_password', message: 'La password attuale non è corretta.' });
      }

      limiter.reset(`pwd:${user.id}`);

      updatePasswordHash(ctx.db, user.id, await hashPassword(parsed.data.next));
      const closed = destroyOtherSessions(ctx.db, user.id, sessionToken);

      return reply.send({ ok: true, sessionsClosed: closed });
    },
  );

  app.get('/api/auth/me', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    return reply.send({ user });
  });

  // Rotta di comodo per il client: capire se c'è una sessione senza 401.
  app.get('/api/auth/session', async (request, reply) => {
    const user = currentUser(ctx, request);
    return reply.send({ user });
  });

  /**
   * I profili di questo browser: chi ha già studiato qui e se ha una sessione
   * ancora aperta. È l'elenco che rende possibile "continua come Mina" senza
   * riscrivere il nome a ogni cambio.
   */
  app.get('/api/auth/accounts', async (request, reply) => {
    const current = currentUser(ctx, request);
    const body: AccountsResponse = {
      currentUserId: current?.id ?? null,
      accounts: listLocalAccounts(ctx.db).map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        hasSession: Number(row.live_sessions) > 0,
      })),
    };
    return reply.send(body);
  });
}
