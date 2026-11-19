/**
 * L'ultima volta che lo studente si è portato via una copia dei progressi.
 *
 * Il database vive nel browser, e il browser può svuotare un IndexedDB quando
 * lo spazio scarseggia. Non possiamo impedirlo, ma possiamo ricordare che è
 * passato troppo tempo: una data in localStorage costa niente ed è l'unica
 * cosa che rende il promemoria possibile.
 */

const KEY = 'ciaocorea.backup.v1';

/** Ogni quanto vale la pena ricordarlo: due settimane di studio. */
export const BACKUP_REMINDER_DAYS = 14;

export interface BackupInfo {
  exportedAt: string;
  scope: 'profile' | 'all';
}

function area(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBackupInfo(): BackupInfo | null {
  const storage = area();
  if (!storage) return null;

  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BackupInfo>;
    if (typeof parsed.exportedAt !== 'string') return null;
    return {
      exportedAt: parsed.exportedAt,
      scope: parsed.scope === 'all' ? 'all' : 'profile',
    };
  } catch {
    return null;
  }
}

export function markBackupExported(scope: 'profile' | 'all'): void {
  const storage = area();
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify({ exportedAt: new Date().toISOString(), scope }));
  } catch {
    // Storage pieno o disabilitato: il backup è già stato scaricato, la data è
    // solo il promemoria della prossima volta.
  }
}

export function daysSince(value: string): number {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const days = (Date.now() - then) / 86_400_000;
  return Math.max(0, Math.floor(days));
}

/** `true` quando è ora di ricordarlo: mai fatto, o fatto troppo tempo fa. */
export function backupIsStale(info: BackupInfo | null): boolean {
  if (!info) return false;
  return daysSince(info.exportedAt) >= BACKUP_REMINDER_DAYS;
}
