import type { Db } from '../db/client';

export interface LevelExamRow {
  level: string;
  best_score: number;
  attempts: number;
  passed_at: string | null;
  last_at: string;
}

export function listLevelExams(db: Db, userId: string): LevelExamRow[] {
  return db
    .prepare(
      `SELECT level, best_score, attempts, passed_at, last_at
       FROM level_exams WHERE user_id = ?`,
    )
    .all(userId) as unknown as LevelExamRow[];
}

export function getLevelExam(db: Db, userId: string, level: string): LevelExamRow | undefined {
  return db
    .prepare(
      `SELECT level, best_score, attempts, passed_at, last_at
       FROM level_exams WHERE user_id = ? AND level = ?`,
    )
    .get(userId, level) as LevelExamRow | undefined;
}

export interface LevelExamOutcome {
  best_score: number;
  attempts: number;
  passed_at: string | null;
  /** Vero solo la prima volta che il traguardo viene raggiunto. */
  firstPass: boolean;
}

/**
 * Una consegna del traguardo. Il migliore resta, anche se la prova dopo va
 * peggio: è una fotografia, non una classifica. `firstPass` serve al messaggio
 * «primo traguardo» invece di «di nuovo».
 */
export function recordLevelExam(
  db: Db,
  userId: string,
  level: string,
  score: number,
  passed: boolean,
  now = new Date(),
): LevelExamOutcome {
  const at = now.toISOString();
  const previous = getLevelExam(db, userId, level);
  const firstPass = passed && !previous?.passed_at;
  const best = Math.max(previous?.best_score ?? 0, score);
  const passedAt = previous?.passed_at ?? (passed ? at : null);

  if (previous) {
    db.prepare(
      `UPDATE level_exams
         SET best_score = ?, attempts = attempts + 1, passed_at = ?, last_at = ?
       WHERE user_id = ? AND level = ?`,
    ).run(best, passedAt, at, userId, level);
  } else {
    db.prepare(
      `INSERT INTO level_exams (user_id, level, best_score, attempts, passed_at, last_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    ).run(userId, level, best, passedAt, at);
  }

  return {
    best_score: best,
    attempts: (previous?.attempts ?? 0) + 1,
    passed_at: passedAt,
    firstPass,
  };
}
