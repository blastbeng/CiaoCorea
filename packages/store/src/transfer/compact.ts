import { findLesson, getCourse } from '@ciaocorea/curriculum';
import type { LessonState } from '@ciaocorea/shared';
import type { Db } from '../db/client';
import {
  TRANSFER_FORMAT,
  TRANSFER_VERSION,
  TransferError,
  parseBundle,
  type TransferBundle,
  type TransferCard,
  type TransferProfile,
} from './bundle';

/**
 * Il codice di trasferimento: i progressi di un profilo in una riga di testo.
 *
 * Non è il backup. Il backup è il file, e contiene tutto — tentativi, quaderno,
 * banca degli errori. Questo codice serve al gesto veloce: passare lezioni,
 * ripassi e giorni di studio da un telefono a un computer, o viceversa, senza
 * cavo e senza account. Quel che resta fuori è la cronologia: si può sempre
 * portare dopo con il file.
 *
 * Il formato è compatto perché finisca in un QR: chiavi di una lettera, date
 * in base36, stato della lezione in un carattere. Il testo è compresso quando
 * il browser sa farlo (CompressionStream) e codificato in base64url, così si
 * può incollare ovunque senza rovinarsi.
 */

const PREFIX = 'CC1';
const PAYLOAD_VERSION = 1;

/** Quanti caratteri stanno comodamente in un QR ad alta densità. */
export const COMPACT_QR_LIMIT = 1800;

interface CompactPayload {
  v: number;
  /** Quando è stato generato il codice: è l'orologio dei dati che non ne hanno uno. */
  e: string;
  /** id, username, createdAt, weeklyGoal, usernameChosen, updatedAt */
  u: [string, string, string, number, number, string];
  /** courseSlug, lessonId, state, bestScore, attempts, updatedAt, completedAt */
  l: Array<[string, string, string, number | null, number, string, string | null]>;
  /** courseSlug, itemId, ease×100, intervalDays, reps, lapses, grade, dueAt */
  c: Array<[string, string, number, number, number, number, number | null, string]>;
  /** day, lessonsCompleted, exercises, correct, reviews, writing */
  d: Array<[string, number, number, number, number, number]>;
  /** dialogueSlug, turnIndex, correct, answered, wrongOnTurn, completedAt, updatedAt */
  g: Array<[string, number, number, number, number, string | null, string]>;
}

const STATE_CODES: Record<LessonState, string> = {
  locked: 'l',
  available: 'a',
  in_progress: 'i',
  passed: 'p',
  skipped: 's',
};

const CODE_STATES: Record<string, LessonState> = {
  l: 'locked',
  a: 'available',
  i: 'in_progress',
  p: 'passed',
  s: 'skipped',
};

/** Un istante in base36: sette caratteri invece di ventiquattro. */
function stamp(value: string | null): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor(time / 1000).toString(36);
}

function unstamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  const time = Number.parseInt(value, 36);
  if (!Number.isFinite(time)) return fallback;
  return new Date(time * 1000).toISOString();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    // `slice()` restituisce una vista con il proprio ArrayBuffer: è quello che
    // Blob accetta senza ambiguità sui tipi.
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** `true` quando il codice è abbastanza corto da stare in un QR leggibile. */
export function fitsInQr(code: string): boolean {
  return code.length <= COMPACT_QR_LIMIT;
}

interface CompactRow {
  course_slug: string;
  lesson_id: string;
  state: LessonState;
  best_score: number | null;
  attempts: number;
  updated_at: string;
  completed_at: string | null;
}

interface CardRow {
  course_slug: string;
  item_id: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  grade: number | null;
  due_at: string;
}

interface DayRow {
  day: string;
  lessons_completed: number;
  exercises: number;
  correct: number;
  reviews: number;
  writing: number;
}

interface DialogueRow {
  dialogue_slug: string;
  turn_index: number;
  correct: number;
  answered: number;
  wrong_on_turn: number;
  completed_at: string | null;
  updated_at: string;
}

interface UserRow {
  id: string;
  username: string;
  created_at: string;
  weekly_goal: number;
  username_chosen: number;
  updated_at: string;
}

export interface CompactCode {
  code: string;
  /** Quanti caratteri ha: dice se un QR lo contiene. */
  chars: number;
  lessons: number;
  cards: number;
  compressed: boolean;
}

export async function encodeCompact(db: Db, userId: string): Promise<CompactCode> {
  const user = db
    .prepare(
      `SELECT id, username, created_at, weekly_goal, username_chosen, updated_at
         FROM users WHERE id = ?`,
    )
    .get(userId) as UserRow | undefined;
  if (!user) throw new TransferError('Profilo inesistente.');

  const now = new Date().toISOString();

  const lessons = db
    .prepare(
      `SELECT course_slug, lesson_id, state, best_score, attempts, updated_at, completed_at
         FROM lesson_progress WHERE user_id = ? ORDER BY course_slug, lesson_id`,
    )
    .all(userId) as unknown as CompactRow[];

  const cards = db
    .prepare(
      `SELECT course_slug, item_id, ease, interval_days, reps, lapses, grade, due_at
         FROM srs_cards WHERE user_id = ? ORDER BY course_slug, item_id`,
    )
    .all(userId) as unknown as CardRow[];

  const days = db
    .prepare(
      `SELECT day, lessons_completed, exercises, correct, reviews, writing
         FROM daily_stats WHERE user_id = ? ORDER BY day`,
    )
    .all(userId) as unknown as DayRow[];

  const dialogues = db
    .prepare(
      `SELECT dialogue_slug, turn_index, correct, answered, wrong_on_turn, completed_at, updated_at
         FROM dialogue_progress WHERE user_id = ? ORDER BY dialogue_slug`,
    )
    .all(userId) as unknown as DialogueRow[];

  const payload: CompactPayload = {
    v: PAYLOAD_VERSION,
    e: now,
    u: [
      user.id,
      user.username,
      user.created_at,
      Number(user.weekly_goal),
      Number(user.username_chosen),
      user.updated_at || user.created_at,
    ],
    l: lessons.map((row) => [
      row.course_slug,
      row.lesson_id,
      STATE_CODES[row.state] ?? 'i',
      row.best_score === null ? null : Number(row.best_score),
      Number(row.attempts),
      stamp(row.updated_at) ?? stamp(now)!,
      stamp(row.completed_at),
    ]),
    c: cards.map((row) => [
      row.course_slug,
      row.item_id,
      Math.round(Number(row.ease) * 100),
      Number(row.interval_days),
      Number(row.reps),
      Number(row.lapses),
      row.grade === null ? null : Number(row.grade),
      stamp(row.due_at) ?? stamp(now)!,
    ]),
    d: days.map((row) => [
      row.day,
      Number(row.lessons_completed),
      Number(row.exercises),
      Number(row.correct),
      Number(row.reviews),
      Number(row.writing),
    ]),
    g: dialogues.map((row) => [
      row.dialogue_slug,
      Number(row.turn_index),
      Number(row.correct),
      Number(row.answered),
      Number(row.wrong_on_turn),
      stamp(row.completed_at),
      stamp(row.updated_at) ?? stamp(now)!,
    ]),
  };

  const text = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text);
  const packed = await deflate(bytes);
  const payloadText = packed
    ? `${PREFIX}z${bytesToBase64Url(packed)}`
    : `${PREFIX}r${bytesToBase64Url(bytes)}`;

  return {
    code: payloadText,
    chars: payloadText.length,
    lessons: lessons.length,
    cards: cards.length,
    compressed: packed !== null,
  };
}

/** Il testo di una carta viene dal corso, non dal codice: è uguale ovunque. */
function cardFromCurriculum(
  userId: string,
  courseSlug: string,
  itemId: string,
  values: {
    ease: number;
    intervalDays: number;
    reps: number;
    lapses: number;
    grade: number | null;
    dueAt: string;
    updatedAt: string;
  },
): TransferCard | null {
  const separator = itemId.indexOf(':');
  if (separator <= 0) return null;

  const lessonId = itemId.slice(0, separator);
  const ko = itemId.slice(separator + 1);
  const course = getCourse(courseSlug);
  const item = course ? findLesson(course, lessonId)?.vocab.find((word) => word.ko === ko) : undefined;

  return {
    // L'id non è nel codice: qui la carta non esiste ancora, e ne serve uno
    // nuovo. Il merge la riconosce dall'item, non dall'id; il profilo entra
    // nell'id perché due studenti possono importare lo stesso codice sullo
    // stesso dispositivo senza pestarsi i piedi.
    id: `compact-${userId}-${courseSlug}-${itemId}`,
    courseSlug,
    lessonId,
    itemId,
    front: item?.ko ?? ko,
    back: item?.it ?? '',
    hint: item?.rr ?? null,
    ease: values.ease,
    intervalDays: values.intervalDays,
    reps: values.reps,
    lapses: values.lapses,
    grade: values.grade,
    dueAt: values.dueAt,
    createdAt: values.updatedAt,
    updatedAt: values.updatedAt,
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Rilegge il codice e ne fa lo stesso bundle del file: così l'anteprima,
 * l'unione e il riepilogo sono gli stessi, e non ci sono due strade da tenere
 * d'accordo.
 */
export async function decodeCompact(code: string): Promise<TransferBundle> {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!trimmed.startsWith(PREFIX)) {
    throw new TransferError('Questo non è un codice di trasferimento di CiaoCorea.');
  }

  const mode = trimmed.charAt(PREFIX.length);
  const body = trimmed.slice(PREFIX.length + 1);
  if (body.length === 0) throw new TransferError('Il codice è vuoto.');

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(body);
  } catch {
    throw new TransferError('Il codice è rovinato: ricopialo per intero.');
  }

  if (mode === 'z') {
    const inflated = await inflate(bytes);
    if (!inflated) {
      throw new TransferError(
        'Questo browser non riesce a decomprimere il codice. Usa il file JSON.',
      );
    }
    bytes = inflated;
  } else if (mode !== 'r') {
    throw new TransferError('Versione del codice non riconosciuta.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new TransferError('Il codice non contiene dati leggibili: forse è troncato.');
  }

  const payload = parsed as Partial<CompactPayload>;
  if (payload.v !== PAYLOAD_VERSION) {
    throw new TransferError('Il codice viene da una versione diversa di CiaoCorea.');
  }

  const exportedAt = asString(payload.e, new Date().toISOString());
  const user = asArray(payload.u);
  const id = asString(user[0]);
  const username = asString(user[1]);
  if (id.length < 8 || username.length === 0) {
    throw new TransferError('Il codice non contiene un profilo valido.');
  }

  const profile: TransferProfile = {
    user: {
      id,
      username,
      createdAt: asString(user[2], exportedAt),
      weeklyGoal: Math.min(7, Math.max(1, asNumber(user[3], 5))),
      usernameChosen: asNumber(user[4], 0) === 1,
      updatedAt: asString(user[5], exportedAt),
    },
    lessons: asArray(payload.l).map((entry) => {
      const row = asArray(entry);
      return {
        courseSlug: asString(row[0]),
        lessonId: asString(row[1]),
        state: CODE_STATES[asString(row[2])] ?? 'in_progress',
        bestScore: asNullableNumber(row[3]),
        attempts: Math.max(0, Math.trunc(asNumber(row[4]))),
        updatedAt: unstamp(row[5], exportedAt),
        completedAt: typeof row[6] === 'string' ? unstamp(row[6], exportedAt) : null,
      };
    }),
    cards: asArray(payload.c)
      .map((entry) => {
        const row = asArray(entry);
        const courseSlug = asString(row[0]);
        const itemId = asString(row[1]);
        const card = cardFromCurriculum(id, courseSlug, itemId, {
          ease: asNumber(row[2], 250) / 100,
          intervalDays: Math.max(0, Math.trunc(asNumber(row[3]))),
          reps: Math.max(0, Math.trunc(asNumber(row[4]))),
          lapses: Math.max(0, Math.trunc(asNumber(row[5]))),
          grade: asNullableNumber(row[6]),
          dueAt: unstamp(row[7], exportedAt),
          updatedAt: exportedAt,
        });
        return card;
      })
      .filter((card): card is TransferCard => card !== null),
    days: asArray(payload.d).map((entry) => {
      const row = asArray(entry);
      return {
        day: asString(row[0]),
        lessonsCompleted: Math.max(0, Math.trunc(asNumber(row[1]))),
        exercises: Math.max(0, Math.trunc(asNumber(row[2]))),
        correct: Math.max(0, Math.trunc(asNumber(row[3]))),
        reviews: Math.max(0, Math.trunc(asNumber(row[4]))),
        writing: Math.max(0, Math.trunc(asNumber(row[5]))),
      };
    }),
    dialogues: asArray(payload.g).map((entry) => {
      const row = asArray(entry);
      return {
        dialogueSlug: asString(row[0]),
        turnIndex: Math.max(0, Math.trunc(asNumber(row[1]))),
        correct: Math.max(0, Math.trunc(asNumber(row[2]))),
        answered: Math.max(0, Math.trunc(asNumber(row[3]))),
        wrongOnTurn: Math.max(0, Math.trunc(asNumber(row[4]))),
        completedAt: typeof row[5] === 'string' ? unstamp(row[5], exportedAt) : null,
        updatedAt: unstamp(row[6], exportedAt),
      };
    }),
    attempts: [],
    writing: [],
    mistakes: [],
    tombstones: [],
  };

  // Il codice non porta un checksum: la carta che lo legge deve comunque
  // passare dalla stessa normalizzazione del file, così i due percorsi non
  // possono divergere. Il checksum viene calcolato lì, sui dati già puliti.
  return parseBundle({
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt,
    schema: '011-transfer',
    profiles: [profile],
    checksum: '',
  });
}

