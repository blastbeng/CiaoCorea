import type { Db } from '../db/client';

/**
 * Quello che il server leggeva dalla configurazione d'ambiente e che qui è
 * semplicemente una scelta del portale. Con le password andate via è rimasto
 * un solo numero: quanto deve vivere il token che dice quale profilo è aperto.
 */
export interface StoreConfig {
  /** Giorni di validità della sessione, rinnovati a ogni uso. */
  sessionDays: number;
}

export interface Ctx {
  db: Db;
  config: StoreConfig;
}

export const DEFAULT_CONFIG: StoreConfig = {
  // Un profilo locale non ha niente da difendere da un intruso: la sessione
  // lunga è una comodità, non un rischio, e un browser che si riapre dopo un
  // mese deve ritrovare il proprio studente dentro.
  sessionDays: 365,
};
