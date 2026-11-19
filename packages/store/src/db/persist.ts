import { DATABASE, readRecord, writeRecord } from './indexed';

/**
 * Il database vive in memoria (sql.js) e viene scritto su IndexedDB ai margini
 * delle operazioni. IndexedDB e non localStorage: i byte di un database SQLite
 * superano presto la quota di 5 MB, e localStorage è sincrono, quindi ogni
 * salvataggio bloccherebbe il rendering.
 */

export async function loadBytes(): Promise<Uint8Array | null> {
  const value = await readRecord<unknown>(DATABASE.store, DATABASE.key);
  return value instanceof Uint8Array ? value : null;
}

export async function saveBytes(bytes: Uint8Array): Promise<void> {
  await writeRecord(DATABASE.store, DATABASE.key, bytes);
}

/**
 * Salvataggio ritardato: una lezione produce una decina di scritture in pochi
 * secondi, e ognuna esporta il database intero. Un timer solo tiene il costo
 * basso senza rischiare di perdere l'ultima risposta.
 */
export interface Persister {
  /** Programma un salvataggio (debounce). */
  schedule(): void;
  /** Scrive subito, se c'è qualcosa in sospeso. */
  flush(): Promise<void>;
  /** Ferma il timer e scrive l'ultima volta. */
  close(): Promise<void>;
}

export function createPersister(
  exportBytes: () => Uint8Array,
  delayMs = 400,
): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const write = (): Promise<void> => {
    const bytes = exportBytes();
    // Le scritture si accodano: due export in parallelo potrebbero arrivare
    // fuori ordine e far vincere lo stato più vecchio.
    writing = writing.then(() => saveBytes(bytes)).catch(() => undefined);
    return writing;
  };

  return {
    schedule() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void write();
      }, delayMs);
    },

    async flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        await write();
        return;
      }
      await writing;
    },

    async close() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        await write();
      } else {
        await writing;
      }
    },
  };
}
