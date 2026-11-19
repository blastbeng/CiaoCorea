/**
 * L'IndexedDB del portale: due cassetti.
 *
 * `database` tiene i byte di SQLite, come sempre. `snapshots` è arrivato dopo,
 * con la versione 2, e serve all'importazione di un backup: prima di applicare
 * un file si tiene una copia di com'era il database, così "annulla" è un
 * pulsante e non una promessa. Chi aveva la versione 1 la ritrova aggiornata
 * al primo avvio, senza perdere niente.
 */

const DB_NAME = 'ciaocorea';
const DB_VERSION = 2;
const DATABASE_STORE = 'database';
const SNAPSHOT_STORE = 'snapshots';
const DATABASE_KEY = 'sqlite';
const SNAPSHOT_KEY = 'before-import';
// I metadati stanno a parte: leggere "quando" non deve costare i megabyte
// della copia.
const SNAPSHOT_META_KEY = 'before-import-meta';

export interface SnapshotRecord {
  bytes: Uint8Array;
  takenAt: string;
  label: string;
}

export interface SnapshotInfo {
  takenAt: string;
  label: string;
  bytes: number;
}

export function openIndexed(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATABASE_STORE)) db.createObjectStore(DATABASE_STORE);
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB non disponibile'));
    request.onblocked = () => reject(new Error('IndexedDB bloccato da un’altra scheda'));
  });
}

export async function readRecord<T>(store: string, key: string): Promise<T | null> {
  const db = await openIndexed();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = transaction.objectStore(store).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Lettura non riuscita'));
    });
  } finally {
    db.close();
  }
}

export async function writeRecord(store: string, key: string, value: unknown): Promise<void> {
  const db = await openIndexed();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Scrittura non riuscita'));
    });
  } finally {
    db.close();
  }
}

export async function deleteRecord(store: string, key: string): Promise<void> {
  const db = await openIndexed();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Cancellazione non riuscita'));
    });
  } finally {
    db.close();
  }
}

export const DATABASE = { store: DATABASE_STORE, key: DATABASE_KEY } as const;

export async function loadSnapshot(): Promise<SnapshotRecord | null> {
  const record = await readRecord<SnapshotRecord>(SNAPSHOT_STORE, SNAPSHOT_KEY);
  if (!record || !(record.bytes instanceof Uint8Array)) return null;
  return record;
}

export async function saveSnapshot(bytes: Uint8Array, label: string): Promise<void> {
  const takenAt = new Date().toISOString();
  await writeRecord(SNAPSHOT_STORE, SNAPSHOT_KEY, {
    bytes,
    takenAt,
    label,
  } satisfies SnapshotRecord);
  await writeRecord(SNAPSHOT_STORE, SNAPSHOT_META_KEY, {
    takenAt,
    label,
    bytes: bytes.byteLength,
  } satisfies SnapshotInfo);
}

export async function clearSnapshot(): Promise<void> {
  await deleteRecord(SNAPSHOT_STORE, SNAPSHOT_KEY);
  await deleteRecord(SNAPSHOT_STORE, SNAPSHOT_META_KEY);
}

export async function snapshotInfo(): Promise<SnapshotInfo | null> {
  const meta = await readRecord<SnapshotInfo>(SNAPSHOT_STORE, SNAPSHOT_META_KEY);
  if (meta && typeof meta.takenAt === 'string') return meta;

  // Copia scritta da una versione precedente, senza il record leggero: qui
  // l'unico modo è leggere tutto una volta.
  const record = await loadSnapshot();
  if (!record) return null;
  return { takenAt: record.takenAt, label: record.label, bytes: record.bytes.byteLength };
}
