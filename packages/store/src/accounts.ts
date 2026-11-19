/**
 * Le sessioni di questo browser: un token per ogni profilo, più quello attivo.
 *
 * Il token vive in localStorage insieme ai progressi, nello stesso spazio, e
 * qui non c'è nulla da proteggere: non è una password, è il segnaposto che
 * dice quale dei profili locali è quello aperto. È tenerlo qui che rende
 * possibile il cambio utente: si passa da un profilo all'altro con un clic, e
 * il browser che si riapre il giorno dopo ritrova lo studente che c'era.
 */

const KEY = 'ciaocorea.sessions.v1';

export interface StoredSession {
  token: string;
  username: string;
}

export interface SessionState {
  activeUserId: string | null;
  sessions: Record<string, StoredSession>;
}

const EMPTY_STATE: SessionState = { activeUserId: null, sessions: {} };

function area(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Safari in navigazione privata può lanciare già all'accesso.
    return null;
  }
}

export function loadSessionState(): SessionState {
  const storage = area();
  if (!storage) return { ...EMPTY_STATE };

  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...EMPTY_STATE };

    const parsed = JSON.parse(raw) as Partial<SessionState>;
    const sessions: Record<string, StoredSession> = {};
    for (const [userId, value] of Object.entries(parsed.sessions ?? {})) {
      // I browser che hanno iniziato con le password hanno la vecchia forma,
      // con l'email al posto dello username: il token è la parte che conta, e
      // la si conserva così com'è.
      const entry = value as (Partial<StoredSession> & { email?: string }) | undefined;
      if (entry && typeof entry.token === 'string') {
        sessions[userId] = {
          token: entry.token,
          username: entry.username ?? entry.email ?? '',
        };
      }
    }

    const active = typeof parsed.activeUserId === 'string' ? parsed.activeUserId : null;
    return { activeUserId: active && sessions[active] ? active : null, sessions };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveSessionState(state: SessionState): void {
  const storage = area();
  if (!storage) return;

  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota piena o storage disabilitato: la sessione vive comunque in memoria
    // fino al reload, che è meglio di una schermata bianca.
  }
}
