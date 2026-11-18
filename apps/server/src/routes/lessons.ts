import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type {
  AttemptResponse,
  CourseListResponse,
  CourseSkipResponse,
  CourseSkipTest,
  CourseView,
  DueCountResponse,
  LessonDetail,
  LessonView,
  ProgressSummary,
  ReviewResponse,
} from '@ciaocorea/shared';
import {
  PASS_THRESHOLD,
  buildCourseView,
  buildDailyPlan,
  gradeAttempt,
  pickCourseSkipTest,
  pickSkipTest,
  stripExercises,
  summarize,
  weekStartIso,
  type ProgressRow,
} from '@ciaocorea/engine';
import { courseLessons, getCourse, getCourses } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import {
  countDueCards,
  dueCards,
  getProgress,
  gradeCard,
  recordAttempt,
  skipCourse,
  streakDays,
  studyDaysSince,
} from '../repo/progress';
import { getWeeklyGoal } from '../repo/users';
import { nextOpenDialogue } from '../repo/dialogues';
import { countMistakes } from '../repo/mistakes';

function progressMap(ctx: Ctx, userId: string, courseSlug: string): ProgressRow[] {
  return getProgress(ctx.db, userId, courseSlug);
}

function courseViews(ctx: Ctx, userId: string): CourseView[] {
  return getCourses().map((course) =>
    buildCourseView({ course, progress: progressMap(ctx, userId, course.slug) }),
  );
}

/**
 * La sintesi del percorso. Gli errori in banca si contano qui, non nel motore:
 * il motore non conosce il database, e la pagina deve poter dire quanti
 * esercizi aspettano senza una seconda richiesta.
 */
function summaryOf(ctx: Ctx, userId: string, views: CourseView[]): ProgressSummary {
  return summarize(views, streakDays(ctx.db, userId), countMistakes(ctx.db, userId));
}

/**
 * La traduzione di un brano si apre solo a lezione chiusa: mentre lo studente è
 * davanti al testo da solo, la traduzione non parte nemmeno dal server.
 */
function withPassagePolicy(view: LessonView): LessonView {
  if (!view.passages) return view;
  if (view.state === 'passed' || view.state === 'skipped') return view;

  return {
    ...view,
    passages: view.passages.map((passage) => ({ ...passage, translation: '' })),
  };
}

function findLessonView(views: readonly CourseView[], courseSlug: string, lessonId: string): LessonView | null {
  const course = views.find((item) => item.slug === courseSlug);
  if (!course) return null;
  for (const unit of course.units) {
    const lesson = unit.lessons.find((item) => item.id === lessonId || item.slug === lessonId);
    if (lesson) return lesson;
  }
  return null;
}

const attemptSchema = z.object({
  mode: z.enum(['lesson', 'skip']).default('lesson'),
  answers: z
    .array(
      z.object({
        exerciseId: z.string().min(1).max(80),
        response: z.string().max(500),
      }),
    )
    .max(60),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

/** Il test di salto del corso non ha una lezione: porta solo le risposte. */
const courseSkipSchema = z.object({
  answers: z
    .array(
      z.object({
        exerciseId: z.string().min(1).max(80),
        response: z.string().max(500),
      }),
    )
    .max(60),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

const reviewSchema = z.object({
  grade: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export async function registerLessonRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  const listCourses = async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request as AuthedRequest;
    const views = courseViews(ctx, user.id);
    const summary = summaryOf(ctx, user.id, views);
    const due = countDueCards(ctx.db, user.id);

    // Il piano si fa qui, con i dati che la dashboard già legge: la pagina non
    // deve calcolare nulla, e le due cose non possono divergere.
    const weekStart = weekStartIso();
    const plan = buildDailyPlan({
      summary,
      dueCards: due,
      weeklyGoal: getWeeklyGoal(ctx.db, user.id),
      studyDays: studyDaysSince(ctx.db, user.id, weekStart),
      dialogue: due === 0 ? nextOpenDialogue(ctx.db, user.id) : null,
      courses: views.map((course) => ({ slug: course.slug, title: course.title })),
    });

    const body: CourseListResponse = { courses: views, summary, dueCards: due, plan };
    return reply.send(body);
  };

  app.get('/api/courses', { preHandler: auth }, listCourses);

  // La dashboard usa lo stesso payload della lista corsi: una sola forma da
  // tenere allineata fra server e client.
  app.get('/api/dashboard', { preHandler: auth }, listCourses);

  app.get('/api/courses/:slug', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const { slug } = request.params as { slug: string };
    const views = courseViews(ctx, user.id);
    const course = views.find((item) => item.slug === slug || item.id === slug);
    if (!course) return reply.code(404).send({ error: 'not_found', message: 'Corso inesistente.' });
    return reply.send({ course });
  });

  app.get(
    '/api/courses/:slug/lessons/:lessonId',
    { preHandler: auth },
    async (request, reply) => {
      const { user } = request as AuthedRequest;
      const { slug, lessonId } = request.params as { slug: string; lessonId: string };

      const course = getCourse(slug);
      if (!course) return reply.code(404).send({ error: 'not_found', message: 'Corso inesistente.' });

      const lesson = courseLessons(course).find(
        (item) => item.id === lessonId || item.slug === lessonId,
      );
      if (!lesson) return reply.code(404).send({ error: 'not_found', message: 'Lezione inesistente.' });

      const views = courseViews(ctx, user.id);
      const view = findLessonView(views, course.slug, lesson.id);
      if (!view) return reply.code(404).send({ error: 'not_found', message: 'Lezione inesistente.' });

      if (view.state === 'locked') {
        return reply.code(403).send({
          error: 'lesson_locked',
          message: 'Questa lezione si apre dopo aver chiuso la precedente.',
        });
      }

      const unit = course.units.find((item) => item.lessons.some((l) => l.id === lesson.id));

      const body: LessonDetail = {
        course: { slug: course.slug, title: course.title },
        unit: { id: unit?.id ?? '', title: unit?.title ?? '' },
        lesson: withPassagePolicy(view),
        exercises: stripExercises(lesson.exercises),
        skipTest: stripExercises(pickSkipTest(lesson.exercises)),
      };
      return reply.send(body);
    },
  );

  app.post(
    '/api/courses/:slug/lessons/:lessonId/attempts',
    { preHandler: auth },
    async (request, reply) => {
      const { user } = request as AuthedRequest;
      const { slug, lessonId } = request.params as { slug: string; lessonId: string };

      const parsed = attemptSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', message: 'Tentativo non valido.' });
      }

      const course = getCourse(slug);
      if (!course) return reply.code(404).send({ error: 'not_found', message: 'Corso inesistente.' });

      const lesson = courseLessons(course).find(
        (item) => item.id === lessonId || item.slug === lessonId,
      );
      if (!lesson) return reply.code(404).send({ error: 'not_found', message: 'Lezione inesistente.' });

      const views = courseViews(ctx, user.id);
      const view = findLessonView(views, course.slug, lesson.id);
      if (!view || view.state === 'locked') {
        return reply.code(403).send({
          error: 'lesson_locked',
          message: 'Questa lezione non è ancora aperta.',
        });
      }

      // Il test di salto usa un sottoinsieme fisso: chi lo ripete affronta le
      // stesse domande, senza la lotteria di pescare solo quelle facili.
      const exercises =
        parsed.data.mode === 'skip' ? pickSkipTest(lesson.exercises) : lesson.exercises;

      const attempt = gradeAttempt(exercises, parsed.data.answers, {
        passedState: parsed.data.mode === 'skip' ? 'skipped' : 'passed',
        previousBest: view.bestScore,
      });

      recordAttempt(ctx.db, {
        userId: user.id,
        courseSlug: course.slug,
        lessonId: lesson.id,
        mode: parsed.data.mode,
        score: attempt.score,
        correct: attempt.correct,
        total: attempt.total,
        durationMs: parsed.data.durationMs ?? null,
        passed: attempt.passed,
        passedState: parsed.data.mode === 'skip' ? 'skipped' : 'passed',
        results: attempt.results,
        vocab: lesson.vocab,
      });

      const updatedViews = courseViews(ctx, user.id);
      const updatedCourse = updatedViews.find((item) => item.slug === course.slug) ?? views[0]!;

      const body: AttemptResponse = {
        attempt: { ...attempt, bestScore: Math.max(view.bestScore ?? 0, attempt.score) },
        course: updatedCourse,
        summary: summaryOf(ctx, user.id, updatedViews),
      };
      return reply.send(body);
    },
  );

  /* ---------------------------------------------------------------- *
   * Salto del corso: una prova sola, campionato da tutte le lezioni.
   * Le domande sono le stesse a ogni apertura della pagina, così non
   * si può ripetere il test sperando in una pesca più favorevole.
   * ---------------------------------------------------------------- */

  app.get('/api/courses/:slug/skip-test', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const { slug } = request.params as { slug: string };

    const course = getCourse(slug);
    if (!course) return reply.code(404).send({ error: 'not_found', message: 'Corso inesistente.' });

    const exercises = pickCourseSkipTest(courseLessons(course));
    if (exercises.length === 0) {
      return reply.code(409).send({
        error: 'course_not_skippable',
        message: 'Questo corso non ha esercizi da testare.',
      });
    }

    const view = courseViews(ctx, user.id).find((item) => item.slug === course.slug);
    if (!view) return reply.code(404).send({ error: 'not_found', message: 'Corso inesistente.' });

    const closed = view.stats.passed + view.stats.skipped;
    const body: CourseSkipTest = {
      course: { slug: course.slug, title: course.title, level: course.level },
      exercises: stripExercises(exercises),
      threshold: Math.round(PASS_THRESHOLD * 100),
      lessonsToClose: view.stats.lessons - closed,
      lessonsClosed: closed,
    };
    return reply.send(body);
  });

  app.post('/api/courses/:slug/skip', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const { slug } = request.params as { slug: string };

    const parsed = courseSkipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Prova non valida.' });
    }

    const course = getCourse(slug);
    if (!course) return reply.code(404).send({ error: 'not_found', message: 'Corso inesistente.' });

    const lessons = courseLessons(course);
    const exercises = pickCourseSkipTest(lessons);
    if (exercises.length === 0) {
      return reply.code(409).send({
        error: 'course_not_skippable',
        message: 'Questo corso non ha esercizi da testare.',
      });
    }

    const attempt = gradeAttempt(exercises, parsed.data.answers, { passedState: 'skipped' });

    // Il tentativo resta registrato anche quando la prova va male: i totali
    // devono dire quante prove sono state fatte.
    const outcome = skipCourse(ctx.db, {
      userId: user.id,
      courseSlug: course.slug,
      lessons: lessons.map((lesson) => ({ lessonId: lesson.id, vocab: lesson.vocab })),
      score: attempt.score,
      correct: attempt.correct,
      total: attempt.total,
      passed: attempt.passed,
    });

    const updatedViews = courseViews(ctx, user.id);
    const updatedCourse = updatedViews.find((item) => item.slug === course.slug) ?? updatedViews[0]!;

    const body: CourseSkipResponse = {
      attempt: { ...attempt, bestScore: attempt.score },
      course: updatedCourse,
      summary: summaryOf(ctx, user.id, updatedViews),
      lessonsSkipped: outcome.lessonsSkipped,
      reviewsCreated: outcome.reviewsCreated,
    };
    return reply.send(body);
  });

  app.get('/api/progress/summary', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const views = courseViews(ctx, user.id);
    return reply.send(summaryOf(ctx, user.id, views));
  });

  // Il badge della shell chiede solo il numero: la lista completa delle carte
  // si scarica quando lo studente apre i ripassi.
  app.get('/api/progress/due', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const body: DueCountResponse = {
      dueCards: countDueCards(ctx.db, user.id),
      mistakes: countMistakes(ctx.db, user.id),
    };
    return reply.send(body);
  });

  app.get('/api/review', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const body: ReviewResponse = {
      cards: dueCards(ctx.db, user.id),
      dueCards: countDueCards(ctx.db, user.id),
    };
    return reply.send(body);
  });

  app.post('/api/review/:cardId', { preHandler: auth }, async (request, reply) => {
    const { user } = request as AuthedRequest;
    const { cardId } = request.params as { cardId: string };
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Giudizio non valido.' });
    }

    const card = gradeCard(ctx.db, user.id, cardId, parsed.data.grade);
    if (!card) return reply.code(404).send({ error: 'not_found', message: 'Card inesistente.' });

    return reply.send({ card, dueCards: countDueCards(ctx.db, user.id) });
  });
}
