import { migrate } from './migrations';
import { openSqlite, type OpenDatabaseOptions, type SqliteDb } from './sqlite';

export type Db = SqliteDb;

/**
 * Apre il database nella scheda. Il percorso del server (`data/ciaocorea.db`)
 * non esiste più: i byte arrivano da IndexedDB, oppure da niente e si parte da
 * un database vuoto con le migrazioni già applicate.
 */
export async function openDb(options: OpenDatabaseOptions = {}): Promise<Db> {
  const db = await openSqlite(options);
  migrate(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
