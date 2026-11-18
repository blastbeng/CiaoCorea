import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { VocabularyResponse } from '@ciaocorea/shared';
import { getVocabulary } from '@ciaocorea/curriculum';
import { searchVocabulary, vocabFacets } from '@ciaocorea/engine';
import type { Ctx } from '../http/context';
import { requireAuth } from '../auth/guard';

/**
 * Il dizionario è il curricolo reso consultabile: non ci sono voci inserite a
 * mano, quindi quello che lo studente cerca è esattamente ciò che ha già
 * incontrato (o che incontrerà) nelle lezioni.
 */
const querySchema = z.object({
  q: z.string().max(80).optional().default(''),
  course: z.string().max(60).optional().default(''),
  limit: z.coerce.number().int().min(1).max(200).optional().default(60),
  offset: z.coerce.number().int().min(0).max(5000).optional().default(0),
});

export async function registerVocabularyRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.get(
    '/api/vocabulary',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_query', message: 'Parametri di ricerca non validi.' });
      }

      const { q, course, limit, offset } = parsed.data;
      const entries = getVocabulary();

      // I contaggi per corso si calcolano sulla ricerca senza filtro di corso:
      // le etichette dei filtri devono dire quante risposte dà ogni corso con
      // la ricerca in corso, altrimenti il filtro sembra svuotarsi a caso.
      const unscoped = searchVocabulary(entries, { query: q, limit: 5000 });

      const searched = searchVocabulary(entries, {
        query: q,
        courseSlug: course,
        limit,
        offset,
      });

      const body: VocabularyResponse = {
        entries: searched.entries,
        total: searched.total,
        curriculum: entries.length,
        courses: vocabFacets(unscoped.entries),
        query: q,
      };
      return reply.send(body);
    },
  );
}
