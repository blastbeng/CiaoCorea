import type { FastifyInstance } from '../http/types';
import { z } from 'zod';
import type {
  ChallengeExercise,
  ChallengeResponse,
  ChallengeResultResponse,
} from '@ciaocorea/shared';
import {
  gradeAttempt,
  pickChallenge,
  stripExercise,
  type ChallengeSource,
} from '@ciaocorea/engine';
import { courseLessons, getCourses } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { todayIso } from '../db/client';
import { getProgress, recordChallenge } from '../repo/progress';

/** La sfida è una manciata di domande: abbastanza per scaldarsi, non un esame. */
const CHALLENGE_SIZE = 12;
const PER_LESSON = 2;

const attemptSchema = z.object({
  answers: z
    .array(
      z.object({
        exerciseId: z.string().min(1).max(80),
        response: z.string().max(500),
      }),
    )
    .max(24),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

export interface ChallengePool {
  sources: ChallengeSource[];
  availableLessons: number;
}

/**
 * Le domande possibili: solo lezioni già chiuse, passate o saltate. La sfida
 * non anticipa mai un contenuto che lo studente non ha ancora incontrato; è
 * un ripasso misto, non un esame di livello.
 */
export function challengePool(ctx: Ctx, userId: string): ChallengePool {
  const sources: ChallengeSource[] = [];
  let availableLessons = 0;

  for (const course of getCourses()) {
    const states = new Map(
      getProgress(ctx.db, userId, course.slug).map((row) => [row.lesson_id, row.state]),
    );

    for (const lesson of courseLessons(course)) {
      const state = states.get(lesson.id);
      if (state !== 'passed' && state !== 'skipped') continue;
      if (lesson.exercises.length === 0) continue;

      availableLessons += 1;
      for (const exercise of lesson.exercises) {
        sources.push({
          exercise,
          courseSlug: course.slug,
          courseTitle: course.title,
          level: course.level,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
      }
    }
  }

  return { sources, availableLessons };
}

function toChallengeExercise(source: ChallengeSource): ChallengeExercise {
  return {
    ...stripExercise(source.exercise),
    course: {
      slug: source.courseSlug,
      title: source.courseTitle,
      level: source.level,
    },
    lesson: { id: source.lessonId, title: source.lessonTitle },
  };
}

export async function registerChallengeRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.get('/api/challenge', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const day = todayIso();
    const pool = challengePool(ctx, user.id);
    const picked = pickChallenge(pool.sources, {
      count: CHALLENGE_SIZE,
      perLesson: PER_LESSON,
      seed: `${user.id}:${day}`,
    });

    const body: ChallengeResponse = {
      exercises: picked.map(toChallengeExercise),
      availableLessons: pool.availableLessons,
      availableExercises: pool.sources.length,
      day,
    };
    return reply.send(body);
  });

  app.post('/api/challenge', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const parsed = attemptSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Sfida non valida.' });
    }

    const day = todayIso();
    const pool = challengePool(ctx, user.id);
    const picked = pickChallenge(pool.sources, {
      count: CHALLENGE_SIZE,
      perLesson: PER_LESSON,
      seed: `${user.id}:${day}`,
    });

    if (picked.length === 0) {
      return reply.code(409).send({
        error: 'challenge_locked',
        message: 'La sfida si apre dopo aver chiuso almeno una lezione.',
      });
    }

    const attempt = gradeAttempt(
      picked.map((source) => source.exercise),
      parsed.data.answers,
    );

    const wrong = recordChallenge(
      ctx.db,
      user.id,
      attempt.results.map((result, index) => ({
        result,
        courseSlug: picked[index]!.courseSlug,
        lessonId: picked[index]!.lessonId,
      })),
    );

    const body: ChallengeResultResponse = {
      score: attempt.score,
      correct: attempt.correct,
      total: attempt.total,
      results: attempt.results,
      wrong,
    };
    return reply.send(body);
  });
}
