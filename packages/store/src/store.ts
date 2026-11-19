import type { SessionUser } from '@ciaocorea/shared';
import {
  loadSessionState,
  saveSessionState,
  type SessionState,
  type StoredSession,
} from './accounts';
import { SESSION_COOKIE } from './auth/sessions';
import { openDb, type Db } from './db/client';
import { createPersister, loadBytes, type Persister } from './db/persist';
import { ApiError, toApiError } from './errors';
import { DEFAULT_CONFIG, type Ctx, type StoreConfig } from './http/context';
import type { LocalApp } from './http/router';
import { buildStoreApp } from './http/server';
import type { AccountsResponse } from './types';

export interface CreateStoreOptions {
  /**
   * URL del wasm di SQLite. Nel bundle Vite è un asset con l'hash nel nome,
   * quindi lo passa l'applicazione; nei test resta indefinito e sql.js trova
   * il file accanto a sé.
   */
  wasmUrl?: string;
  /** `indexeddb` sopravvive al reload, `memory` serve ai test. */
  storage?: 'indexeddb' | 'memory';
  config?: Partial<StoreConfig>;
}

export interface Store {
  /** Il database della scheda. Esposto per diagnostica e test. */
  readonly db: Db;
  /** L'unico punto d'ingresso: stessa forma delle vecchie chiamate HTTP. */
  call<T>(method: string, url: string, body?: unknown): Promise<T>;
  /** I profili di questo browser, con quello attivo. */
  accounts(): Promise<AccountsResponse>;
  session(): Promise<SessionUser | null>;
  /** Passa a un profilo che ha già una sessione valida; null se serve la password. */
  switchUser(userId: string): Promise<SessionUser | null>;
  logout(): Promise<void>;
  close(): Promise<void>;
}

function storeUser(body: unknown): SessionUser | null {
  const user = (body as { user?: SessionUser } | null)?.user;
  return user && typeof user.id === 'string' ? user : null;
}

export async function createStore(options: CreateStoreOptions = {}): Promise<Store> {
  const persistence = options.storage ?? 'indexeddb';
  const persistent = persistence === 'indexeddb' && typeof indexedDB !== 'undefined';

  const bytes = persistent ? await loadBytes() : null;
  const db = await openDb({ wasmUrl: options.wasmUrl, bytes: bytes ?? undefined });

  const ctx: Ctx = {
    db,
    config: { ...DEFAULT_CONFIG, ...options.config },
  };
  const app: LocalApp = await buildStoreApp(ctx);

  let state: SessionState = persistent ? loadSessionState() : { activeUserId: null, sessions: {} };
  const persist = (): void => {
    if (persistent) saveSessionState(state);
  };

  const persister: Persister | null = persistent
    ? createPersister(() => db.exportBytes())
    : null;

  if (persister && typeof document !== 'undefined') {
    // Chiudere la scheda non deve costare l'ultima risposta: il salvataggio
    // ritardato viene forzato quando la pagina va in secondo piano.
    const flush = (): void => {
      void persister.flush();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  const call = async <T>(method: string, url: string, body?: unknown): Promise<T> => {
    const active = state.activeUserId;
    const token = active ? state.sessions[active]?.token : undefined;

    const headers: Record<string, string | undefined> = {};
    if (token) headers.cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;

    const result = await app.handle({ method, url, body, headers });

    // La rotta ha scritto o cancellato il cookie di sessione: qui diventa lo
    // stato dei profili di questo browser.
    const cookie = result.cookies.get(SESSION_COOKIE);
    if (cookie === undefined) {
      // nessuna intenzione sulla sessione
    } else if (cookie === null) {
      if (active) delete state.sessions[active];
      state.activeUserId = null;
      persist();
    } else {
      const user = storeUser(result.body);
      if (user) {
        state.sessions[user.id] = { token: cookie, email: user.email, displayName: user.displayName };
        state.activeUserId = user.id;
        persist();
      }
    }

    if (method.toUpperCase() !== 'GET') persister?.schedule();

    if (result.status >= 400) throw toApiError(result.status, result.body);
    return result.body as T;
  };

  return {
    db,

    call,

    accounts: () => call<AccountsResponse>('GET', '/api/auth/accounts'),

    session: async () => {
      const body = await call<{ user: SessionUser | null }>('GET', '/api/auth/session');
      return body.user;
    },

    switchUser: async (userId: string) => {
      const stored: StoredSession | undefined = state.sessions[userId];
      if (!stored) return null;

      state.activeUserId = userId;
      persist();

      const body = await call<{ user: SessionUser | null }>('GET', '/api/auth/session');
      if (!body.user) {
        delete state.sessions[userId];
        state.activeUserId = null;
        persist();
        return null;
      }
      return body.user;
    },

    logout: async () => {
      try {
        await call<{ ok: boolean }>('POST', '/api/auth/logout');
      } catch (error) {
        // Se la sessione era già scaduta, l'uscita è comunque riuscita.
        if (!(error instanceof ApiError)) throw error;
      }
    },

    close: async () => {
      await persister?.close();
      db.close();
    },
  };
}
