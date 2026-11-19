import { sha256Hex } from '../crypto/sha256';
import { randomToken, randomUuid } from '../crypto/random';
import type { SessionUser } from '@ciaocorea/shared';
import type { Db } from '../db/client';

export const SESSION_COOKIE = 'cc_session';

/** Nel database finisce solo l'impronta del token: un dump rubato non vale login. */
function hashToken(token: string): string {
  return sha256Hex(token);
}

export interface CreatedSession {
  token: string;
}

export function createSession(db: Db, userId: string, days: number): CreatedSession {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  db.prepare(
    `INSERT INTO sessions(id, user_id, token_hash, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUuid(),
    userId,
    hashToken(token),
    now.toISOString(),
    now.toISOString(),
    expires.toISOString(),
  );

  return { token };
}

export interface ResolvedSession {
  user: SessionUser;
  sessionId: string;
}

interface SessionJoinRow {
  session_id: string;
  expires_at: string;
  last_seen_at: string;
  user_id: string;
  email: string;
  display_name: string;
}

/**
 * Scadenza scorrevole: chi studia ogni giorno non viene buttato fuori, chi
 * sparisce per trenta giorni deve rifare il login. L'aggiornamento avviene al
 * massimo una volta all'ora per non scrivere a ogni singola richiesta.
 */
export function resolveSession(
  db: Db,
  token: string,
  days: number,
  now: Date = new Date(),
): ResolvedSession | null {
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at,
              u.id AS user_id, u.email, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token)) as SessionJoinRow | undefined;

  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
    return null;
  }

  const expiresAt = new Date(row.expires_at);
  const lastSeen = new Date(row.last_seen_at);
  if (now.getTime() - lastSeen.getTime() > 60 * 60 * 1000) {
    expiresAt.setTime(now.getTime() + days * 24 * 60 * 60 * 1000);
    db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(
      now.toISOString(),
      expiresAt.toISOString(),
      row.session_id,
    );
  }

  return {
    user: { id: row.user_id, email: row.email, displayName: row.display_name },
    sessionId: row.session_id,
  };
}

export function destroySession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

/**
 * Cambio di password: le sessioni aperte altrove cadono, quella che ha chiesto
 * il cambio resta in piedi. Un accesso vecchio non deve sopravvivere alla
 * password che lo studente ha appena chiuso.
 */
export function destroyOtherSessions(db: Db, userId: string, keepToken: string): number {
  const result = db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')
    .run(userId, hashToken(keepToken));
  return Number(result.changes ?? 0);
}

