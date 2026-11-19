import { randomUuid } from '../crypto/random';
import type { SessionUser } from '@ciaocorea/shared';
import { WEEKLY_GOAL_DEFAULT, clampWeeklyGoal } from '@ciaocorea/engine';
import type { Db } from '../db/client';
import { nowIso } from '../db/client';

export interface UserRow {
  id: string;
  /** Il nome generato al primo avvio: unico su questo computer. */
  username: string;
  display_name: string;
  created_at: string;
}

export function findUserByUsername(db: Db, username: string): UserRow | undefined {
  // Il nome è generato, non digitato: non c'è un maiuscole/minuscole da
  // normalizzare come si faceva con le email, e `VeloceTigre42` si legge meglio
  // com'è nato.
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as
    | UserRow
    | undefined;
}

export function findUserById(db: Db, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

/** `true` se il nome è già di un profilo: è la domanda del generatore. */
export function usernameTaken(db: Db, username: string): boolean {
  return findUserByUsername(db, username) !== undefined;
}

export interface NewUser {
  username: string;
  displayName: string;
}

export function createUser(db: Db, user: NewUser): UserRow {
  const row: UserRow = {
    id: randomUuid(),
    username: user.username.trim(),
    display_name: user.displayName.trim(),
    created_at: nowIso(),
  };

  db.prepare('INSERT INTO users(id, username, display_name, created_at) VALUES (?, ?, ?, ?)').run(
    row.id,
    row.username,
    row.display_name,
    row.created_at,
  );

  return row;
}

export function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, username: row.username, displayName: row.display_name };
}

/**
 * Rinominarsi: si tocca solo il nome con cui lo studente vuole essere chiamato.
 * Lo `username` generato resta, perché è quello che distingue i profili quando
 * due persone studiano sullo stesso computer.
 */
export function updateDisplayName(db: Db, userId: string, displayName: string): void {
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName.trim(), userId);
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

export interface LocalAccountRow {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  live_sessions: number;
}

/**
 * I profili che vivono in questo browser: le persone che ci studiano sopra.
 * Sono l'elenco da cui si passa dall'uno all'altro con un clic, e sono tutti
 * già dentro, perché nessuno qui ha mai dovuto dare una password.
 */
export function listLocalAccounts(db: Db): LocalAccountRow[] {
  return db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.created_at,
              (SELECT COUNT(*) FROM sessions s
                WHERE s.user_id = u.id AND s.expires_at > ?) AS live_sessions
         FROM users u
        ORDER BY u.created_at`,
    )
    .all(nowIso()) as unknown as LocalAccountRow[];
}
