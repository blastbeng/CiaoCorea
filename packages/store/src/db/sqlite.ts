import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

/**
 * L'adattatore minimo che serve al codice del server: `exec`, `prepare`, con
 * `all`/`get`/`run`. Non è un ORM e non vuole esserlo — le query sono le stesse
 * che giravano su `node:sqlite`, e il giorno in cui questo database tornerà su
 * un server non ci sarà niente da riscrivere.
 */

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Statement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): RunResult;
}

/** SQLite accetta solo questi tipi: `undefined` e i booleani si normalizzano. */
function bindable(params: readonly unknown[]): Array<number | string | null | Uint8Array> {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number' || typeof value === 'string') return value;
    if (value instanceof Uint8Array) return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error(`Parametro non supportato: ${typeof value}`);
  });
}

export class SqliteDb {
  constructor(private readonly db: Database) {}

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): Statement {
    const run = (...params: readonly unknown[]): RunResult => {
      const statement = this.db.prepare(sql);
      try {
        const values = bindable(params);
        if (values.length > 0) statement.bind(values);
        statement.step();
      } finally {
        statement.free();
      }

      const changes = this.db.getRowsModified();
      const row = this.db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0];
      return { changes, lastInsertRowid: Number(row ?? 0) };
    };

    const rows = (params: readonly unknown[]): Array<Record<string, unknown>> => {
      const statement = this.db.prepare(sql);
      const result: Array<Record<string, unknown>> = [];
      try {
        const values = bindable(params);
        if (values.length > 0) statement.bind(values);
        while (statement.step()) result.push(statement.getAsObject());
      } finally {
        statement.free();
      }
      return result;
    };

    return {
      all: (...params) => rows(params),
      get: (...params) => rows(params)[0],
      run,
    };
  }

  /** I byte del database: è così che il file sopravvive a un reload. */
  exportBytes(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}

export interface OpenDatabaseOptions {
  /** URL del wasm: nel bundle Vite è un asset con l'hash nel nome. */
  wasmUrl?: string;
  /** Byte di un database già esistente. */
  bytes?: Uint8Array;
}

const runtimes = new Map<string, Promise<SqlJsStatic>>();

/**
 * Il wasm si carica una volta per scheda. In Node (i test) `initSqlJs` trova il
 * file accanto a sé, nel browser serve l'URL che gli passa il chiamante.
 */
function loadRuntime(wasmUrl?: string): Promise<SqlJsStatic> {
  const key = wasmUrl ?? '';
  const cached = runtimes.get(key);
  if (cached) return cached;

  const options = wasmUrl
    ? {
        locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
      }
    : undefined;

  const loading = initSqlJs(options);
  runtimes.set(key, loading);
  // Un caricamento fallito non deve restare in cache: il secondo tentativo
  // deve poter riuscire (rete torna, asset corretto dopo un deploy).
  loading.catch(() => runtimes.delete(key));
  return loading;
}

export async function openSqlite(options: OpenDatabaseOptions = {}): Promise<SqliteDb> {
  const SQL = await loadRuntime(options.wasmUrl);
  const db = options.bytes ? new SQL.Database(options.bytes) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  return new SqliteDb(db);
}
