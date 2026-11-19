import { USERNAME_MAX, USERNAME_PATTERN, type LessonState } from '@ciaocorea/shared';
import type { Db } from '../db/client';
import type { TransferBundle, TransferProfile } from './bundle';

/**
 * L'importazione non sostituisce il database: fonde il profilo del backup con
 * quello che già vive qui. Sostituire i byte butterebbe via gli altri profili
 * di questo browser e le loro sessioni, che non hanno niente a che vedere con
 * il file che lo studente ha appena aperto.
 *
 * Le regole sono poche e sempre nella stessa direzione: si tiene il meglio,
 * non l'ultimo arrivato. Una lezione promossa non torna indietro, il punteggio
 * più alto vince, i tentativi non si sommano (sarebbero contati due volte).
 */

export type ImportStrategy = 'merge' | 'replace';

export interface ProfileImportSummary {
  userId: string;
  /** Il nome con cui il profilo è entrato (può avere un suffisso). */
  username: string;
  /** Il nome del backup, se qui era già di un altro profilo. */
  renamedFrom: string | null;
  lessons: { added: number; updated: number };
  attempts: number;
  cards: { added: number; updated: number };
  days: number;
  dialogues: number;
  writing: number;
  mistakes: { added: number; cleared: number };
}

export interface ImportOutcome {
  profiles: ProfileImportSummary[];
}

const TABLES_WITH_PROFILE_DATA = [
  'lesson_progress',
  'attempts',
  'srs_cards',
  'daily_stats',
  'dialogue_progress',
  'writing_entries',
  'exercise_mistakes',
  'sync_tombstones',
] as const;

function clearProfileData(db: Db, userId: string): void {
  for (const table of TABLES_WITH_PROFILE_DATA) {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
  }
}

/** Il nome deve restare leggibile e valido: un file può contenere di tutto. */
function sanitizeUsername(value: string): string {
  const cleaned = value.trim().replace(/[^\p{L}\p{N}._-]/gu, '-').replace(/^[^\p{L}\p{N}]+/u, '');
  const candidate = cleaned.slice(0, USERNAME_MAX);
  return candidate && USERNAME_PATTERN.test(candidate) ? candidate : 'Studente';
}

function usernameTaken(db: Db, username: string, exceptId: string): boolean {
  const row = db
    .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
    .get(username) as { id: string } | undefined;
  return row !== undefined && row.id !== exceptId;
}

/**
 * Il primo nome libero: `Marco`, poi `Marco-2`, `Marco-3`… Due dispositivi
 * possono avere entrambi un `Marco`, e rinominare è meglio che fondere due
 * persone in un profilo solo.
 */
function freeUsername(db: Db, wanted: string, exceptId: string): string {
  const base = sanitizeUsername(wanted);
  if (!usernameTaken(db, base, exceptId)) return base;

  for (let index = 2; index <= 50; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
    if (!usernameTaken(db, candidate, exceptId)) return candidate;
  }

  const suffix = `-${Math.random().toString(36).slice(2, 6)}`;
  return `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
}

interface UserDbRow {
  id: string;
  username: string;
  updated_at: string;
}

interface LessonDbRow {
  state: LessonState;
  best_score: number | null;
  attempts: number;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Chi ha promosso una lezione non la ritrova "in corso" perché l'altro
 * dispositivo era rimasto indietro. `passed` vince sempre, `skipped` vince su
 * tutto il resto; fra due stati non terminali decide l'orologio.
 */
function pickLessonState(
  local: LessonState,
  incoming: LessonState,
  localAt: string,
  incomingAt: string,
): LessonState {
  if (local === 'passed' || incoming === 'passed') return 'passed';
  if (local === 'skipped' || incoming === 'skipped') return 'skipped';
  return incomingAt >= localAt ? incoming : local;
}

function latest(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function maxOrNull(a: number | null, b: number | null): number | null {
  const left = a ?? -1;
  const right = b ?? -1;
  const winner = Math.max(left, right);
  return winner < 0 ? null : winner;
}

function mergeUser(
  db: Db,
  incoming: TransferProfile['user'],
  strategy: ImportStrategy,
): { userId: string; username: string; renamedFrom: string | null } {
  const existing = db
    .prepare('SELECT id, username, updated_at FROM users WHERE id = ?')
    .get(incoming.id) as UserDbRow | undefined;

  if (!existing) {
    const username = freeUsername(db, incoming.username, incoming.id);
    db.prepare(
      `INSERT INTO users(id, username, display_name, created_at, username_chosen, weekly_goal, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      incoming.id,
      username,
      username,
      incoming.createdAt,
      incoming.usernameChosen ? 1 : 0,
      incoming.weeklyGoal,
      incoming.updatedAt,
    );
    return {
      userId: incoming.id,
      username,
      renamedFrom: username === incoming.username ? null : incoming.username,
    };
  }

  // Stesso profilo: identità e nome restano suoi, ma se ha cambiato nome
  // sull'altro dispositivo più di recente, quel nome arriva qui — purché sia
  // libero. Un nome non si ruba a un altro profilo di questo browser.
  const newer = strategy === 'replace' || incoming.updatedAt > (existing.updated_at || '');
  let username = existing.username;
  if (newer && incoming.username !== existing.username) {
    const candidate = freeUsername(db, incoming.username, incoming.id);
    if (candidate === incoming.username) username = candidate;
  }

  if (newer) {
    db.prepare(
      `UPDATE users SET username = ?, display_name = ?, username_chosen = ?,
                        weekly_goal = ?, updated_at = ? WHERE id = ?`,
    ).run(
      username,
      username,
      incoming.usernameChosen ? 1 : 0,
      incoming.weeklyGoal,
      incoming.updatedAt,
      incoming.id,
    );
  }

  return { userId: incoming.id, username, renamedFrom: null };
}

function mergeLessons(
  db: Db,
  userId: string,
  lessons: TransferProfile['lessons'],
  strategy: ImportStrategy,
): { added: number; updated: number } {
  let added = 0;
  let updated = 0;

  const read = db.prepare(
    `SELECT state, best_score, attempts, updated_at, completed_at FROM lesson_progress
      WHERE user_id = ? AND course_slug = ? AND lesson_id = ?`,
  );
  const insert = db.prepare(
    `INSERT INTO lesson_progress(user_id, course_slug, lesson_id, state, best_score, attempts,
                                updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE lesson_progress SET state = ?, best_score = ?, attempts = ?, updated_at = ?, completed_at = ?
      WHERE user_id = ? AND course_slug = ? AND lesson_id = ?`,
  );

  for (const incoming of lessons) {
    const local = read.get(userId, incoming.courseSlug, incoming.lessonId) as
      | LessonDbRow
      | undefined;

    if (!local) {
      insert.run(
        userId,
        incoming.courseSlug,
        incoming.lessonId,
        incoming.state,
        incoming.bestScore,
        incoming.attempts,
        incoming.updatedAt,
        incoming.completedAt,
      );
      added += 1;
      continue;
    }

    const state =
      strategy === 'replace'
        ? incoming.state
        : pickLessonState(local.state, incoming.state, local.updated_at, incoming.updatedAt);
    const bestScore =
      strategy === 'replace' ? incoming.bestScore : maxOrNull(local.best_score, incoming.bestScore);
    const attempts =
      strategy === 'replace' ? incoming.attempts : Math.max(local.attempts, incoming.attempts);
    const updatedAt = strategy === 'replace' ? incoming.updatedAt : latest(local.updated_at, incoming.updatedAt);
    const completedAt =
      strategy === 'replace' ? incoming.completedAt : earliest(local.completed_at, incoming.completedAt);

    const changed =
      state !== local.state ||
      bestScore !== local.best_score ||
      attempts !== local.attempts ||
      updatedAt !== local.updated_at ||
      completedAt !== local.completed_at;

    if (changed) {
      update.run(
        state,
        bestScore,
        attempts,
        updatedAt,
        completedAt,
        userId,
        incoming.courseSlug,
        incoming.lessonId,
      );
      updated += 1;
    }
  }

  return { added, updated };
}

function mergeAttempts(
  db: Db,
  userId: string,
  attempts: TransferProfile['attempts'],
): number {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO attempts(id, user_id, course_slug, lesson_id, mode, score, correct,
                                    total, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let added = 0;
  for (const row of attempts) {
    const result = insert.run(
      row.id,
      userId,
      row.courseSlug,
      row.lessonId,
      row.mode,
      row.score,
      row.correct,
      row.total,
      row.durationMs,
      row.createdAt,
    );
    added += Number(result.changes ?? 0);
  }
  return added;
}

function mergeCards(
  db: Db,
  userId: string,
  cards: TransferProfile['cards'],
  strategy: ImportStrategy,
): { added: number; updated: number } {
  const read = db.prepare(
    `SELECT id, updated_at FROM srs_cards WHERE user_id = ? AND course_slug = ? AND item_id = ?`,
  );
  const insert = db.prepare(
    `INSERT OR REPLACE INTO srs_cards(id, user_id, course_slug, lesson_id, item_id, front, back,
                                      hint, ease, interval_days, reps, lapses, grade, due_at,
                                      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE srs_cards SET lesson_id = ?, front = ?, back = ?, hint = ?, ease = ?,
                          interval_days = ?, reps = ?, lapses = ?, grade = ?, due_at = ?,
                          created_at = ?, updated_at = ?
      WHERE id = ?`,
  );

  let added = 0;
  let updated = 0;

  for (const row of cards) {
    const local = read.get(userId, row.courseSlug, row.itemId) as
      | { id: string; updated_at: string }
      | undefined;

    if (!local) {
      insert.run(
        row.id,
        userId,
        row.courseSlug,
        row.lessonId,
        row.itemId,
        row.front,
        row.back,
        row.hint,
        row.ease,
        row.intervalDays,
        row.reps,
        row.lapses,
        row.grade,
        row.dueAt,
        row.createdAt,
        row.updatedAt,
      );
      added += 1;
      continue;
    }

    if (strategy === 'replace' || row.updatedAt > local.updated_at) {
      update.run(
        row.lessonId,
        row.front,
        row.back,
        row.hint,
        row.ease,
        row.intervalDays,
        row.reps,
        row.lapses,
        row.grade,
        row.dueAt,
        row.createdAt,
        row.updatedAt,
        local.id,
      );
      updated += 1;
    }
  }

  return { added, updated };
}

/**
 * Le statistiche di un giorno sono contatori: sommarli conterebbe due volte lo
 * stesso esercizio fatto su due dispositivi, e gonfierebbe streak e obiettivi.
 * Si tiene il massimo, che è il numero più onesto che abbiamo.
 */
function mergeDays(db: Db, userId: string, days: TransferProfile['days']): number {
  const upsert = db.prepare(
    `INSERT INTO daily_stats(user_id, day, lessons_completed, exercises, correct, reviews, writing)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       lessons_completed = MAX(daily_stats.lessons_completed, excluded.lessons_completed),
       exercises = MAX(daily_stats.exercises, excluded.exercises),
       correct = MAX(daily_stats.correct, excluded.correct),
       reviews = MAX(daily_stats.reviews, excluded.reviews),
       writing = MAX(daily_stats.writing, excluded.writing)`,
  );

  let touched = 0;
  for (const row of days) {
    upsert.run(
      userId,
      row.day,
      row.lessonsCompleted,
      row.exercises,
      row.correct,
      row.reviews,
      row.writing,
    );
    touched += 1;
  }
  return touched;
}

function mergeDialogues(
  db: Db,
  userId: string,
  dialogues: TransferProfile['dialogues'],
): number {
  const upsert = db.prepare(
    `INSERT INTO dialogue_progress(user_id, dialogue_slug, turn_index, correct, answered,
                                   wrong_on_turn, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, dialogue_slug) DO UPDATE SET
       turn_index = MAX(dialogue_progress.turn_index, excluded.turn_index),
       correct = MAX(dialogue_progress.correct, excluded.correct),
       answered = MAX(dialogue_progress.answered, excluded.answered),
       wrong_on_turn = CASE
         WHEN excluded.turn_index > dialogue_progress.turn_index THEN excluded.wrong_on_turn
         ELSE dialogue_progress.wrong_on_turn END,
       completed_at = COALESCE(dialogue_progress.completed_at, excluded.completed_at),
       updated_at = MAX(dialogue_progress.updated_at, excluded.updated_at)`,
  );

  let touched = 0;
  for (const row of dialogues) {
    upsert.run(
      userId,
      row.dialogueSlug,
      row.turnIndex,
      row.correct,
      row.answered,
      row.wrongOnTurn,
      row.completedAt,
      row.updatedAt,
    );
    touched += 1;
  }
  return touched;
}

function mergeWriting(db: Db, userId: string, writing: TransferProfile['writing']): number {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO writing_entries(id, user_id, prompt_id, course_slug, text, verdict, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  let added = 0;
  for (const row of writing) {
    const result = insert.run(
      row.id,
      userId,
      row.promptId,
      row.courseSlug,
      row.text,
      row.verdict,
      row.createdAt,
    );
    added += Number(result.changes ?? 0);
  }
  return added;
}

function mergeTombstones(
  db: Db,
  userId: string,
  tombstones: TransferProfile['tombstones'],
): void {
  const upsert = db.prepare(
    `INSERT INTO sync_tombstones(user_id, kind, key, at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, kind, key) DO UPDATE SET at = excluded.at
      WHERE excluded.at > sync_tombstones.at`,
  );
  for (const row of tombstones) {
    upsert.run(userId, row.kind, row.key, row.at);
  }
}

function mistakeTombstones(db: Db, userId: string): Map<string, string> {
  const rows = db
    .prepare("SELECT key, at FROM sync_tombstones WHERE user_id = ? AND kind = 'mistake'")
    .all(userId) as unknown as { key: string; at: string }[];
  return new Map(rows.map((row) => [row.key, row.at]));
}

/**
 * Un errore che l'altro dispositivo ha già corretto non deve tornare in banca
 * solo perché il backup è più vecchio della correzione: il segnaposto porta la
 * data, e vince la più recente.
 */
function mergeMistakes(
  db: Db,
  userId: string,
  mistakes: TransferProfile['mistakes'],
  tombstones: Map<string, string>,
): { added: number; cleared: number } {
  const upsert = db.prepare(
    `INSERT INTO exercise_mistakes(user_id, exercise_id, course_slug, lesson_id, wrong_count,
                                   created_at, last_wrong_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, exercise_id) DO UPDATE SET
       wrong_count = MAX(exercise_mistakes.wrong_count, excluded.wrong_count),
       last_wrong_at = MAX(exercise_mistakes.last_wrong_at, excluded.last_wrong_at)`,
  );
  const remove = db.prepare('DELETE FROM exercise_mistakes WHERE user_id = ? AND exercise_id = ?');

  let added = 0;
  let cleared = 0;

  for (const row of mistakes) {
    const clearedAt = tombstones.get(row.exerciseId);
    if (clearedAt && clearedAt > row.lastWrongAt) {
      // Corretto altrove dopo che questo backup era stato scritto.
      const result = remove.run(userId, row.exerciseId);
      cleared += Number(result.changes ?? 0);
      continue;
    }

    const local = db
      .prepare(
        'SELECT wrong_count FROM exercise_mistakes WHERE user_id = ? AND exercise_id = ?',
      )
      .get(userId, row.exerciseId) as { wrong_count: number } | undefined;

    upsert.run(
      userId,
      row.exerciseId,
      row.courseSlug,
      row.lessonId,
      row.wrongCount,
      row.createdAt,
      row.lastWrongAt,
    );
    if (!local) added += 1;
  }

  // Gli errori che la banca locale ha ancora ma che l'altro dispositivo ha
  // corretto: il segnaposto è più recente della riga, quindi spariscono.
  const localRows = db
    .prepare('SELECT exercise_id, last_wrong_at FROM exercise_mistakes WHERE user_id = ?')
    .all(userId) as unknown as { exercise_id: string; last_wrong_at: string }[];
  for (const row of localRows) {
    const clearedAt = tombstones.get(row.exercise_id);
    if (clearedAt && clearedAt > row.last_wrong_at) {
      const result = remove.run(userId, row.exercise_id);
      cleared += Number(result.changes ?? 0);
    }
  }

  return { added, cleared };
}

export function mergeProfile(
  db: Db,
  profile: TransferProfile,
  strategy: ImportStrategy,
): ProfileImportSummary {
  const identity = mergeUser(db, profile.user, strategy);
  const userId = identity.userId;

  if (strategy === 'replace') clearProfileData(db, userId);

  // I segnaposto si fondono per primi: servono a decidere quali errori
  // rientrano in banca e quali restano corretti.
  mergeTombstones(db, userId, profile.tombstones);

  const lessons = mergeLessons(db, userId, profile.lessons, strategy);
  const attempts = mergeAttempts(db, userId, profile.attempts);
  const cards = mergeCards(db, userId, profile.cards, strategy);
  const days = mergeDays(db, userId, profile.days);
  const dialogues = mergeDialogues(db, userId, profile.dialogues);
  const writing = mergeWriting(db, userId, profile.writing);
  const mistakes = mergeMistakes(db, userId, profile.mistakes, mistakeTombstones(db, userId));

  return {
    userId,
    username: identity.username,
    renamedFrom: identity.renamedFrom,
    lessons,
    attempts,
    cards,
    days,
    dialogues,
    writing,
    mistakes,
  };
}

/**
 * Un'unica transazione per tutto il file: o entrano tutti i profili, o nessuno.
 * `commit: false` serve all'anteprima — si esegue il merge vero e si torna
 * indietro, così il riepilogo non è una stima ma il conto esatto.
 */
export function mergeBundle(
  db: Db,
  bundle: TransferBundle,
  strategy: ImportStrategy,
  commit: boolean,
): ImportOutcome {
  db.exec('BEGIN');
  try {
    const profiles = bundle.profiles.map((profile) => mergeProfile(db, profile, strategy));
    db.exec(commit ? 'COMMIT' : 'ROLLBACK');
    return { profiles };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Un profilo già presente qui: serve a dire "stai per sovrascrivere te stesso". */
export function profileExists(db: Db, userId: string): boolean {
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  return row !== undefined;
}

export function currentUsername(db: Db, userId: string): string | null {
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as
    | { username: string }
    | undefined;
  return row?.username ?? null;
}
