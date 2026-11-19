import { z } from 'zod';
import type { SessionUser } from '@ciaocorea/shared';
import type { Ctx } from '../http/context';
import type { FastifyInstance, FastifyReply } from '../http/types';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { SESSION_COOKIE, createSession } from '../auth/sessions';
import { findUserById, toSessionUser } from '../repo/users';
import {
  TransferError,
  encodeCompact,
  exportBundle,
  mergeBundle,
  parseBundle,
  type ImportOutcome,
  type ImportStrategy,
  type TransferBundle,
} from '../transfer';

const strategySchema = z.enum(['merge', 'replace']);

/**
 * Portare un profilo su un altro dispositivo, senza un server in mezzo.
 *
 * Le rotte sono tre e fanno tre cose diverse: dire cosa c'è da esportare,
 * dire cosa cambierebbe un file prima di applicarlo, applicarlo. L'anteprima
 * esegue il merge vero e poi torna indietro: non è una stima, è il conto.
 */
export async function registerSyncRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  app.get('/api/sync/export', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const scope = (request.query as { scope?: string }).scope === 'all' ? 'all' : 'profile';

    const bundle = exportBundle(ctx.db, scope === 'all' ? undefined : [user.id]);
    return reply.send({ bundle });
  });

  /**
   * Il codice veloce: lezioni, ripassi e giorni di studio in una riga. È il
   * fratello corto del file, e serve al passaggio da telefono a computer senza
   * cavo. Cronologia e quaderno restano fuori: quelli viaggiano col file.
   */
  app.get('/api/sync/code', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const compact = await encodeCompact(ctx.db, user.id);
    return reply.send(compact);
  });

  app.post('/api/sync/preview', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const body = request.body as { bundle?: unknown } | null;

    let bundle: TransferBundle;
    try {
      bundle = parseBundle(body?.bundle);
    } catch (error) {
      if (error instanceof TransferError) {
        return reply.code(400).send({ error: 'invalid_bundle', message: error.message });
      }
      throw error;
    }

    // `merge` e non `replace`: l'anteprima deve raccontare cosa guadagna il
    // profilo, non quanto perderebbe. Chi sceglie di sostituire lo vede scritto
    // prima di premere il pulsante.
    const outcome = mergeBundle(ctx.db, bundle, 'merge', false);
    const activeProfile = outcome.profiles.find((profile) => profile.userId === user.id) ?? null;

    return reply.send({
      exportedAt: bundle.exportedAt,
      schema: bundle.schema,
      profiles: bundle.profiles.map((profile) => ({
        id: profile.user.id,
        username: profile.user.username,
        createdAt: profile.user.createdAt,
        isMe: profile.user.id === user.id,
      })),
      outcome,
      activeProfile,
    });
  });

  app.post('/api/sync/import', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const body = request.body as { bundle?: unknown; strategy?: unknown } | null;

    const strategy = strategySchema.safeParse(body?.strategy ?? 'merge');
    if (!strategy.success) {
      return reply.code(400).send({
        error: 'invalid_strategy',
        message: 'Modo di importazione non riconosciuto.',
      });
    }

    let bundle: TransferBundle;
    try {
      bundle = parseBundle(body?.bundle);
    } catch (error) {
      if (error instanceof TransferError) {
        return reply.code(400).send({ error: 'invalid_bundle', message: error.message });
      }
      throw error;
    }

    let outcome: ImportOutcome;
    try {
      outcome = mergeBundle(ctx.db, bundle, strategy.data as ImportStrategy, true);
    } catch (error) {
      if (error instanceof TransferError) {
        return reply.code(400).send({ error: 'invalid_bundle', message: error.message });
      }
      throw error;
    }

    // Un solo profilo nel file significa "ho portato me stesso qui": lo si apre
    // subito, così il dispositivo nuovo è pronto a studiare senza un giro in più.
    const single = outcome.profiles.length === 1 ? outcome.profiles[0] : undefined;
    let importedUser: SessionUser | null = null;
    if (single) {
      const row = findUserById(ctx.db, single.userId);
      if (row) {
        setSessionCookie(reply, createSession(ctx.db, row.id, ctx.config.sessionDays).token);
        importedUser = toSessionUser(row);
      }
    }

    return reply.send({ user: importedUser ?? user, outcome });
  });
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, { path: '/' });
}
