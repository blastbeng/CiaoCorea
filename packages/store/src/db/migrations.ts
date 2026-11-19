import type { Db } from './client';

export interface Migration {
  id: string;
  sql: string;
}

/**
 * Migrazioni numerate e idempotenti, applicate in transazione. Sono SQL puro
 * perché uno schema che si legge in un file è più facile da verificare di uno
 * costruito a runtime da dieci funzioni annidate.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: '001-initial',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user_idx ON sessions(user_id);

      CREATE TABLE lesson_progress (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        state TEXT NOT NULL,
        best_score INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        PRIMARY KEY (user_id, course_slug, lesson_id)
      );

      CREATE TABLE attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        score INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        total INTEGER NOT NULL,
        duration_ms INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE INDEX attempts_user_idx ON attempts(user_id, created_at);

      CREATE TABLE srs_cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        hint TEXT,
        ease REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        grade INTEGER,
        due_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, course_slug, item_id)
      );
      CREATE INDEX srs_due_idx ON srs_cards(user_id, due_at);

      CREATE TABLE daily_stats (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        lessons_completed INTEGER NOT NULL DEFAULT 0,
        exercises INTEGER NOT NULL DEFAULT 0,
        correct INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
      );
    `,
  },
  {
    id: '002-dialogues',
    sql: `
      CREATE TABLE dialogue_progress (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        dialogue_slug TEXT NOT NULL,
        turn_index INTEGER NOT NULL DEFAULT 0,
        correct INTEGER NOT NULL DEFAULT 0,
        answered INTEGER NOT NULL DEFAULT 0,
        wrong_on_turn INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, dialogue_slug)
      );
    `,
  },
  {
    id: '004-study-plan',
    sql: `
      -- Un giorno di studio vale anche se passerà solo dai ripassi: senza questa
      -- colonna, chi ripassa le parole e non tocca lezioni perde lo streak.
      ALTER TABLE daily_stats ADD COLUMN reviews INTEGER NOT NULL DEFAULT 0;
      -- L'obiettivo settimanale è dello studente, non del corso: se lo sceglie
      -- lui, il piano della giornata diventa una cosa sua e non un rimprovero.
      ALTER TABLE users ADD COLUMN weekly_goal INTEGER NOT NULL DEFAULT 5;
    `,
  },
  {
    id: '005-writing',
    sql: `
      -- Il quaderno. Un testo libero non si corregge automaticamente: si tiene
      -- ogni prova, perché rivedere come è cambiata la stessa frase è il modo
      -- più onesto di misurare la scrittura.
      CREATE TABLE writing_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        prompt_id TEXT NOT NULL,
        course_slug TEXT NOT NULL,
        text TEXT NOT NULL,
        verdict TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX writing_entries_user_idx ON writing_entries(user_id, created_at);

      -- Scrivere è studiare: senza questa colonna un giorno passato al quaderno
      -- non conterebbe né per lo streak né per l'obiettivo della settimana.
      ALTER TABLE daily_stats ADD COLUMN writing INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: '006-mistakes',
    sql: `
      -- La banca degli errori. Una riga per esercizio sbagliato: se lo studente
      -- ci ricasca, il conto sale, così "sbagliato due volte" non si confonde
      -- con una distrazione. Azzeccarlo lo toglie dalla banca.
      CREATE TABLE exercise_mistakes (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL,
        course_slug TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        wrong_count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_wrong_at TEXT NOT NULL,
        PRIMARY KEY (user_id, exercise_id)
      );
      CREATE INDEX exercise_mistakes_user_idx ON exercise_mistakes(user_id, last_wrong_at);
    `,
  },
  {
    id: '007-local-profiles',
    sql: `
      -- Niente più password: chi apre il sito è già dentro, e il nome che
      -- distingue i profili sullo stesso computer è generato, non scelto.
      -- L'email diventa username e password_hash se ne va. SQLite non sa
      -- togliere una colonna, quindi la tabella si ricostruisce: le righe, e le
      -- sessioni e i progressi che puntano a quegli id, restano al loro posto.
      CREATE TABLE users_next (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        weekly_goal INTEGER NOT NULL DEFAULT 5
      );

      -- Chi si era registrato con un'email si ritrova un nome leggibile: la
      -- parte prima della chiocciola, se nessun altro profilo la rivendica.
      -- Quando due email condividono la stessa parte vince il profilo più
      -- vecchio, perché è quello che l'utente ha aperto per primo; l'altro
      -- tiene l'email intera, che è comunque unica.
      INSERT INTO users_next (id, username, display_name, created_at, weekly_goal)
        SELECT
          u.id,
          CASE
            WHEN instr(u.email, '@') > 1
             AND NOT EXISTS (
               SELECT 1 FROM users u2
               WHERE lower(substr(u2.email, 1, instr(u2.email, '@') - 1)) =
                     lower(substr(u.email, 1, instr(u.email, '@') - 1))
                 AND u2.id <> u.id
                 AND (
                   u2.created_at < u.created_at
                   OR (u2.created_at = u.created_at AND u2.id < u.id)
                 )
             )
            THEN substr(u.email, 1, instr(u.email, '@') - 1)
            ELSE u.email
          END,
          u.display_name,
          u.created_at,
          u.weekly_goal
        FROM users u;

      DROP TABLE users;
      ALTER TABLE users_next RENAME TO users;
    `,
  },
];

export function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id),
  );

  // La 007 ricostruisce `users` con un DROP TABLE. Con i vincoli accesi SQLite
  // tratta il drop come una DELETE e si porta via per cascata sessioni,
  // progressi e tentativi: esattamente quello che una migrazione non deve fare.
  // Le migrazioni girano a database fermo, quindi i vincoli restano spenti per
  // la durata del lavoro e si riaccendono subito dopo.
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      db.exec('BEGIN');
      try {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations(id, applied_at) VALUES (?, ?)').run(
          migration.id,
          new Date().toISOString(),
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
