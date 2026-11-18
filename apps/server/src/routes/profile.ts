import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ProfileResponse } from '@ciaocorea/shared';
import {
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
  buildCourseView,
  summarize,
} from '@ciaocorea/engine';
import { getCourses, getDialogues, getVocabulary } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { listDialogueProgress } from '../repo/dialogues';
import {
  activityDays,
  getProgress,
  lifetimeTotals,
  srsStats,
  streakDays,
} from '../repo/progress';
import { findUserById, getWeeklyGoal, setWeeklyGoal } from '../repo/users';
import { countMistakes } from '../repo/mistakes';

/**
 * La pagina dei progressi: una sola lettura che mette insieme corsi, ripassi,
 * dialoghi e abitudine quotidiana. Tutto si ricava da ciò che lo studente ha
 * già fatto, quindi qui non c'è nulla da aggiornare: si legge e basta.
 */
export async function registerProfileRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.get('/api/profile', { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request as AuthedRequest;
    const db = ctx.db;

    const views = getCourses().map((course) =>
      buildCourseView({ course, progress: getProgress(db, user.id, course.slug) }),
    );
    const summary = summarize(views, streakDays(db, user.id), countMistakes(db, user.id));

    const totals = lifetimeTotals(db, user.id);
    const srs = srsStats(db, user.id);

    const dialogues = listDialogueProgress(db, user.id);
    const dialogueList = [...dialogues.values()];
    const curriculum = getVocabulary();

    // "Viste" = voci del dizionario per le quali esiste una card: le parole dei
    // dialoghi non sono nel dizionario, quindi non si contano qui.
    const cardKeys = new Set(
      (
        db
          .prepare('SELECT DISTINCT course_slug, front FROM srs_cards WHERE user_id = ?')
          .all(user.id) as unknown as Array<{ course_slug: string; front: string }>
      ).map((row) => `${row.course_slug}\u0000${row.front}`),
    );
    const seen = curriculum.filter((entry) => cardKeys.has(`${entry.courseSlug}\u0000${entry.ko}`)).length;

    const created = findUserById(db, user.id)?.created_at ?? new Date().toISOString();

    const body: ProfileResponse = {
      user,
      memberSince: created,
      summary,
      totals: {
        attempts: totals.attempts,
        exercises: totals.exercises,
        correct: totals.correct,
        accuracy: totals.exercises === 0 ? 0 : Math.round((totals.correct / totals.exercises) * 100),
      },
      courses: views.map((course) => ({
        slug: course.slug,
        title: course.title,
        level: course.level,
        stats: course.stats,
      })),
      srs,
      activity: activityDays(db, user.id, 30),
      dialogues: {
        total: getDialogues().length,
        completed: dialogueList.filter((row) => row.completedAt !== null).length,
        answered: dialogueList.reduce((sum, row) => sum + row.answered, 0),
        correct: dialogueList.reduce((sum, row) => sum + row.correct, 0),
      },
      vocabulary: { seen, total: curriculum.length },
      weeklyGoal: getWeeklyGoal(db, user.id),
    };

    return reply.send(body);
  });

  /* -------------------------------------------------------------------- *
   * L'obiettivo della settimana lo sceglie lo studente. Un numero troppo
   * facile da alzare non serve a niente, e uno troppo alto si abbandona:
   * per questo sta fra 1 e 7 giorni, e non viene mai imposto dal server.
   * -------------------------------------------------------------------- */
  const goalSchema = z.object({
    goal: z.number().int().min(WEEKLY_GOAL_MIN).max(WEEKLY_GOAL_MAX),
  });

  app.post('/api/profile/goal', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const parsed = goalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_goal',
        message: `L’obiettivo deve essere un numero fra ${WEEKLY_GOAL_MIN} e ${WEEKLY_GOAL_MAX} giorni.`,
      });
    }

    return reply.send({ weeklyGoal: setWeeklyGoal(ctx.db, user.id, parsed.data.goal) });
  });
}
