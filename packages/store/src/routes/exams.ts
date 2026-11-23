import type { FastifyInstance } from '../http/types';
import { z } from 'zod';
import type {
  ExamExercise,
  ExamLevelSummary,
  ExamPaper,
  ExamResultResponse,
  ExamsResponse,
} from '@ciaocorea/shared';
import {
  EXAM_LEVELS,
  EXAM_MIN_EXERCISES,
  EXAM_SIZE,
  EXAM_THRESHOLD,
  examPassed,
  examReadiness,
  findExamLevel,
  gradeAttempt,
  sameLevel,
  selectExamQuestions,
  stripExercise,
  type ChallengeSource,
  type ExamLevelFacts,
} from '@ciaocorea/engine';
import { courseLessons, getCourses } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { todayIso } from '../db/client';
import { getProgress, recordChallenge } from '../repo/progress';
import { getLevelExam, recordLevelExam } from '../repo/exams';

const attemptSchema = z.object({
  answers: z
    .array(
      z.object({
        exerciseId: z.string().min(1).max(80),
        response: z.string().max(500),
      }),
    )
    .max(40),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

export interface ExamPool {
  sources: ChallengeSource[];
  facts: Map<string, ExamLevelFacts>;
}

/**
 * Tutte le domande possibili per livello: solo lezioni chiuse, come la sfida.
 * L’esame non anticipa niente; cambia solo il numero di domande e il fatto che
 * qui conta il risultato.
 */
export function examPool(ctx: Ctx, userId: string): ExamPool {
  const facts = new Map<string, ExamLevelFacts>();
  for (const level of EXAM_LEVELS) {
    facts.set(level.id, { totalLessons: 0, closedLessons: 0, availableExercises: 0 });
  }

  const sources: ChallengeSource[] = [];

  for (const course of getCourses()) {
    const level = EXAM_LEVELS.find((entry) => sameLevel(course.level, entry.id));
    if (!level) continue;

    const stats = facts.get(level.id)!;
    const states = new Map(
      getProgress(ctx.db, userId, course.slug).map((row) => [row.lesson_id, row.state]),
    );

    for (const lesson of courseLessons(course)) {
      stats.totalLessons += 1;
      const state = states.get(lesson.id);
      if (state !== 'passed' && state !== 'skipped') continue;

      stats.closedLessons += 1;
      stats.availableExercises += lesson.exercises.length;

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

  return { sources, facts };
}

function levelSummary(
  ctx: Ctx,
  userId: string,
  id: string,
  facts: ExamLevelFacts,
): ExamLevelSummary | null {
  const info = findExamLevel(id);
  if (!info) return null;

  const readiness = examReadiness(facts);
  const stored = getLevelExam(ctx.db, userId, info.id);
  return {
    id: info.id,
    label: info.label,
    title: info.title,
    description: info.description,
    totalLessons: readiness.totalLessons,
    closedLessons: readiness.closedLessons,
    requiredLessons: readiness.requiredLessons,
    missingLessons: readiness.missingLessons,
    availableExercises: readiness.availableExercises,
    questionCount: Math.min(EXAM_SIZE, readiness.availableExercises),
    unlocked: readiness.unlocked,
    bestScore: stored?.best_score ?? null,
    attempts: stored?.attempts ?? 0,
    passed: Boolean(stored?.passed_at),
    passedAt: stored?.passed_at ?? null,
  };
}

function toExamExercise(source: ChallengeSource): ExamExercise {
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

/** Il seme cambia a ogni consegna, non a ogni pagina: ricaricare non cambia la prova. */
function examSeed(userId: string, level: string, day: string, attempts: number): string {
  return `${userId}:${level}:${day}:${attempts}`;
}

export async function registerExamRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.get('/api/exams', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const pool = examPool(ctx, user.id);
    const levels = EXAM_LEVELS.map((level) =>
      levelSummary(ctx, user.id, level.id, pool.facts.get(level.id)!),
    ).filter((level): level is ExamLevelSummary => level !== null);

    const body: ExamsResponse = { levels, threshold: EXAM_THRESHOLD, day: todayIso() };
    return reply.send(body);
  });

  app.get('/api/exams/:level', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const levelId = String((request.params as Record<string, string>).level ?? '');
    const info = findExamLevel(levelId);
    if (!info) {
      return reply.code(404).send({ error: 'unknown_level', message: 'Questo traguardo non esiste.' });
    }

    const pool = examPool(ctx, user.id);
    const summary = levelSummary(ctx, user.id, info.id, pool.facts.get(info.id)!);
    if (!summary) {
      return reply.code(404).send({ error: 'unknown_level', message: 'Questo traguardo non esiste.' });
    }

    if (!summary.unlocked) {
      return reply.code(409).send({
        error: 'exam_locked',
        message: `Il traguardo si apre quando hai chiuso ${summary.requiredLessons} lezioni del livello.`,
      });
    }

    const day = todayIso();
    const seed = examSeed(user.id, info.id, day, summary.attempts);
    const picked = selectExamQuestions(pool.sources, info.id, seed);

    if (picked.length < EXAM_MIN_EXERCISES) {
      return reply.code(409).send({
        error: 'exam_locked',
        message: 'Le lezioni chiuse offrono ancora troppe poche domande: continua il percorso.',
      });
    }

    const body: ExamPaper = {
      level: { ...summary, questionCount: picked.length },
      exercises: picked.map(toExamExercise),
      threshold: EXAM_THRESHOLD,
      day,
    };
    return reply.send(body);
  });

  app.post('/api/exams/:level', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const levelId = String((request.params as Record<string, string>).level ?? '');
    const info = findExamLevel(levelId);
    if (!info) {
      return reply.code(404).send({ error: 'unknown_level', message: 'Questo traguardo non esiste.' });
    }

    const parsed = attemptSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Esame non valido.' });
    }

    const pool = examPool(ctx, user.id);
    const summary = levelSummary(ctx, user.id, info.id, pool.facts.get(info.id)!);
    if (!summary || !summary.unlocked) {
      return reply.code(409).send({
        error: 'exam_locked',
        message: 'Il traguardo non è ancora aperto.',
      });
    }

    const day = todayIso();
    const seed = examSeed(user.id, info.id, day, summary.attempts);
    const picked = selectExamQuestions(pool.sources, info.id, seed);
    if (picked.length < EXAM_MIN_EXERCISES) {
      return reply.code(409).send({
        error: 'exam_locked',
        message: 'Le lezioni chiuse offrono ancora troppe poche domande: continua il percorso.',
      });
    }

    const attempt = gradeAttempt(
      picked.map((source) => source.exercise),
      parsed.data.answers,
    );
    const passed = examPassed(attempt.score);

    const wrong = recordChallenge(
      ctx.db,
      user.id,
      attempt.results.map((result, index) => ({
        result,
        courseSlug: picked[index]!.courseSlug,
        lessonId: picked[index]!.lessonId,
      })),
    );

    const outcome = recordLevelExam(ctx.db, user.id, info.id, attempt.score, passed);
    const updated = levelSummary(ctx, user.id, info.id, examPool(ctx, user.id).facts.get(info.id)!)!;

    const body: ExamResultResponse = {
      level: { ...updated, questionCount: picked.length },
      score: attempt.score,
      correct: attempt.correct,
      total: attempt.total,
      threshold: EXAM_THRESHOLD,
      passed,
      firstPass: outcome.firstPass,
      results: attempt.results,
      wrong,
    };
    return reply.send(body);
  });
}
