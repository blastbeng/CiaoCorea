import type { SessionUser } from '@ciaocorea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Ctx } from '../http/context';
import { SESSION_COOKIE, resolveSession } from './sessions';

export interface AuthedRequest extends FastifyRequest {
  user: SessionUser;
  sessionToken: string;
}

export function readCookie(request: FastifyRequest, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if (rawKey?.trim() === name) {
      return decodeURIComponent(rest.join('=').trim());
    }
  }
  return null;
}

export function currentUser(ctx: Ctx, request: FastifyRequest): SessionUser | null {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return resolveSession(ctx.db, token, ctx.config.sessionDays)?.user ?? null;
}

/**
 * PreHandler delle rotte private. Risponde 401 con un corpo uniforme: il client
 * sa che deve mostrare il login, e nessun dettaglio interno esce.
 */
export function requireAuth(ctx: Ctx) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = readCookie(request, SESSION_COOKIE);
    const session = token ? resolveSession(ctx.db, token, ctx.config.sessionDays) : null;

    if (!session || !token) {
      return reply.code(401).send({ error: 'unauthenticated', message: 'Sessione scaduta o assente.' });
    }

    const authed = request as AuthedRequest;
    authed.user = session.user;
    authed.sessionToken = token;
    return undefined;
  };
}
