/**
 * Ripetizione spaziata volutamente semplice: tre soli giudizi
 * (0 = da rivedere, 1 = giusto, 2 = facile). La versione completa di SM-2
 * chiede allo studente di giudicare il proprio ricordo su sei livelli, cosa che
 * chi studia da solo sbaglia sistematicamente. Tre pulsanti sono onesti.
 */

import type { ReviewDirection } from '@ciaocorea/shared';

export type SrsGrade = 0 | 1 | 2;

/**
 * Una parola si legge prima e si scrive dopo. Il riconoscimento è la scala che
 * porta alla produzione: chiedere di scrivere una parola mai vista vorrebbe
 * dire dettare, non ripassare.
 */
export const WRITE_AFTER_REPS = 2;

/** Solo parole di sole sillabe: i jamo sciolti e le frasi non si scrivono a memoria. */
const WRITABLE_WORD = /^[가-힣]+$/u;

/**
 * La direzione con cui la carta torna oggi. Da `read` a `write` si passa con
 * due ripassi andati bene; un errore riporta i `reps` a zero e quindi la parola
 * torna a farsi leggere, che è il punto giusto da cui ricominciare.
 */
export function reviewDirection(reps: number, korean: string): ReviewDirection {
  if (!WRITABLE_WORD.test(korean)) return 'read';
  return reps >= WRITE_AFTER_REPS ? 'write' : 'read';
}

export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export const INITIAL_SRS: SrsState = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

export interface SrsSchedule extends SrsState {
  /** Quando la card torna: data ISO (solo giorno). */
  dueAt: string;
}

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

function addDays(from: Date, days: number): string {
  const copy = new Date(from.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

export function scheduleCard(state: SrsState, grade: SrsGrade, now: Date = new Date()): SrsSchedule {
  if (grade === 0) {
    const lapses = state.lapses + 1;
    const ease = Math.max(MIN_EASE, state.ease - 0.2);
    // Una card sbagliata non torna subito: si rivede domani, non ossessivamente.
    return { ease, intervalDays: 1, reps: 0, lapses, dueAt: addDays(now, 1) };
  }

  const ease =
    grade === 2 ? Math.min(MAX_EASE, state.ease + 0.1) : Math.max(MIN_EASE, state.ease - 0.05);
  const reps = state.reps + 1;

  let intervalDays: number;
  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = 3;
  else intervalDays = Math.max(1, Math.round(state.intervalDays * ease));

  // Un "facile" allunga il passo, ma senza scorciatoie assurde.
  if (grade === 2) intervalDays = Math.max(intervalDays, Math.round(intervalDays * 1.3));

  return {
    ease,
    intervalDays,
    reps,
    lapses: state.lapses,
    dueAt: addDays(now, intervalDays),
  };
}

/**
 * Due errori sulla stessa parola non sono distrazione: sono il segnale che il
 * calendario sta allungando i passi su una parola che non c'è. Da lì la parola
 * resta in un elenco a parte, dove si può riprendere senza aspettare la
 * scadenza — che dopo due errori è comunque domani, ma dopo il terzo sarebbe
 * fra una settimana.
 */
export const FRAGILE_LAPSES = 2;

export function isFragile(state: { lapses: number }): boolean {
  return state.lapses >= FRAGILE_LAPSES;
}
