import type { FastifyInstance, FastifyReply, FastifyRequest } from '../http/types';
import { z } from 'zod';
import type {
  MistakeAnswerResponse,
  MistakeItem,
  MistakesResponse,
  MistakesStats,
} from '@ciaocorea/shared';
import { gradeExercise, stripExercise } from '@ciaocorea/engine';
import { findExercise } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { getMistake, listMistakes, recordMistakeAnswer } from '../repo/mistakes';

const answerSchema = z.object({
  response: z.string().max(500),
});

/**
 * La banca degli errori: gli esercizi che lo studente ha sbagliato, com'erano
 * nella lezione. Qui si rifanno uno alla volta e la correzione passa dalla
 * stessa funzione che corregge la lezione — non da una copia, che col tempo
 * correggerebbe in modo diverso.
 */
export async function registerMistakeRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  const build = (userId: string): MistakesResponse => {
    const items: MistakeItem[] = [];
    const lessons = new Set<string>();

    for (const row of listMistakes(ctx.db, userId)) {
      const found = findExercise(row.exercise_id);
      // Un esercizio tolto dal curricolo non si può più rimettere in pagina: si
      // salta e non conta, così il totale non promette qualcosa che non c'è.
      if (!found) continue;

      items.push({
        exercise: stripExercise(found.exercise),
        courseSlug: found.course.slug,
        courseTitle: found.course.title,
        lessonId: found.lesson.id,
        lessonTitle: found.lesson.title,
        wrongCount: row.wrong_count,
        lastWrongAt: row.last_wrong_at,
      });
      lessons.add(`${found.course.slug}:${found.lesson.id}`);
    }

    const stats: MistakesStats = { total: items.length, lessons: lessons.size };
    return { items, stats };
  };

  app.get(
    '/api/mistakes',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;
      return reply.send(build(user.id));
    },
  );

  app.post(
    '/api/mistakes/:exerciseId',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;
      const { exerciseId } = request.params as { exerciseId: string };

      const parsed = answerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', message: 'Risposta non valida.' });
      }

      const found = findExercise(exerciseId);
      if (!found || !getMistake(ctx.db, user.id, exerciseId)) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Questo esercizio non è nella tua banca.' });
      }

      const result = gradeExercise(found.exercise, parsed.data.response);
      const wrongCount = recordMistakeAnswer(ctx.db, user.id, found.exercise.id, result.correct);

      const body: MistakeAnswerResponse = { result, wrongCount, stats: build(user.id).stats };
      return reply.send(body);
    },
  );
}
