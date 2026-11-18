import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { LoginResponse } from '@ciaocorea/shared';
import type { Ctx } from '../http/context';
import { hashPassword, simulateVerify, verifyPassword } from '../auth/password';
import { createRateLimiter } from '../auth/rateLimit';
import { SESSION_COOKIE, createSession, destroyOtherSessions, destroySession } from '../auth/sessions';
import { normalizeInviteCode } from '../auth/codes';
import { consumeInvite, findUsableInvite } from '../repo/invites';
import { createUser, findUserByEmail, findUserById, toSessionUser, updatePasswordHash } from '../repo/users';
import { currentUser, readCookie, requireAuth, type AuthedRequest } from '../auth/guard';

const loginSchema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  email: z.string().trim().min(5).max(200),
  password: z.string().min(8).max(200),
  code: z.string().trim().max(64).optional(),
});

/**
 * Un'email vera, non un nome: la registrazione pubblica arriva da sconosciuti,
 * e un identificatore unico e scritto bene è l'unica cosa che tiene distinti
 * gli account. Il seed resta cosa è (un nome utente), perché non si registra.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8).max(200),
});

export function setSessionCookie(
  ctx: Ctx,
  reply: FastifyReply,
  token: string,
  expiresAt: string,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.config.cookieSecure,
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(ctx: Ctx, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.config.cookieSecure,
  });
}

export async function registerAuthRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const limiter = createRateLimiter(ctx.config.loginMaxAttempts, ctx.config.loginWindowMs);

  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Email e password sono obbligatorie.' });
    }

    const email = parsed.data.email.toLowerCase();
    const key = `${request.ip}:${email}`;
    const limit = limiter.hit(key);
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
      // Stesso lavoro crittografico di un login vero: niente indizi sull'esistenza
      // dell'account.
      await simulateVerify();
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Email o password non corretti.' });
    }

    const valid = await verifyPassword(parsed.data.password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Email o password non corretti.' });
    }

    // Login riuscito: il contatore riparte, così un errore di battitura non
    // pesa sui tentativi successivi.
    limiter.reset(key);

    const session = createSession(ctx.db, user.id, ctx.config.sessionDays, request.headers['user-agent']);
    setSessionCookie(ctx, reply, session.token, session.expiresAt);

    const body: LoginResponse = { user: toSessionUser(user) };
    return reply.send(body);
  });

  /**
   * Come è aperta la registrazione, detto dal server: la pagina di accesso non
   * deve indovinare se mostrare il modulo, e un frontend che indovina è un
   * frontend che promette un'iscrizione il server non permetterà.
   */
  app.get('/api/auth/registration', async (_request, reply) => {
    return reply.send({
      mode: ctx.config.registrationMode,
      closed: ctx.config.registrationMode === 'closed',
      needsCode: ctx.config.registrationMode === 'invite',
    });
  });

  /**
   * Iscrizione. Il codice (modo `invite`) non è una difesa dagli attacchi: è
   * il modo per tenere il portale riservato agli studenti invitati, e per
   * sapere a quale gruppo appartiene un account. La password non è richiesta
   * due volte: chi si iscrive la vede una sola volta, e il cambio password è
   * nella pagina dei progressi.
   */
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    if (ctx.config.registrationMode === 'closed') {
      return reply.code(403).send({
        error: 'registration_closed',
        message: 'Le iscrizioni sono chiuse: chiedi un accesso a chi gestisce il corso.',
      });
    }

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: 'Controlla i dati: nome (2 caratteri), email valida e password di almeno 8 caratteri.',
      });
    }

    // Lo stesso contatore del login: una registrazione aperta senza limite è
    // un modo per popolare il database di account a raffica.
    const key = `reg:${request.ip}`;
    const limit = limiter.hit(key);
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
    if (!EMAIL_SHAPE.test(email)) {
      return reply.code(400).send({
        error: 'invalid_email',
        message: 'L’email non è in un formato valido.',
      });
    }

    if (findUserByEmail(ctx.db, email)) {
      return reply.code(409).send({
        error: 'email_taken',
        message: 'Questa email è già registrata: prova ad accedere.',
      });
    }

    let inviteId: string | null = null;
    if (ctx.config.registrationMode === 'invite') {
      const code = parsed.data.code ? normalizeInviteCode(parsed.data.code) : '';
      if (!code) {
        return reply.code(400).send({
          error: 'code_required',
          message: 'Serve il codice di invito che hai ricevuto.',
        });
      }

      // Il codice madre (dai secrets) non sta in database: è quello che si usa
      // quando di inviti non ne sono ancora stati creati.
      if (ctx.config.registrationCode && code === ctx.config.registrationCode) {
        inviteId = null;
      } else {
        const invite = findUsableInvite(ctx.db, code);
        if (!invite) {
          return reply.code(403).send({
            error: 'invalid_code',
            message: 'Il codice non è valido: è già stato usato tutto, è scaduto o è stato revocato.',
          });
        }
        inviteId = invite.id;
      }
    }

    const passwordHash = await hashPassword(parsed.data.password);

    // Consumo dell'invito e creazione dell'account stanno nella stessa
    // transazione: un codice con un posto solo non deve aprire due account, e
    // un account non deve nascere con un codice rimasto disponibile.
    ctx.db.exec('BEGIN');
    try {
      if (inviteId && !consumeInvite(ctx.db, inviteId)) {
        ctx.db.exec('ROLLBACK');
        return reply.code(409).send({
          error: 'code_used',
          message: 'Il codice è appena terminato: chiedi un nuovo invito.',
        });
      }

      const row = createUser(ctx.db, {
        email,
        displayName: parsed.data.displayName,
        passwordHash,
      });
      ctx.db.exec('COMMIT');

      const session = createSession(ctx.db, row.id, ctx.config.sessionDays, request.headers['user-agent']);
      setSessionCookie(ctx, reply, session.token, session.expiresAt);

      // Qui il contatore NON si azzera, a differenza del login: un accesso
      // riuscito è uno studente che entra, una registrazione riuscita è un
      // account in più. Il limite serve proprio a quello.
      return reply.code(201).send({ user: toSessionUser(row) });
    } catch (error) {
      ctx.db.exec('ROLLBACK');
      request.log.error(error);
      return reply.code(400).send({ error: 'registration_failed', message: 'Registrazione non riuscita.' });
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) destroySession(ctx.db, token);
    clearSessionCookie(ctx, reply);
    return reply.send({ ok: true });
  });

  /**
   * Cambio password. Serve la password attuale, e il contatore è lo stesso del
   * login: senza quello, questa rotta diventerebbe un modo per provare
   * password offline al riparo dal rate limit.
   */
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

      const key = `pwd:${request.ip}:${user.id}`;
      const limit = limiter.hit(key);
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

      // Password giusta: il contatore riparte, come sul login.
      limiter.reset(key);

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
}
