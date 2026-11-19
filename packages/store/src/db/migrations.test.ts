import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from './migrations';
import { openSqlite, type SqliteDb } from './sqlite';

/**
 * La 007 è l'unica migrazione che riscrive una tabella esistente: chi aveva un
 * profilo con email e password deve ritrovarsi dentro senza perdere progressi,
 * sessioni o id. Questo test costruisce un database "vecchio", lo migra e
 * controlla cosa resta in piedi.
 */

async function legacyDb(): Promise<SqliteDb> {
  const db = await openSqlite();
  db.exec(`
    CREATE TABLE schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    if (migration.id === '007-local-profiles') break;
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_migrations(id, applied_at) VALUES (?, ?)').run(
      migration.id,
      '2026-01-01T00:00:00.000Z',
    );
  }

  db.exec(`
    INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES
      ('user-marco', 'marco@example.com', 'Marco', 'hash-1', '2025-01-01T00:00:00.000Z'),
      ('user-giulia', 'giulia@example.com', 'Giulia', 'hash-2', '2025-01-02T00:00:00.000Z'),
      ('user-omonimo', 'marco@other.com', 'Un altro Marco', 'hash-3', '2025-01-03T00:00:00.000Z'),
      ('user-maiuscole', 'Anna@Example.com', 'Anna', 'hash-4', '2025-01-04T00:00:00.000Z'),
      ('user-anna', 'anna@altro.it', 'Anna Due', 'hash-5', '2025-01-05T00:00:00.000Z');

    INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
      VALUES ('session-marco', 'user-marco', 'token-1', '2026-01-01T00:00:00.000Z',
              '2026-01-02T00:00:00.000Z', '2027-01-01T00:00:00.000Z');

    INSERT INTO lesson_progress (user_id, course_slug, lesson_id, state, best_score, attempts, updated_at, completed_at)
      VALUES ('user-marco', 'coreano-base', 'lezione-1', 'passed', 90, 2,
              '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
  `);
  db.prepare("UPDATE users SET weekly_goal = 7 WHERE id = 'user-marco'").run();

  return db;
}

describe('migrazione 007: dai profili con email ai profili locali', () => {
  it('trasforma l’email in username e toglie la password', async () => {
    const db = await legacyDb();
    migrate(db);

    const columns = (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    );
    expect(columns).toEqual([
      'id',
      'username',
      'display_name',
      'created_at',
      'weekly_goal',
      'username_chosen',
    ]);

    const rows = db
      .prepare('SELECT id, username, display_name, weekly_goal FROM users ORDER BY created_at')
      .all() as Array<{ id: string; username: string; display_name: string; weekly_goal: number }>;

    // Nome e nome utente sono la stessa cosa: la 010 riallinea la copia che i
    // database con due campi separati si portavano dietro.
    expect(rows).toEqual([
      { id: 'user-marco', username: 'marco', display_name: 'marco', weekly_goal: 7 },
      { id: 'user-giulia', username: 'giulia', display_name: 'giulia', weekly_goal: 5 },
      // Stessa parte prima della chiocciola: la tiene il profilo più vecchio,
      // l'altro si riprende l'email intera.
      {
        id: 'user-omonimo',
        username: 'marco@other.com',
        display_name: 'marco@other.com',
        weekly_goal: 5,
      },
      // Anche il confronto ignorando le maiuscole conta come omonimia.
      { id: 'user-maiuscole', username: 'Anna', display_name: 'Anna', weekly_goal: 5 },
      { id: 'user-anna', username: 'anna@altro.it', display_name: 'anna@altro.it', weekly_goal: 5 },
    ]);
  });

  it('lascia i profili migrati come nomi mai scelti', async () => {
    const db = await legacyDb();
    migrate(db);

    // Nessuno di loro ha mai deciso uno username: il promemoria ha senso.
    const rows = db.prepare('SELECT username_chosen FROM users').all() as Array<{
      username_chosen: number;
    }>;
    expect(rows.every((row) => row.username_chosen === 0)).toBe(true);
  });

  it('non si porta dietro progressi e sessioni', async () => {
    const db = await legacyDb();
    migrate(db);

    const progress = db
      .prepare('SELECT user_id, lesson_id, state, best_score FROM lesson_progress')
      .all();
    expect(progress).toEqual([
      { user_id: 'user-marco', lesson_id: 'lezione-1', state: 'passed', best_score: 90 },
    ]);
  });

  it('accorcia gli username rimasti con l’email quando il nome è libero', async () => {
    const db = await legacyDb();
    migrate(db);

    // Come lasciava il database la prima versione della 007: email intere.
    db.prepare("DELETE FROM schema_migrations WHERE id = '008-tidy-legacy-usernames'").run();
    db.exec(`
      UPDATE users SET username = CASE id
        WHEN 'user-marco' THEN 'marco@example.com'
        WHEN 'user-giulia' THEN 'giulia@example.com'
        WHEN 'user-omonimo' THEN 'marco@other.com'
        WHEN 'user-maiuscole' THEN 'Anna@Example.com'
        WHEN 'user-anna' THEN 'anna@altro.it'
      END;

      INSERT INTO users (id, username, display_name, created_at, weekly_goal) VALUES
        ('user-paolo', 'paolo', 'Paolo', '2025-02-01T00:00:00.000Z', 5),
        ('user-paolo-email', 'paolo@example.com', 'Paolo Due', '2025-02-02T00:00:00.000Z', 5);
    `);

    migrate(db);

    const usernames = db
      .prepare('SELECT username FROM users ORDER BY created_at')
      .all()
      .map((row) => (row as { username: string }).username);

    expect(usernames).toEqual([
      // Due profili rivendicano "marco": l'email resta a entrambi.
      'marco@example.com',
      // Nessun conflitto: il nome si accorcia.
      'giulia',
      'marco@other.com',
      'Anna@Example.com',
      'anna@altro.it',
      // "paolo" è già di qualcun altro: non glielo si porta via.
      'paolo',
      'paolo@example.com',
    ]);
  });

  it('riaccende i vincoli di chiave esterna quando ha finito', async () => {
    const db = await legacyDb();
    migrate(db);

    expect(() =>
      db
        .prepare(
          `INSERT INTO lesson_progress (user_id, course_slug, lesson_id, state, updated_at)
           VALUES ('user-fantasma', 'coreano-base', 'lezione-1', 'passed', '2026-01-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow();
  });

  it('registra la migrazione come applicata e non la ripete', async () => {
    const db = await legacyDb();
    migrate(db);
    migrate(db);

    const applied = db
      .prepare("SELECT id FROM schema_migrations WHERE id = '007-local-profiles'")
      .all();
    expect(applied).toHaveLength(1);
  });
});
