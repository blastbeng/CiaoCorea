/**
 * Le sessioni di questo browser: un token per ogni profilo, più quello attivo.
 *
 * Nel server il token stava in un cookie httpOnly; qui il cookie non esiste più
 * e il token vive in localStorage. Non è una perdita di sicurezza rispetto a
 * quello che c'è intorno: il database con tutti i progressi sta nello stesso
 * spazio, quindi chi legge uno legge l'altro. Tenerli insieme è però ciò che
 * rende possibile il cambio utente: si passa da un profilo all'altro senza
 * riscrivere la password, e senza perdere la sessione di chi era prima.
 */

const KEY = 'ciaocorea.sessions.v1';

export interface StoredSession {
  token: string;
  email: string;
  displayName: string;
}

export interface SessionState {
  activeUserId: string | null;
  sessions: Record<string, StoredSession>;
}

export const EMPTY_STATE: SessionState = { activeUserId: null, sessions: {} };

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
      if (value && typeof value.token === 'string') sessions[userId] = value;
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
