import type { Db } from '../db/client';

/**
 * Quello che il server leggeva dalla configurazione d'ambiente e che qui è
 * semplicemente una scelta del portale: non ci sono container da configurare,
 * e i valori che restano sono quelli che decidono il comportamento visibile
 * (quanto dura una sessione, quanti tentativi di password prima di fermarsi).
 */
export interface StoreConfig {
  /** Giorni di validità di una sessione, rinnovati a ogni uso. */
  sessionDays: number;
  loginMaxAttempts: number;
  loginWindowMs: number;
}

export interface Ctx {
  db: Db;
  config: StoreConfig;
}

export const DEFAULT_CONFIG: StoreConfig = {
  sessionDays: 365,
  loginMaxAttempts: 8,
  loginWindowMs: 15 * 60_000,
};
