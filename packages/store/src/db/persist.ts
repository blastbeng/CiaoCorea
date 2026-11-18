/**
 * Il database vive in memoria (sql.js) e viene scritto su IndexedDB ai margini
 * delle operazioni. IndexedDB e non localStorage: i byte di un database SQLite
 * superano presto la quota di 5 MB, e localStorage è sincrono, quindi ogni
 * salvataggio bloccherebbe il rendering.
 */

const DB_NAME = 'ciaocorea';
const STORE_NAME = 'database';
const RECORD_KEY = 'sqlite';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB non disponibile'));
    request.onblocked = () => reject(new Error('IndexedDB bloccato da un’altra scheda'));
  });
}

export async function loadBytes(): Promise<Uint8Array | null> {
  const db = await open();
  try {
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(value instanceof Uint8Array ? value : null);
      };
      request.onerror = () => reject(request.error ?? new Error('Lettura non riuscita'));
    });
  } finally {
    db.close();
  }
}

export async function saveBytes(bytes: Uint8Array): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(bytes, RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Scrittura non riuscita'));
    });
  } finally {
    db.close();
  }
}

export async function clearBytes(): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Cancellazione non riuscita'));
    });
  } finally {
    db.close();
  }
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
