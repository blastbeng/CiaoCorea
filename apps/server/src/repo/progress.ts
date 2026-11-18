import { randomUUID } from 'node:crypto';
import type { ExerciseResult, LessonState, VocabItem } from '@ciaocorea/shared';
import type { ProgressRow } from '@ciaocorea/engine';
import { scheduleCard, type SrsGrade } from '@ciaocorea/engine';
import type { Db } from '../db/client';
import { nowIso, todayIso } from '../db/client';

interface ProgressDbRow {
  lesson_id: string;
  state: LessonState;
  best_score: number | null;
}

export function getProgress(db: Db, userId: string, courseSlug: string): ProgressRow[] {
  const rows = db
    .prepare(
      'SELECT lesson_id, state, best_score FROM lesson_progress WHERE user_id = ? AND course_slug = ?',
    )
    .all(userId, courseSlug) as unknown as ProgressDbRow[];

  return rows.map((row) => ({
    lesson_id: row.lesson_id,
    state: row.state,
    best_score: row.best_score,
  }));
}

export interface AttemptInput {
  userId: string;
  courseSlug: string;
  lessonId: string;
  mode: 'lesson' | 'skip';
  score: number;
  correct: number;
  total: number;
  durationMs: number | null;
  passed: boolean;
  passedState: 'passed' | 'skipped';
  results: ExerciseResult[];
  vocab: VocabItem[];
  now?: Date;
}

export interface AttemptOutcome {
  state: LessonState;
  bestScore: number;
  firstCompletion: boolean;
  reviewsCreated: number;
}

/**
 * La card del ripasso per una parola incontrata. `ON CONFLICT DO NOTHING`: la
 * stessa parola nella stessa lezione non deve creare due schede, e un ripasso
 * già avviato non va resettato da una nuova lezione.
 */
function insertReviewCard(
  db: Db,
  userId: string,
  courseSlug: string,
  lessonId: string,
  item: VocabItem,
  day: string,
  timestamp: string,
): number {
  const result = db
    .prepare(
      `INSERT INTO srs_cards(id, user_id, course_slug, lesson_id, item_id, front, back, hint,
                             ease, interval_days, reps, lapses, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2.5, 0, 0, 0, ?, ?, ?)
       ON CONFLICT(user_id, course_slug, item_id) DO NOTHING`,
    )
    .run(
      randomUUID(),
      userId,
      courseSlug,
      lessonId,
      `${lessonId}:${item.ko}`,
      item.ko,
      item.it,
      item.rr,
      day,
      timestamp,
      timestamp,
    );
  return Number(result.changes ?? 0);
}

/**
 * Un tentativo corretto aggiorna progresso, statistiche giornaliere e ripassi
 * in un'unica transazione: se qualcosa fallisce a metà, lo studente non deve
 * ritrovarsi con la lezione promossa ma senza le card da ripassare.
 */
export function recordAttempt(db: Db, input: AttemptInput): AttemptOutcome {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const day = todayIso(now);

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO attempts(id, user_id, course_slug, lesson_id, mode, score, correct, total,
                            duration_ms, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      input.userId,
      input.courseSlug,
      input.lessonId,
      input.mode,
      input.score,
      input.correct,
      input.total,
      input.durationMs,
      JSON.stringify(input.results.map((result) => ({ id: result.exerciseId, ok: result.correct }))),
      timestamp,
    );

    const existing = db
      .prepare(
        `SELECT state, best_score FROM lesson_progress
         WHERE user_id = ? AND course_slug = ? AND lesson_id = ?`,
      )
      .get(input.userId, input.courseSlug, input.lessonId) as
      | { state: LessonState; best_score: number | null }
      | undefined;

    const wasCompleted = existing?.state === 'passed' || existing?.state === 'skipped';
    const completedNow = input.passed && !wasCompleted;

    let state: LessonState;
    if (existing?.state === 'passed') state = 'passed';
    else if (input.passed) state = input.passedState;
    else state = existing?.state === 'skipped' ? 'skipped' : 'in_progress';

    const bestScore = Math.max(existing?.best_score ?? 0, input.score);

    db.prepare(
      `INSERT INTO lesson_progress(user_id, course_slug, lesson_id, state, best_score, attempts,
                                  updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(user_id, course_slug, lesson_id) DO UPDATE SET
         state = excluded.state,
         best_score = excluded.best_score,
         attempts = lesson_progress.attempts + 1,
         updated_at = excluded.updated_at,
         completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)`,
    ).run(
      input.userId,
      input.courseSlug,
      input.lessonId,
      state,
      bestScore,
      timestamp,
      completedNow ? timestamp : null,
    );

    db.prepare(
      `INSERT INTO daily_stats(user_id, day, lessons_completed, exercises, correct)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET
         lessons_completed = daily_stats.lessons_completed + excluded.lessons_completed,
         exercises = daily_stats.exercises + excluded.exercises,
         correct = daily_stats.correct + excluded.correct`,
    ).run(input.userId, day, completedNow ? 1 : 0, input.total, input.correct);

    // Anche una lezione saltata genera ripassi: saltare non significa sapere.
    let reviewsCreated = 0;
    for (const item of input.vocab) {
      reviewsCreated += insertReviewCard(
        db,
        input.userId,
        input.courseSlug,
        input.lessonId,
        item,
        day,
        timestamp,
      );
    }

    db.exec('COMMIT');
    return { state, bestScore, firstCompletion: completedNow, reviewsCreated };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Giorni consecutivi con almeno un esercizio fatto. */
export function streakDays(db: Db, userId: string, now: Date = new Date()): number {
  const rows = db
    .prepare('SELECT day FROM daily_stats WHERE user_id = ? AND exercises > 0 ORDER BY day DESC')
    .all(userId) as unknown as Array<{ day: string }>;

  if (rows.length === 0) return 0;

  const days = new Set(rows.map((row) => row.day));
  const cursor = new Date(now.getTime());
  const key = (date: Date) => date.toISOString().slice(0, 10);

  // Lo streak sopravvive se l'ultimo giorno attivo è oggi o ieri: alle 00:30
  // non si deve azzerare tutto perché non si è ancora studiato oggi.
  if (!days.has(key(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

interface CardRow {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  course_slug: string;
  lesson_id: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string;
}

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  courseSlug: string;
  lessonId: string;
  dueAt: string;
}

export function dueCards(db: Db, userId: string, limit = 40, now: Date = new Date()): ReviewCard[] {
  const rows = db
    .prepare(
      `SELECT id, front, back, hint, course_slug, lesson_id, ease, interval_days, reps, lapses, due_at
       FROM srs_cards
       WHERE user_id = ? AND due_at <= ?
       ORDER BY due_at ASC
       LIMIT ?`,
    )
    .all(userId, todayIso(now), limit) as unknown as CardRow[];

  return rows.map((row) => ({
    id: row.id,
    front: row.front,
    back: row.back,
    hint: row.hint,
    courseSlug: row.course_slug,
    lessonId: row.lesson_id,
    dueAt: row.due_at,
  }));
}

export function countDueCards(db: Db, userId: string, now: Date = new Date()): number {
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM srs_cards WHERE user_id = ? AND due_at <= ?')
    .get(userId, todayIso(now)) as { total: number };
  return Number(row.total);
}

export function gradeCard(
  db: Db,
  userId: string,
  cardId: string,
  grade: SrsGrade,
  now: Date = new Date(),
): ReviewCard | null {  const card = db
    .prepare('SELECT * FROM srs_cards WHERE id = ? AND user_id = ?')
    .get(cardId, userId) as CardRow | undefined;
  if (!card) return null;

  const next = scheduleCard(
    { ease: card.ease, intervalDays: card.interval_days, reps: card.reps, lapses: card.lapses },
    grade,
    now,
  );

  db.prepare(
    `UPDATE srs_cards SET ease = ?, interval_days = ?, reps = ?, lapses = ?, grade = ?,
                          due_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.ease,
    next.intervalDays,
    next.reps,
    next.lapses,
    grade,
    next.dueAt,
    nowIso(),
    cardId,
  );

  return {
    id: card.id,
    front: card.front,
    back: card.back,
    hint: card.hint,
    courseSlug: card.course_slug,
    lessonId: card.lesson_id,
    dueAt: next.dueAt,
  };
}

/* ------------------------------------------------------------------------- *
 * Letture per la pagina dei progressi: aggregati, non il dettaglio di ogni
 * tentativo. Servono allo studente per capire dove sta, non all'app per
 * funzionare.
 * ------------------------------------------------------------------------- */

export interface ActivityDay {
  day: string;
  exercises: number;
  correct: number;
  lessonsCompleted: number;
}

/**
 * Gli ultimi giorni di attività, dal più vecchio al più recente: la griglia
 * della pagina progressi. Vengono restituiti solo i giorni con traccia, perché
 * un buco nella griglia dice già "non hai studiato".
 */
export function activityDays(db: Db, userId: string, limit = 30): ActivityDay[] {
  const rows = db
    .prepare(
      `SELECT day, exercises, correct, lessons_completed FROM daily_stats
       WHERE user_id = ? ORDER BY day DESC LIMIT ?`,
    )
    .all(userId, limit) as unknown as Array<{
    day: string;
    exercises: number;
    correct: number;
    lessons_completed: number;
  }>;

  return rows
    .map((row) => ({
      day: row.day,
      exercises: row.exercises,
      correct: row.correct,
      lessonsCompleted: row.lessons_completed,
    }))
    .reverse();
}

export interface SrsSummary {
  cards: number;
  words: number;
  due: number;
  reviewed: number;
  mature: number;
}

/**
 * Stato del mazzo di ripasso. `words` conta le forme coreane distinte: la
 * stessa parola che compare in due lezioni crea due card (una per lezione), ma
 * per lo studente è sempre una parola imparata.
 */
export function srsStats(db: Db, userId: string, now: Date = new Date()): SrsSummary {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS cards,
         COUNT(DISTINCT front) AS words,
         SUM(CASE WHEN due_at <= ? THEN 1 ELSE 0 END) AS due,
         SUM(CASE WHEN reps > 0 THEN 1 ELSE 0 END) AS reviewed,
         SUM(CASE WHEN interval_days >= 7 THEN 1 ELSE 0 END) AS mature
       FROM srs_cards WHERE user_id = ?`,
    )
    .get(todayIso(now), userId) as {
    cards: number;
    words: number;
    due: number | null;
    reviewed: number | null;
    mature: number | null;
  };

  return {
    cards: Number(row.cards ?? 0),
    words: Number(row.words ?? 0),
    due: Number(row.due ?? 0),
    reviewed: Number(row.reviewed ?? 0),
    mature: Number(row.mature ?? 0),
  };
}

/** Lezioni chiuse in tutti i corsi: serve per dire quante parole ha visto. */
export function closedLessonCount(db: Db, userId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS total FROM lesson_progress WHERE user_id = ? AND state IN ('passed', 'skipped')`)
    .get(userId) as { total: number };
  return Number(row.total);
}

/**
 * true se la lezione è già stata chiusa (superata o saltata). Usato per lo
 * sblocco dei dialoghi collegati al percorso.
 */
export function isLessonClosed(db: Db, userId: string, courseSlug: string, lessonId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM lesson_progress
       WHERE user_id = ? AND course_slug = ? AND lesson_id = ? AND state IN ('passed', 'skipped')`,
    )
    .get(userId, courseSlug, lessonId);
  return row !== undefined;
}

export interface Totals {
  attempts: number;
  exercises: number;
  correct: number;
}

/**
 * Totali di carriera. Le serie le tiene daily_stats (è già aggregata), il
 * numero dei tentativi viene da attempts: contarlo dai giorni darebbe "giorni
 * di studio", che è un'altra cosa.
 */
export function lifetimeTotals(db: Db, userId: string): Totals {
  const daily = db
    .prepare(
      `SELECT COALESCE(SUM(exercises), 0) AS exercises, COALESCE(SUM(correct), 0) AS correct
       FROM daily_stats WHERE user_id = ?`,
    )
    .get(userId) as { exercises: number; correct: number };

  const attempts = db
    .prepare('SELECT COUNT(*) AS attempts FROM attempts WHERE user_id = ?')
    .get(userId) as { attempts: number };

  return {
    attempts: Number(attempts.attempts),
    exercises: Number(daily.exercises),
    correct: Number(daily.correct),
  };
}

/* ------------------------------------------------------------------------- *
 * Salto del corso: una prova sola, e il corso risulta chiuso. Vale la stessa
 * regola del salto di lezione — saltare non significa sapere, quindi il lavoro
 * che resta da fare è il ripasso, e le card si creano lo stesso.
 * ------------------------------------------------------------------------- */

/** Lezione fittizia per i tentativi di salto del corso: non è una lezione. */
export const COURSE_SKIP_LESSON_ID = '*';

export interface CourseSkipInput {
  userId: string;
  courseSlug: string;
  /** Tutte le lezioni del corso, con il loro lessico. */
  lessons: Array<{ lessonId: string; vocab: VocabItem[] }>;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  now?: Date;
}

export interface CourseSkipOutcome {
  lessonsSkipped: number;
  reviewsCreated: number;
}

/**
 * Registra la prova di salto del corso. Il tentativo si scrive sempre, superata
 * o no: la pagina dei progressi deve dire quante prove sono state fatte, non
 * solo quelle andate bene. Le lezioni si chiudono solo se la prova è superata,
 * e una lezione già superata resta `passed`: il salto non cancella un risultato.
 */
export function skipCourse(db: Db, input: CourseSkipInput): CourseSkipOutcome {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const day = todayIso(now);

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO attempts(id, user_id, course_slug, lesson_id, mode, score, correct, total,
                            duration_ms, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
      randomUUID(),
      input.userId,
      input.courseSlug,
      COURSE_SKIP_LESSON_ID,
      'course_skip',
      input.score,
      input.correct,
      input.total,
      JSON.stringify([]),
      timestamp,
    );

    let lessonsSkipped = 0;
    let reviewsCreated = 0;

    for (const lesson of input.lessons) {
      const existing = db
        .prepare(
          `SELECT state, best_score, attempts FROM lesson_progress
           WHERE user_id = ? AND course_slug = ? AND lesson_id = ?`,
        )
        .get(input.userId, input.courseSlug, lesson.lessonId) as
        | { state: LessonState; best_score: number | null; attempts: number }
        | undefined;

      const closed = existing?.state === 'passed' || existing?.state === 'skipped';

      if (input.passed && !closed) {
        db.prepare(
          `INSERT INTO lesson_progress(user_id, course_slug, lesson_id, state, best_score, attempts,
                                       updated_at, completed_at)
           VALUES (?, ?, ?, 'skipped', ?, ?, ?, ?)
           ON CONFLICT(user_id, course_slug, lesson_id) DO UPDATE SET
             state = 'skipped',
             updated_at = excluded.updated_at,
             completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)`,
        ).run(
          input.userId,
          input.courseSlug,
          lesson.lessonId,
          existing?.best_score ?? null,
          existing?.attempts ?? 0,
          timestamp,
          timestamp,
        );
        lessonsSkipped += 1;
      }

      // Il lessico di tutto il corso entra nei ripassi: è l'unica cosa che
      // resta da fare, a chi salta.
      for (const item of lesson.vocab) {
        reviewsCreated += insertReviewCard(
          db,
          input.userId,
          input.courseSlug,
          lesson.lessonId,
          item,
          day,
          timestamp,
        );
      }
    }

    db.prepare(
      `INSERT INTO daily_stats(user_id, day, lessons_completed, exercises, correct)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET
         lessons_completed = daily_stats.lessons_completed + excluded.lessons_completed,
         exercises = daily_stats.exercises + excluded.exercises,
         correct = daily_stats.correct + excluded.correct`,
    ).run(input.userId, day, lessonsSkipped, input.total, input.correct);

    db.exec('COMMIT');
    return { lessonsSkipped, reviewsCreated };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
