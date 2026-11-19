import { randomUuid } from '../crypto/random';
import type { SessionUser } from '@ciaocorea/shared';
import { WEEKLY_GOAL_DEFAULT, clampWeeklyGoal } from '@ciaocorea/engine';
import type { Db } from '../db/client';
import { nowIso } from '../db/client';

export interface UserRow {
  id: string;
  /** L'unico nome del profilo: unico su questo computer. */
  username: string;
  /** Copia dello username, tenuta per i database e le query più vecchie. */
  display_name: string;
  created_at: string;
  /** 1 quando lo studente ha sostituito il nome generato con uno suo. */
  username_chosen: number;
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

/**
 * `true` se il nome è già di un profilo: è la domanda del generatore, e la
 * stessa che si fa quando lo studente se ne sceglie uno. Il confronto ignora
 * maiuscole e minuscole: `Marco` e `marco` sarebbero due righe che si leggono
 * uguali nell'elenco dei profili.
 */
export function usernameTaken(db: Db, username: string, exceptUserId?: string): boolean {
  const row = db
    .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
    .get(username.trim()) as { id: string } | undefined;
  return row !== undefined && row.id !== exceptUserId;
}

export interface NewUser {
  username: string;
}

export function createUser(db: Db, user: NewUser): UserRow {
  // Nasce con il nome scelto dal portale, non da lui: `username_chosen` lo dice.
  // Nome e nome utente sono la stessa cosa: la colonna `display_name` la tiene
  // allineata per le query che la leggono ancora.
  const createdAt = nowIso();
  const row: UserRow = {
    id: randomUuid(),
    username: user.username.trim(),
    display_name: user.username.trim(),
    created_at: createdAt,
    username_chosen: 0,
  };

  // `updated_at` nasce insieme al profilo: è quello che il trasferimento fra
  // dispositivi confronta per sapere quale nome ha vinto.
  db.prepare(
    `INSERT INTO users(id, username, display_name, created_at, username_chosen, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.username, row.display_name, row.created_at, row.username_chosen, createdAt);

  return row;
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    usernameChosen: Number(row.username_chosen) === 1,
  };
}

/**
 * Scegliersi il nome. Chi ha aperto il sito la prima volta si è trovato
 * `VeloceTigre42` senza averlo chiesto: qui può sostituirlo con qualcosa che
 * sente suo. Nome e nome utente si muovono insieme, perché sono lo stesso nome.
 * L'unicità la controlla la rotta prima di arrivare qui.
 */
export function updateUsername(db: Db, userId: string, username: string): void {
  const name = username.trim();
  db.prepare(
    `UPDATE users SET username = ?, display_name = ?, username_chosen = 1, updated_at = ?
      WHERE id = ?`,
  ).run(name, name, nowIso(), userId);
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
  db.prepare('UPDATE users SET weekly_goal = ?, updated_at = ? WHERE id = ?').run(
    value,
    nowIso(),
    userId,
  );
  return value;
}

export interface LocalAccountRow {
  id: string;
  username: string;
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
      `SELECT u.id, u.username, u.created_at,
              (SELECT COUNT(*) FROM sessions s
                WHERE s.user_id = u.id AND s.expires_at > ?) AS live_sessions
         FROM users u
        ORDER BY u.created_at`,
    )
    .all(nowIso()) as unknown as LocalAccountRow[];
}
