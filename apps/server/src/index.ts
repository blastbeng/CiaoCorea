import { loadConfig } from './config';
import { openDb } from './db/client';
import { buildApp } from './app';
import { ensureSeedUser } from './seed/bootstrap';
import { purgeExpiredSessions } from './auth/sessions';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.databaseFile);

  const purged = purgeExpiredSessions(db);
  if (purged > 0) console.log(`Sessioni scadute rimosse: ${purged}`);

  if (config.seed) {
    const result = await ensureSeedUser(db, config.seed);
    if (result.created) console.log(`Utente iniziale creato: ${result.email}`);
  }

  const app = await buildApp({ db, config, logger: true });

  const shutdown = async (signal: string) => {
    app.log.info(`Ricevuto ${signal}, chiusura in corso`);
    try {
      await app.close();
      db.close();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`CiaoCorea in ascolto su http://${config.host}:${config.port}`);
}

main().catch((error) => {
  console.error('Avvio fallito:', error);
  process.exit(1);
});
