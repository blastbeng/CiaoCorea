import type { ExerciseResult } from '@ciaocorea/shared';
import type { Db } from '../db/client';
import { todayIso } from '../db/client';

export interface MistakeRow {
  exercise_id: string;
  course_slug: string;
  lesson_id: string;
  wrong_count: number;
  last_wrong_at: string;
}

/**
 * La banca degli errori, dalla più recente: chi apre la pagina deve ritrovare
 * in cima quello che ha appena sbagliato, non un errore di tre settimane fa.
 */
export function listMistakes(db: Db, userId: string, limit = 200): MistakeRow[] {
  return db
    .prepare(
      `SELECT exercise_id, course_slug, lesson_id, wrong_count, last_wrong_at
       FROM exercise_mistakes WHERE user_id = ? ORDER BY last_wrong_at DESC LIMIT ?`,
    )
    .all(userId, limit) as unknown as MistakeRow[];
}

export function getMistake(db: Db, userId: string, exerciseId: string): MistakeRow | undefined {
  return db
    .prepare(
      `SELECT exercise_id, course_slug, lesson_id, wrong_count, last_wrong_at
       FROM exercise_mistakes WHERE user_id = ? AND exercise_id = ?`,
    )
    .get(userId, exerciseId) as MistakeRow | undefined;
}

export function countMistakes(db: Db, userId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM exercise_mistakes WHERE user_id = ?')
    .get(userId) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

/**
 * Aggiorna la banca con l'esito di un tentativo. Gira dentro la transazione di
 * `recordAttempt`: la lezione e la banca devono restare d'accordo, altrimenti
 * una lezione promossa potrebbe lasciare in banca esercizi che l'ha già
 * corretti — o il contrario.
 *
 * Non apre e non chiude transazioni: la chiama chi le possiede.
 */
export function syncMistakes(
  db: Db,
  userId: string,
  courseSlug: string,
  lessonId: string,
  results: readonly ExerciseResult[],
  timestamp: string,
): void {
  const clear = db.prepare(
    'DELETE FROM exercise_mistakes WHERE user_id = ? AND exercise_id = ?',
  );
  const bump = db.prepare(
    `INSERT INTO exercise_mistakes(user_id, exercise_id, course_slug, lesson_id,
                                  wrong_count, created_at, last_wrong_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(user_id, exercise_id) DO UPDATE SET
       wrong_count = exercise_mistakes.wrong_count + 1,
       last_wrong_at = excluded.last_wrong_at`,
  );

  for (const result of results) {
    if (result.correct) {
      clear.run(userId, result.exerciseId);
      continue;
    }
    bump.run(userId, result.exerciseId, courseSlug, lessonId, timestamp, timestamp);
  }
}

/**
 * Un esercizio rifatto dalla pagina Errori. Azzeccarlo lo toglie dalla banca,
 * sbagliarlo di nuovo alza il conto. In entrambi i casi l'esercizio è stato
 * fatto, e conta come studio: senza questo, una giornata passata a rifare i
 * propri errori non farebbe avanzare né lo streak né il piano.
 *
 * `wrongCount` a `null` significa "uscito dalla banca".
 */
export function recordMistakeAnswer(
  db: Db,
  userId: string,
  exerciseId: string,
  correct: boolean,
  now: Date = new Date(),
): number | null {
  const timestamp = now.toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO daily_stats(user_id, day, exercises, correct) VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET
         exercises = daily_stats.exercises + 1,
         correct = daily_stats.correct + excluded.correct`,
    ).run(userId, todayIso(now), correct ? 1 : 0);

    let wrongCount: number | null = null;
    if (correct) {
      db.prepare('DELETE FROM exercise_mistakes WHERE user_id = ? AND exercise_id = ?').run(
        userId,
        exerciseId,
      );
    } else {
      db.prepare(
        `UPDATE exercise_mistakes SET wrong_count = wrong_count + 1, last_wrong_at = ?
         WHERE user_id = ? AND exercise_id = ?`,
      ).run(timestamp, userId, exerciseId);

      const row = db
        .prepare(
          'SELECT wrong_count FROM exercise_mistakes WHERE user_id = ? AND exercise_id = ?',
        )
        .get(userId, exerciseId) as { wrong_count: number } | undefined;
      wrongCount = Number(row?.wrong_count ?? 1);
    }

    db.exec('COMMIT');
    return wrongCount;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
