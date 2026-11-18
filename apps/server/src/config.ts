import path from 'node:path';
import { z } from 'zod';
import { normalizeInviteCode } from './auth/codes';

/**
 * Tutta la configurazione passa da qui: un valore sbagliato deve fermare il
 * server all'avvio, non trasformarsi in un bug tre richieste dopo.
 */
/**
 * Una variabile d'ambiente presente ma vuota («KEY=» in un file di secrets) è
 * «non settata»: deve valere il default, non far fallire la validazione e
 * quindi l'avvio del server.
 */
const blankToUndefined = (schema: z.ZodString) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATA_DIR: z.string().min(1).default('./data'),
  WEB_DIST: z.string().optional(),
  COOKIE_SECURE: z.enum(['0', '1']).default('0'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  // closed: nessuno si iscrive (si crea tutto da CLI).
  // invite: serve un codice, creato con `npm run accounts -- invite:new`.
  // open: chiunque può iscriversi, senza codice (solo per servizi pubblici).
  REGISTRATION_MODE: z.enum(['closed', 'invite', 'open']).default('closed'),
  // Codice "madre" d'emergenza, messo nei secrets: si usa la prima volta che
  // si apre un corso, prima di avere inviti nel database.
  REGISTRATION_CODE: blankToUndefined(z.string().trim().min(4).max(64)),
  // Non per forza un'email: l'unico account può accedere con un nome utente.
  SEED_USER_EMAIL: blankToUndefined(z.string().trim().min(2).max(120)),
  SEED_USER_PASSWORD: blankToUndefined(z.string().min(8)),
  SEED_USER_NAME: blankToUndefined(z.string().min(1)),
});

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  host: string;
  port: number;
  dataDir: string;
  databaseFile: string;
  webDist: string;
  cookieSecure: boolean;
  sessionDays: number;
  loginMaxAttempts: number;
  loginWindowMs: number;
  registrationMode: 'closed' | 'invite' | 'open';
  /** Codice madre normalizzato, o null: gli inviti normali stanno in DB. */
  registrationCode: string | null;
  seed: { email: string; password: string; displayName: string } | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configurazione non valida:\n${details}`);
  }

  const value = parsed.data;
  const dataDir = path.resolve(value.DATA_DIR);
  const seed =
    value.SEED_USER_EMAIL && value.SEED_USER_PASSWORD
      ? {
          email: value.SEED_USER_EMAIL.trim().toLowerCase(),
          password: value.SEED_USER_PASSWORD,
          displayName: value.SEED_USER_NAME?.trim() || 'Studente',
        }
      : null;

  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    dataDir,
    databaseFile: path.join(dataDir, 'ciaocorea.db'),
    webDist: path.resolve(value.WEB_DIST ?? 'apps/web/dist'),
    cookieSecure: value.COOKIE_SECURE === '1',
    sessionDays: value.SESSION_DAYS,
    loginMaxAttempts: value.LOGIN_MAX_ATTEMPTS,
    loginWindowMs: value.LOGIN_WINDOW_MINUTES * 60_000,
    registrationMode: value.REGISTRATION_MODE,
    registrationCode: value.REGISTRATION_CODE ? normalizeInviteCode(value.REGISTRATION_CODE) : null,
    seed,
  };
}
