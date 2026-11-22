import type { ReadingsResponse, ReadingRef } from '@ciaocorea/shared';
import type { Ctx } from '../http/context';
import type { FastifyInstance } from '../http/types';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { courseViews } from './lessons';

/**
 * La sala di lettura: tutti i brani del percorso in un elenco solo.
 *
 * Non è una scorciatoia per saltare le lezioni. Un brano si può leggere anche
 * prima di arrivarci (il coreano è lì, le parole si possono toccare una a
 * una), ma la traduzione segue la stessa regola della lezione: arriva solo
 * quando quella lezione è superata o saltata. Chi vuole capire da solo non
 * trova la risposta scritta accanto al testo.
 *
 * L'ordine è quello del percorso — corso per corso, unità per unità — perché
 * è l'ordine in cui i brani diventano leggibili, non un catalogo da sfogliare.
 */
export function readingsFor(ctx: Ctx, userId: string): ReadingsResponse {
  const readings: ReadingRef[] = [];
  const levels: Array<{ level: string; count: number }> = [];
  let withTranslation = 0;

  for (const course of courseViews(ctx, userId)) {
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        if (!lesson.passages || lesson.passages.length === 0) continue;
        const closed = lesson.state === 'passed' || lesson.state === 'skipped';

        lesson.passages.forEach((passage, index) => {
          if (closed) withTranslation += 1;
          readings.push({
            id: `${lesson.id}:${index}`,
            title: passage.title,
            level: course.level,
            course: { slug: course.slug, title: course.title },
            lesson: { id: lesson.id, title: lesson.title, state: lesson.state },
            lines: passage.lines,
            gloss: passage.gloss,
            translation: passage.translation,
          });

          const level = levels.find((entry) => entry.level === course.level);
          if (level) level.count += 1;
          else levels.push({ level: course.level, count: 1 });
        });
      }
    }
  }

  return { readings, levels, withTranslation };
}

export function registerReadingRoutes(app: FastifyInstance, ctx: Ctx): void {
  app.get('/api/readings', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    return reply.send(readingsFor(ctx, user.id));
  });
}
