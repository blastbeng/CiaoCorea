import { z } from 'zod';
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
  type ProfileUserResponse,
  type SessionUser,
} from '@ciaocorea/shared';
import type { Ctx } from '../http/context';
import type { FastifyInstance, FastifyReply, FastifyRequest } from '../http/types';
import { SESSION_COOKIE, createSession } from '../auth/sessions';
import {
  createUser,
  findUserById,
  listLocalAccounts,
  toSessionUser,
  updateDisplayName,
  updateUsername,
  usernameTaken,
} from '../repo/users';
import { randomUsername } from '../auth/usernames';
import { currentUser, requireAuth, type AuthedRequest } from '../auth/guard';
import type { AccountsResponse } from '../types';

const renameSchema = z.object({
  displayName: z.string().trim().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX),
});

const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN)
  .max(USERNAME_MAX)
  .regex(USERNAME_PATTERN);

function setSessionCookie(reply: FastifyReply, token: string): void {
  // Nel browser non c'è un header da scrivere: il cookie resta il nome del
  // canale, e il client lo traduce nel token che tiene in localStorage.
  reply.setCookie(SESSION_COOKIE, token, { path: '/' });
}

/** Profilo nuovo: nome generato, sessione aperta sulla reply data. */
function openProfile(ctx: Ctx, reply: FastifyReply): SessionUser {
  const username = randomUsername((name) => usernameTaken(ctx.db, name));

  ctx.db.exec('BEGIN');
  try {
    // Al primo avvio il nome con cui si è chiamati è quello che il portale ha
    // scelto per te: chi vuole, lo cambia nelle impostazioni.
    const row = createUser(ctx.db, { username, displayName: username });
    ctx.db.exec('COMMIT');

    const session = createSession(ctx.db, row.id, ctx.config.sessionDays);
    setSessionCookie(reply, session.token);
    return toSessionUser(row);
  } catch (error) {
    ctx.db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * I profili di un portale che vive nella scheda.
 *
 * Non c'è un account da creare, una password da ricordare, un'email da
 * confermare: il database è locale, quindi il primo avvio apre un profilo con
 * un nome generato e ci si entra dentro. Da lì in poi si studierà e basta, e
 * chi vuole più profili su questo computer ne aggiunge altri e ci passa con un
 * clic.
 */
export async function registerAuthRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  /**
   * L'ingresso: se c'è già un profilo aperto restituisce lui, altrimenti ne
   * apre uno nuovo. È la rotta che il client chiama quando apre il sito, ed è
   * l'unica che può creare un profilo senza che nessuno abbia chiesto niente.
   */
  app.post('/api/auth/bootstrap', async (request, reply) => {
    const existing = currentUser(ctx, request);
    if (existing) {
      const body: ProfileUserResponse = { user: existing };
      return reply.send(body);
    }

    const body: ProfileUserResponse = { user: openProfile(ctx, reply) };
    return reply.code(201).send(body);
  });

  /**
   * Un profilo in più su questo computer, e diventa subito quello aperto.
   * È "aggiungi studente" della sezione profili: due figli sullo stesso
   * tablet, il profilo di studio e quello personale.
   */
  app.post('/api/auth/profiles', async (request, reply) => {
    const body: ProfileUserResponse = { user: openProfile(ctx, reply) };
    return reply.code(201).send(body);
  });

  /** Il nome con cui lo studente vuole essere chiamato. */
  app.post(
    '/api/auth/rename',
    { preHandler: requireAuth(ctx) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;

      const parsed = renameSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          message: `Il nome deve avere da ${DISPLAY_NAME_MIN} a ${DISPLAY_NAME_MAX} caratteri.`,
        });
      }

      const row = findUserById(ctx.db, user.id);
      if (!row) {
        return reply.code(404).send({ error: 'not_found', message: 'Utente inesistente.' });
      }

      updateDisplayName(ctx.db, user.id, parsed.data.displayName);
      const body: ProfileUserResponse = {
        user: { ...toSessionUser(row), displayName: parsed.data.displayName },
      };
      return reply.send(body);
    },
  );

  /**
   * Il nome utente, quello con la chiocciola: al primo avvio è generato, e
   * questa rotta è la via per sostituirlo con un nome scelto. Resta unico su
   * questo computer, altrimenti due profili si chiamerebbero uguale nell'elenco
   * e non si capirebbe più chi è chi.
   */
  app.post(
    '/api/auth/username',
    { preHandler: requireAuth(ctx) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;

      const parsed = usernameSchema.safeParse((request.body as { username?: unknown }).username);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_username',
          message: `Il nome utente va da ${USERNAME_MIN} a ${USERNAME_MAX} caratteri: lettere, numeri, punto, trattino e underscore, senza spazi.`,
        });
      }

      const username = parsed.data;
      if (usernameTaken(ctx.db, username, user.id)) {
        return reply.code(409).send({
          error: 'username_taken',
          message: `Il nome utente «${username}» è già di un altro profilo di questo computer.`,
        });
      }

      const row = findUserById(ctx.db, user.id);
      if (!row) {
        return reply.code(404).send({ error: 'not_found', message: 'Utente inesistente.' });
      }

      // Se il nome con cui è chiamato è ancora quello generato, cambia con lui:
      // due nomi diversi per la stessa scelta confonderebbero, e in home
      // resterebbe scritto il nome anonimo appena sostituito.
      const stillGenerated = row.display_name === row.username;
      updateUsername(ctx.db, user.id, username);
      if (stillGenerated) updateDisplayName(ctx.db, user.id, username);

      const body: ProfileUserResponse = {
        user: {
          ...toSessionUser(row),
          username,
          usernameChosen: true,
          displayName: stillGenerated ? username : row.display_name,
        },
      };
      return reply.send(body);
    },
  );

  /**
   * Riaprire un profilo che ha perso il token: sessione scaduta dopo mesi, o
   * localStorage svuotato. I progressi sono nel database di questo browser, e
   * quello è tutta l'autorità che serve: non c'è una password da mostrare, e
   * nessuno che possa pretendere di verificare chi sei.
   */
  app.post('/api/auth/reactivate', async (request, reply) => {
    const parsed = z.object({ userId: z.string().min(8) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: 'Profilo da riaprire non indicato.',
      });
    }

    const row = findUserById(ctx.db, parsed.data.userId);
    if (!row) {
      return reply.code(404).send({ error: 'not_found', message: 'Profilo inesistente.' });
    }

    setSessionCookie(reply, createSession(ctx.db, row.id, ctx.config.sessionDays).token);
    const body: ProfileUserResponse = { user: toSessionUser(row) };
    return reply.send(body);
  });

  // Rotta di comodo per il client: capire se c'è una sessione senza 401.
  app.get('/api/auth/session', async (request, reply) => {
    const user = currentUser(ctx, request);
    return reply.send({ user });
  });

  /**
   * I profili di questo browser: chi ci studia sopra. Non è un elenco di
   * account remoti, è l'elenco delle persone sedute a questo computer, e la
   * schermata dei profili lo mostra tutto.
   */
  app.get('/api/auth/accounts', async (request, reply) => {
    const current = currentUser(ctx, request);
    const body: AccountsResponse = {
      currentUserId: current?.id ?? null,
      accounts: listLocalAccounts(ctx.db).map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        createdAt: row.created_at,
        hasSession: Number(row.live_sessions) > 0,
      })),
    };
    return reply.send(body);
  });
}
