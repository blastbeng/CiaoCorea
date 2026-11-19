import type { LessonState, WritingVerdict } from '@ciaocorea/shared';
import type { Db } from '../db/client';
import { MIGRATIONS } from '../db/migrations';

/**
 * Il formato di trasferimento: un profilo — o tutti — in JSON, versionato.
 *
 * Non è il file del database. Quello contiene sessioni, indici e righe che
 * cambiano a ogni migrazione, e importarlo butterebbe via i profili che vivono
 * già su questo dispositivo. Qui c'è solo quello che serve per continuare a
 * studiare altrove, con nomi stabili e una versione da confrontare prima di
 * toccare qualcosa.
 */

export const TRANSFER_FORMAT = 'ciaocorea.profile';
export const TRANSFER_VERSION = 1;

export interface TransferUser {
  id: string;
  username: string;
  createdAt: string;
  usernameChosen: boolean;
  weeklyGoal: number;
  updatedAt: string;
}

export interface TransferLesson {
  courseSlug: string;
  lessonId: string;
  state: LessonState;
  bestScore: number | null;
  attempts: number;
  updatedAt: string;
  completedAt: string | null;
}

export interface TransferAttempt {
  id: string;
  courseSlug: string;
  lessonId: string;
  mode: string;
  score: number;
  correct: number;
  total: number;
  durationMs: number | null;
  createdAt: string;
}

export interface TransferCard {
  id: string;
  courseSlug: string;
  lessonId: string;
  itemId: string;
  front: string;
  back: string;
  hint: string | null;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  grade: number | null;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferDay {
  day: string;
  lessonsCompleted: number;
  exercises: number;
  correct: number;
  reviews: number;
  writing: number;
}

export interface TransferDialogue {
  dialogueSlug: string;
  turnIndex: number;
  correct: number;
  answered: number;
  wrongOnTurn: number;
  completedAt: string | null;
  updatedAt: string;
}

export interface TransferWriting {
  id: string;
  promptId: string;
  courseSlug: string;
  text: string;
  verdict: WritingVerdict;
  createdAt: string;
}

export interface TransferMistake {
  exerciseId: string;
  courseSlug: string;
  lessonId: string;
  wrongCount: number;
  createdAt: string;
  lastWrongAt: string;
}

/**
 * Un errore corretto sparisce dalla banca. Questo segnaposto viaggia col profilo
 * per impedire che un backup più vecchio lo faccia tornare al prossimo import.
 */
export interface TransferTombstone {
  kind: string;
  key: string;
  at: string;
}

export interface TransferProfile {
  user: TransferUser;
  lessons: TransferLesson[];
  attempts: TransferAttempt[];
  cards: TransferCard[];
  days: TransferDay[];
  dialogues: TransferDialogue[];
  writing: TransferWriting[];
  mistakes: TransferMistake[];
  tombstones: TransferTombstone[];
}

export interface TransferBundle {
  format: typeof TRANSFER_FORMAT;
  version: number;
  exportedAt: string;
  /** L'ultima migrazione applicata: dice quanto è vecchio il database di partenza. */
  schema: string;
  profiles: TransferProfile[];
  /** FNV-1a delle righe: distingue un file troncato da un file sbagliato. */
  checksum: string;
}

export class TransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferError';
  }
}

function currentSchema(): string {
  return MIGRATIONS[MIGRATIONS.length - 1]?.id ?? '';
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function checksumOf(profiles: TransferProfile[]): string {
  const text = JSON.stringify(profiles);
  return `${fnv1a(text)}-${text.length}`;
}

interface UserDbRow {
  id: string;
  username: string;
  created_at: string;
  username_chosen: number;
  weekly_goal: number;
  updated_at: string;
}

interface LessonDbRow {
  course_slug: string;
  lesson_id: string;
  state: LessonState;
  best_score: number | null;
  attempts: number;
  updated_at: string;
  completed_at: string | null;
}

interface AttemptDbRow {
  id: string;
  course_slug: string;
  lesson_id: string;
  mode: string;
  score: number;
  correct: number;
  total: number;
  duration_ms: number | null;
  created_at: string;
}

interface CardDbRow {
  id: string;
  course_slug: string;
  lesson_id: string;
  item_id: string;
  front: string;
  back: string;
  hint: string | null;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  grade: number | null;
  due_at: string;
  created_at: string;
  updated_at: string;
}

interface DayDbRow {
  day: string;
  lessons_completed: number;
  exercises: number;
  correct: number;
  reviews: number;
  writing: number;
}

interface DialogueDbRow {
  dialogue_slug: string;
  turn_index: number;
  correct: number;
  answered: number;
  wrong_on_turn: number;
  completed_at: string | null;
  updated_at: string;
}

interface WritingDbRow {
  id: string;
  prompt_id: string;
  course_slug: string;
  text: string;
  verdict: WritingVerdict;
  created_at: string;
}

interface MistakeDbRow {
  exercise_id: string;
  course_slug: string;
  lesson_id: string;
  wrong_count: number;
  created_at: string;
  last_wrong_at: string;
}

interface TombstoneDbRow {
  kind: string;
  key: string;
  at: string;
}

/**
 * Un profilo preso dal database e messo nella forma di trasferimento. `null`
 * se quell'id non esiste più: può succedere a un backup costruito a mano.
 */
export function exportProfile(db: Db, userId: string): TransferProfile | null {
  const user = db
    .prepare(
      `SELECT id, username, created_at, username_chosen, weekly_goal, updated_at
         FROM users WHERE id = ?`,
    )
    .get(userId) as UserDbRow | undefined;
  if (!user) return null;

  const lessons = db
    .prepare(
      `SELECT course_slug, lesson_id, state, best_score, attempts, updated_at, completed_at
         FROM lesson_progress WHERE user_id = ?
        ORDER BY course_slug, lesson_id`,
    )
    .all(userId) as unknown as LessonDbRow[];

  const attempts = db
    .prepare(
      `SELECT id, course_slug, lesson_id, mode, score, correct, total, duration_ms, created_at
         FROM attempts WHERE user_id = ?
        ORDER BY created_at`,
    )
    .all(userId) as unknown as AttemptDbRow[];

  const cards = db
    .prepare(
      `SELECT id, course_slug, lesson_id, item_id, front, back, hint, ease, interval_days,
              reps, lapses, grade, due_at, created_at, updated_at
         FROM srs_cards WHERE user_id = ?
        ORDER BY course_slug, item_id`,
    )
    .all(userId) as unknown as CardDbRow[];

  const days = db
    .prepare(
      `SELECT day, lessons_completed, exercises, correct, reviews, writing
         FROM daily_stats WHERE user_id = ?
        ORDER BY day`,
    )
    .all(userId) as unknown as DayDbRow[];

  const dialogues = db
    .prepare(
      `SELECT dialogue_slug, turn_index, correct, answered, wrong_on_turn, completed_at, updated_at
         FROM dialogue_progress WHERE user_id = ?
        ORDER BY dialogue_slug`,
    )
    .all(userId) as unknown as DialogueDbRow[];

  const writing = db
    .prepare(
      `SELECT id, prompt_id, course_slug, text, verdict, created_at
         FROM writing_entries WHERE user_id = ?
        ORDER BY created_at`,
    )
    .all(userId) as unknown as WritingDbRow[];

  const mistakes = db
    .prepare(
      `SELECT exercise_id, course_slug, lesson_id, wrong_count, created_at, last_wrong_at
         FROM exercise_mistakes WHERE user_id = ?
        ORDER BY last_wrong_at`,
    )
    .all(userId) as unknown as MistakeDbRow[];

  const tombstones = db
    .prepare('SELECT kind, key, at FROM sync_tombstones WHERE user_id = ?')
    .all(userId) as unknown as TombstoneDbRow[];

  return {
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
      usernameChosen: Number(user.username_chosen) === 1,
      weeklyGoal: Number(user.weekly_goal),
      updatedAt: user.updated_at || user.created_at,
    },
    lessons: lessons.map((row) => ({
      courseSlug: row.course_slug,
      lessonId: row.lesson_id,
      state: row.state,
      bestScore: row.best_score === null ? null : Number(row.best_score),
      attempts: Number(row.attempts),
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    })),
    attempts: attempts.map((row) => ({
      id: row.id,
      courseSlug: row.course_slug,
      lessonId: row.lesson_id,
      mode: row.mode,
      score: Number(row.score),
      correct: Number(row.correct),
      total: Number(row.total),
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      createdAt: row.created_at,
    })),
    cards: cards.map((row) => ({
      id: row.id,
      courseSlug: row.course_slug,
      lessonId: row.lesson_id,
      itemId: row.item_id,
      front: row.front,
      back: row.back,
      hint: row.hint,
      ease: Number(row.ease),
      intervalDays: Number(row.interval_days),
      reps: Number(row.reps),
      lapses: Number(row.lapses),
      grade: row.grade === null ? null : Number(row.grade),
      dueAt: row.due_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    days: days.map((row) => ({
      day: row.day,
      lessonsCompleted: Number(row.lessons_completed),
      exercises: Number(row.exercises),
      correct: Number(row.correct),
      reviews: Number(row.reviews),
      writing: Number(row.writing),
    })),
    dialogues: dialogues.map((row) => ({
      dialogueSlug: row.dialogue_slug,
      turnIndex: Number(row.turn_index),
      correct: Number(row.correct),
      answered: Number(row.answered),
      wrongOnTurn: Number(row.wrong_on_turn),
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    })),
    writing: writing.map((row) => ({
      id: row.id,
      promptId: row.prompt_id,
      courseSlug: row.course_slug,
      text: row.text,
      verdict: row.verdict,
      createdAt: row.created_at,
    })),
    mistakes: mistakes.map((row) => ({
      exerciseId: row.exercise_id,
      courseSlug: row.course_slug,
      lessonId: row.lesson_id,
      wrongCount: Number(row.wrong_count),
      createdAt: row.created_at,
      lastWrongAt: row.last_wrong_at,
    })),
    tombstones: tombstones.map((row) => ({ kind: row.kind, key: row.key, at: row.at })),
  };
}

/** Tutti i profili di questo browser, in un file solo: il backup completo. */
export function exportBundle(db: Db, userIds?: string[]): TransferBundle {
  const ids =
    userIds ??
    (db.prepare('SELECT id FROM users ORDER BY created_at').all() as unknown as { id: string }[]).map(
      (row) => row.id,
    );

  const profiles: TransferProfile[] = [];
  for (const id of ids) {
    const profile = exportProfile(db, id);
    if (profile) profiles.push(profile);
  }

  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    schema: currentSchema(),
    profiles,
    checksum: checksumOf(profiles),
  };
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

const LESSON_STATES: readonly LessonState[] = [
  'locked',
  'available',
  'in_progress',
  'passed',
  'skipped',
];

const VERDICTS: readonly WritingVerdict[] = ['model', 'close', 'far'];

function asLessonState(value: unknown): LessonState {
  return LESSON_STATES.includes(value as LessonState) ? (value as LessonState) : 'in_progress';
}

function asVerdict(value: unknown): WritingVerdict {
  return VERDICTS.includes(value as WritingVerdict) ? (value as WritingVerdict) : 'far';
}

/**
 * Rilegge un backup. Accetta sia il testo sia l'oggetto già letto, e non si
 * fida di niente: un file può essere troncato, modificato a mano, o venire da
 * una versione che conosce campi che qui non esistono ancora.
 */
export function parseBundle(raw: unknown): TransferBundle {
  let value: unknown = raw;

  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new TransferError('Il file non è un JSON valido: forse è stato troncato.');
    }
  }

  const root = asObject(value);
  if (root.format !== TRANSFER_FORMAT) {
    throw new TransferError('Questo file non è un backup di CiaoCorea.');
  }

  const version = asNumber(root.version, 0);
  if (version < 1) throw new TransferError('Il backup non dice quale versione è.');
  if (version > TRANSFER_VERSION) {
    throw new TransferError(
      'Il backup è stato creato da una versione più recente di CiaoCorea: aggiorna il sito e riprova.',
    );
  }

  const rawProfiles = asList(root.profiles);
  if (rawProfiles.length === 0) {
    throw new TransferError('Il backup non contiene nessun profilo.');
  }

  const profiles: TransferProfile[] = rawProfiles.map((item, index) => {
    const profile = asObject(item);
    const user = asObject(profile.user);
    const id = asString(user.id);

    if (id.length < 8) {
      throw new TransferError(`Il profilo ${index + 1} del backup non ha un identificativo valido.`);
    }

    const username = asString(user.username).trim();
    if (!username) {
      throw new TransferError(`Il profilo ${index + 1} del backup non ha un nome.`);
    }

    return {
      user: {
        id,
        username,
        createdAt: asString(user.createdAt, new Date().toISOString()),
        usernameChosen: user.usernameChosen === true || asNumber(user.usernameChosen) === 1,
        weeklyGoal: Math.min(7, Math.max(1, asNumber(user.weeklyGoal, 5))),
        updatedAt: asString(user.updatedAt, asString(user.createdAt, new Date().toISOString())),
      },
      lessons: asList(profile.lessons).map((entry) => {
        const row = asObject(entry);
        return {
          courseSlug: asString(row.courseSlug),
          lessonId: asString(row.lessonId),
          state: asLessonState(row.state),
          bestScore: asNullableNumber(row.bestScore),
          attempts: Math.max(0, Math.trunc(asNumber(row.attempts))),
          updatedAt: asString(row.updatedAt),
          completedAt: asNullableString(row.completedAt),
        };
      }),
      attempts: asList(profile.attempts).map((entry) => {
        const row = asObject(entry);
        return {
          id: asString(row.id),
          courseSlug: asString(row.courseSlug),
          lessonId: asString(row.lessonId),
          mode: asString(row.mode, 'lesson'),
          score: asNumber(row.score),
          correct: asNumber(row.correct),
          total: asNumber(row.total),
          durationMs: asNullableNumber(row.durationMs),
          createdAt: asString(row.createdAt),
        };
      }),
      cards: asList(profile.cards).map((entry) => {
        const row = asObject(entry);
        return {
          id: asString(row.id),
          courseSlug: asString(row.courseSlug),
          lessonId: asString(row.lessonId),
          itemId: asString(row.itemId),
          front: asString(row.front),
          back: asString(row.back),
          hint: asNullableString(row.hint),
          ease: asNumber(row.ease, 2.5),
          intervalDays: asNumber(row.intervalDays),
          reps: Math.max(0, Math.trunc(asNumber(row.reps))),
          lapses: Math.max(0, Math.trunc(asNumber(row.lapses))),
          grade: asNullableNumber(row.grade),
          dueAt: asString(row.dueAt),
          createdAt: asString(row.createdAt),
          updatedAt: asString(row.updatedAt),
        };
      }),
      days: asList(profile.days).map((entry) => {
        const row = asObject(entry);
        return {
          day: asString(row.day),
          lessonsCompleted: Math.max(0, Math.trunc(asNumber(row.lessonsCompleted))),
          exercises: Math.max(0, Math.trunc(asNumber(row.exercises))),
          correct: Math.max(0, Math.trunc(asNumber(row.correct))),
          reviews: Math.max(0, Math.trunc(asNumber(row.reviews))),
          writing: Math.max(0, Math.trunc(asNumber(row.writing))),
        };
      }),
      dialogues: asList(profile.dialogues).map((entry) => {
        const row = asObject(entry);
        return {
          dialogueSlug: asString(row.dialogueSlug),
          turnIndex: Math.max(0, Math.trunc(asNumber(row.turnIndex))),
          correct: Math.max(0, Math.trunc(asNumber(row.correct))),
          answered: Math.max(0, Math.trunc(asNumber(row.answered))),
          wrongOnTurn: Math.max(0, Math.trunc(asNumber(row.wrongOnTurn))),
          completedAt: asNullableString(row.completedAt),
          updatedAt: asString(row.updatedAt),
        };
      }),
      writing: asList(profile.writing).map((entry) => {
        const row = asObject(entry);
        return {
          id: asString(row.id),
          promptId: asString(row.promptId),
          courseSlug: asString(row.courseSlug),
          text: asString(row.text),
          verdict: asVerdict(row.verdict),
          createdAt: asString(row.createdAt),
        };
      }),
      mistakes: asList(profile.mistakes).map((entry) => {
        const row = asObject(entry);
        return {
          exerciseId: asString(row.exerciseId),
          courseSlug: asString(row.courseSlug),
          lessonId: asString(row.lessonId),
          wrongCount: Math.max(1, Math.trunc(asNumber(row.wrongCount, 1))),
          createdAt: asString(row.createdAt),
          lastWrongAt: asString(row.lastWrongAt),
        };
      }),
      tombstones: asList(profile.tombstones).map((entry) => {
        const row = asObject(entry);
        return { kind: asString(row.kind), key: asString(row.key), at: asString(row.at) };
      }),
    };
  });

  for (const profile of profiles) {
    profile.lessons = profile.lessons.filter(
      (row) => row.courseSlug.length > 0 && row.lessonId.length > 0,
    );
    profile.attempts = profile.attempts.filter(
      (row) => row.id.length > 0 && row.courseSlug.length > 0,
    );
    profile.cards = profile.cards.filter(
      (row) => row.id.length > 0 && row.itemId.length > 0 && row.front.length > 0,
    );
    profile.days = profile.days.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.day));
    profile.dialogues = profile.dialogues.filter((row) => row.dialogueSlug.length > 0);
    profile.writing = profile.writing.filter((row) => row.id.length > 0 && row.promptId.length > 0);
    profile.mistakes = profile.mistakes.filter(
      (row) => row.exerciseId.length > 0 && row.courseSlug.length > 0,
    );
  }

  const checksum = asString(root.checksum);
  if (checksum && checksum !== checksumOf(profiles)) {
    throw new TransferError(
      'Il file risulta danneggiato (controllo di integrità fallito). Scaricalo di nuovo dal dispositivo di partenza.',
    );
  }

  return {
    format: TRANSFER_FORMAT,
    version,
    exportedAt: asString(root.exportedAt, new Date().toISOString()),
    schema: asString(root.schema),
    profiles,
    checksum: checksumOf(profiles),
  };
}
