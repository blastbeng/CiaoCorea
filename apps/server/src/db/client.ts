import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './migrations';

export type Db = DatabaseSync;

/**
 * SQLite in WAL: letture concorrenti mentre si scrive, che è esattamente il
 * carico di un'app di studio (un utente che risponde, il resto che legge).
 * `node:sqlite` è nel runtime, quindi niente compilazione nativa in Docker.
 */
export function openDb(file: string): Db {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
