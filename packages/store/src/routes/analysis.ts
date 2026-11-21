import type { FastifyInstance, FastifyReply, FastifyRequest } from '../http/types';
import { z } from 'zod';
import type { TextAnalysisResponse } from '@ciaocorea/shared';
import { getVocabulary } from '@ciaocorea/curriculum';
import { analyzeText } from '@ciaocorea/engine';
import type { Ctx } from '../http/context';
import { requireAuth } from '../auth/guard';

/**
 * Il testo che lo studente incolla non viene salvato: si analizza e si butta.
 * Il limite serve solo a non far lavorare la scheda su un romanzo intero.
 */
const bodySchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function registerAnalysisRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.post(
    '/api/text/analyze',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_body', message: 'Incolla un testo da una a 4000 battute.' });
      }

      const body: TextAnalysisResponse = analyzeText(getVocabulary(), parsed.data.text);
      return reply.send(body);
    },
  );
}
