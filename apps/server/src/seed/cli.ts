import { loadConfig } from '../config';
import { openDb } from '../db/client';
import { ensureSeedUser } from './bootstrap';

/**
 * `npm run seed:user` — crea lo studente iniziale da .env.
 * Stampa solo l'esito, mai la password.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.seed) {
    console.error('SEED_USER_EMAIL e SEED_USER_PASSWORD non sono impostate: niente da creare.');
    process.exit(1);
  }

  const db = openDb(config.databaseFile);
  try {
    const result = await ensureSeedUser(db, config.seed);
    console.log(
      result.created
        ? `Creato studente ${result.email}`
        : `Studente ${result.email} già presente: password invariata`,
    );
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('Seed fallito:', error);
  process.exit(1);
});
