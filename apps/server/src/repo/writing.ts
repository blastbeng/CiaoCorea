import { randomUUID } from 'node:crypto';
import type { WritingEntry, WritingVerdict } from '@ciaocorea/shared';
import type { Db } from '../db/client';
import { todayIso } from '../db/client';

interface EntryRow {
  id: string;
  prompt_id: string;
  text: string;
  verdict: WritingVerdict;
  created_at: string;
}

function toEntry(row: EntryRow): WritingEntry {
  return {
    id: row.id,
    promptId: row.prompt_id,
    text: row.text,
    verdict: row.verdict,
    createdAt: row.created_at,
  };
}

/** Le prove dello studente, dalla più recente: la pagina le raggruppa da sé. */
export function listWritingEntries(db: Db, userId: string, limit = 200): WritingEntry[] {
  const rows = db
    .prepare(
      `SELECT id, prompt_id, text, verdict, created_at FROM writing_entries
       WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as unknown as EntryRow[];

  return rows.map(toEntry);
}

export interface WritingInput {
  userId: string;
  promptId: string;
  courseSlug: string;
  text: string;
  verdict: WritingVerdict;
  now?: Date;
}

/**
 * Salvare una prova e contarla come studio sono la stessa operazione: se la
 * seconda metà fallisse, il quaderno direbbe che lo studente ha scritto e il
 * piano che non ha studiato, che è il tipo di incoerenza che fa smettere.
 */
export function saveWritingEntry(db: Db, input: WritingInput): WritingEntry {
  const now = input.now ?? new Date();
  const entry: WritingEntry = {
    id: randomUUID(),
    promptId: input.promptId,
    text: input.text,
    verdict: input.verdict,
    createdAt: now.toISOString(),
  };

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO writing_entries(id, user_id, prompt_id, course_slug, text, verdict, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.id,
      input.userId,
      input.promptId,
      input.courseSlug,
      entry.text,
      entry.verdict,
      entry.createdAt,
    );

    db.prepare(
      `INSERT INTO daily_stats(user_id, day, writing) VALUES (?, ?, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET writing = daily_stats.writing + 1`,
    ).run(input.userId, todayIso(now));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return entry;
}

/** Quante consegne distinte lo studente ha già provato a scrivere. */
export function countWrittenPrompts(db: Db, userId: string): number {
  const row = db
    .prepare('SELECT COUNT(DISTINCT prompt_id) AS written FROM writing_entries WHERE user_id = ?')
    .get(userId) as { written: number } | undefined;
  return Number(row?.written ?? 0);
}

