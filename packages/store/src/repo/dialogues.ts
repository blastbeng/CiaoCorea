import { randomUuid } from '../crypto/random';
import type { Dialogue } from '@ciaocorea/shared';
import { getDialogues } from '@ciaocorea/curriculum';
import { countAnswerTurns } from '@ciaocorea/engine';
import type { Db } from '../db/client';
import { nowIso, todayIso } from '../db/client';
import { isLessonClosed } from './progress';

/**
 * Il progresso di un dialogo è una sola riga per utente: dove siamo arrivati,
 * quante battute sono passate al primo colpo e quanti errori abbiamo fatto
 * sulla battuta corrente. Non serve uno storico: qui conta riprendere.
 */
export interface DialogueProgress {
  turnIndex: number;
  correct: number;
  answered: number;
  wrongOnTurn: number;
  completedAt: string | null;
}

interface Row {
  turn_index: number;
  correct: number;
  answered: number;
  wrong_on_turn: number;
  completed_at: string | null;
}

const EMPTY: DialogueProgress = {
  turnIndex: 0,
  correct: 0,
  answered: 0,
  wrongOnTurn: 0,
  completedAt: null,
};

export function getDialogueProgress(db: Db, userId: string, slug: string): DialogueProgress {
  const row = db
    .prepare(
      `SELECT turn_index, correct, answered, wrong_on_turn, completed_at
       FROM dialogue_progress WHERE user_id = ? AND dialogue_slug = ?`,
    )
    .get(userId, slug) as Row | undefined;

  if (!row) return { ...EMPTY };

  return {
    turnIndex: Number(row.turn_index),
    correct: Number(row.correct),
    answered: Number(row.answered),
    wrongOnTurn: Number(row.wrong_on_turn),
    completedAt: row.completed_at,
  };
}

export function listDialogueProgress(db: Db, userId: string): Map<string, DialogueProgress> {
  const rows = db
    .prepare(
      `SELECT dialogue_slug, turn_index, correct, answered, wrong_on_turn, completed_at
       FROM dialogue_progress WHERE user_id = ?`,
    )
    .all(userId) as unknown as Array<Row & { dialogue_slug: string }>;

  return new Map(
    rows.map((row) => [
      row.dialogue_slug,
      {
        turnIndex: Number(row.turn_index),
        correct: Number(row.correct),
        answered: Number(row.answered),
        wrongOnTurn: Number(row.wrong_on_turn),
        completedAt: row.completed_at,
      },
    ]),
  );
}

export function saveDialogueProgress(
  db: Db,
  userId: string,
  slug: string,
  progress: DialogueProgress,
): void {
  db.prepare(
    `INSERT INTO dialogue_progress(user_id, dialogue_slug, turn_index, correct, answered,
                                   wrong_on_turn, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, dialogue_slug) DO UPDATE SET
       turn_index = excluded.turn_index,
       correct = excluded.correct,
       answered = excluded.answered,
       wrong_on_turn = excluded.wrong_on_turn,
       completed_at = excluded.completed_at,
       updated_at = excluded.updated_at`,
  ).run(
    userId,
    slug,
    progress.turnIndex,
    progress.correct,
    progress.answered,
    progress.wrongOnTurn,
    progress.completedAt,
    nowIso(),
  );
}

export function restartDialogue(db: Db, userId: string, slug: string): void {
  db.prepare('DELETE FROM dialogue_progress WHERE user_id = ? AND dialogue_slug = ?').run(
    userId,
    slug,
  );
}

/**
 * Il primo dialogo che lo studente può recitare e non ha ancora finito: è la
 * proposta per i giorni in cui non c'è né lezione né ripasso. Un dialogo legato
 * a una lezione si propone solo dopo quella lezione, e uno finito non torna: la
 * proposta deve essere lavoro nuovo, non un déjà vu.
 */
export function nextOpenDialogue(db: Db, userId: string): { slug: string; title: string } | null {
  const progress = listDialogueProgress(db, userId);

  for (const dialogue of getDialogues()) {
    if (
      dialogue.after &&
      !isLessonClosed(db, userId, dialogue.after.courseSlug, dialogue.after.lessonId)
    ) {
      continue;
    }

    const total = countAnswerTurns(dialogue.turns);
    if (total === 0) continue;

    const done = progress.get(dialogue.slug);
    if (done && (done.completedAt !== null || done.answered >= total)) continue;

    return { slug: dialogue.slug, title: dialogue.title };
  }

  return null;
}

/**
 * Le battute di un dialogo completato diventano card di ripasso: è lo stesso
 * meccanismo delle lezioni, così la coda dei ripassi non si sdoppia.
 */
export function collectDialoguePhrases(
  db: Db,
  userId: string,
  dialogue: Dialogue,
  now: Date = new Date(),
): number {
  const timestamp = now.toISOString();
  const day = todayIso(now);
  let created = 0;

  for (const turn of dialogue.turns) {
    const result = db
      .prepare(
        `INSERT INTO srs_cards(id, user_id, course_slug, lesson_id, item_id, front, back, hint,
                               ease, interval_days, reps, lapses, due_at, created_at, updated_at)
         VALUES (?, ?, 'dialoghi', ?, ?, ?, ?, NULL, 2.5, 0, 0, 0, ?, ?, ?)
         ON CONFLICT(user_id, course_slug, item_id) DO NOTHING`,
      )
      .run(
        randomUuid(),
        userId,
        dialogue.slug,
        `${dialogue.slug}:${turn.id}`,
        turn.ko,
        turn.it,
        day,
        timestamp,
        timestamp,
      );
    created += Number(result.changes ?? 0);
  }

  return created;
}
