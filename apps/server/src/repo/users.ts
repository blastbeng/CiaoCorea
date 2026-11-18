import { randomUUID } from 'node:crypto';
import type { SessionUser } from '@ciaocorea/shared';
import { WEEKLY_GOAL_DEFAULT, clampWeeklyGoal } from '@ciaocorea/engine';
import type { Db } from '../db/client';
import { nowIso } from '../db/client';

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export function findUserByEmail(db: Db, email: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as UserRow | undefined;
}

export function findUserById(db: Db, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
}

export function createUser(db: Db, user: NewUser): UserRow {
  const row: UserRow = {
    id: randomUUID(),
    email: user.email.trim().toLowerCase(),
    display_name: user.displayName.trim(),
    password_hash: user.passwordHash,
    role: 'student',
    created_at: nowIso(),
  };

  db.prepare(
    'INSERT INTO users(id, email, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(row.id, row.email, row.display_name, row.password_hash, row.role, row.created_at);

  return row;
}

export function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

/**
 * Obiettivo settimanale dello studente, in giorni di studio su 7. Il default
 * sta nel motore: la colonna può mancare nei database vecchi e il valore deve
 * esserci lo stesso.
 */
export function getWeeklyGoal(db: Db, userId: string): number {
  const row = db
    .prepare('SELECT weekly_goal FROM users WHERE id = ?')
    .get(userId) as { weekly_goal: number } | undefined;
  return row ? clampWeeklyGoal(Number(row.weekly_goal)) : WEEKLY_GOAL_DEFAULT;
}

export function setWeeklyGoal(db: Db, userId: string, goal: number): number {
  const value = clampWeeklyGoal(goal);
  db.prepare('UPDATE users SET weekly_goal = ? WHERE id = ?').run(value, userId);
  return value;
}

/**
 * Cambio password: si scrive solo l'hash. Il vecchio hash è stato verificato
 * prima di arrivare qui, quindi un token rubato non permette di sostituirlo.
 */
export function updatePasswordHash(db: Db, userId: string, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

export interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  sessions: number;
  attempts: number;
}

/**
 * Elenco per chi gestisce il corso: chi c'è, da quanto, quante prove ha fatto.
 * Le sessioni attive contano perché la prima cosa che si chiede, cancellato un
 * account, è "e le sue aperture di sessione?".
 */
export function listAccounts(db: Db): AccountRow[] {
  return db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.created_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS sessions,
              (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id) AS attempts
         FROM users u
        ORDER BY u.created_at`,
    )
    .all() as unknown as AccountRow[];
}

/**
 * Cancella un account. Vanno via anche i suoi progressi (ON DELETE CASCADE):
 * è la richiesta "cancella me e la mia storia", non "disattiva", e per questo
 * la CLI la chiede due volte.
 */
export function deleteAccountByEmail(db: Db, email: string): boolean {
  const result = db.prepare('DELETE FROM users WHERE email = ?').run(email.trim().toLowerCase());
  return Number(result.changes) > 0;
}
