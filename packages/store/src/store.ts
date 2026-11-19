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
  /** Il profilo aperto, o il primo che nasce: è la prima chiamata del sito. */
  bootstrap(): Promise<SessionUser>;
  /** Un profilo in più su questo computer, e diventa quello aperto. */
  addProfile(): Promise<SessionUser>;
  /** Il nome con cui lo studente vuole essere chiamato. */
  rename(displayName: string): Promise<SessionUser>;
  /** Il nome utente, quello con la chiocciola: unico su questo computer. */
  changeUsername(username: string): Promise<SessionUser>;
  /** Passa a un altro profilo locale: un clic, niente credenziali. */
  switchUser(userId: string): Promise<SessionUser | null>;
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
        state.sessions[user.id] = {
          token: cookie,
          username: user.username,
          displayName: user.displayName,
        };
        state.activeUserId = user.id;
        persist();
      }
    }

    if (method.toUpperCase() !== 'GET') persister?.schedule();

    if (result.status >= 400) throw toApiError(result.status, result.body);
    return result.body as T;
  };

  /**
   * Il nome tenuto accanto al token deve restare quello del database: senza
   * questo, dopo una rinomina la riapertura mostrerebbe il nome vecchio finché
   * non arriva la risposta di `session`.
   */
  const remember = (user: SessionUser): void => {
    const stored = state.sessions[user.id];
    if (!stored) return;
    state.sessions[user.id] = {
      ...stored,
      username: user.username,
      displayName: user.displayName,
    };
    persist();
  };

  return {
    db,

    call,

    accounts: () => call<AccountsResponse>('GET', '/api/auth/accounts'),

    session: async () => {
      const body = await call<{ user: SessionUser | null }>('GET', '/api/auth/session');
      return body.user;
    },

    bootstrap: async () => {
      const body = await call<{ user: SessionUser }>('POST', '/api/auth/bootstrap');
      return body.user;
    },

    addProfile: async () => {
      const body = await call<{ user: SessionUser }>('POST', '/api/auth/profiles');
      return body.user;
    },

    rename: async (displayName: string) => {
      const body = await call<{ user: SessionUser }>('POST', '/api/auth/rename', { displayName });
      remember(body.user);
      return body.user;
    },

    changeUsername: async (username: string) => {
      const body = await call<{ user: SessionUser }>('POST', '/api/auth/username', { username });
      remember(body.user);
      return body.user;
    },

    switchUser: async (userId: string) => {
      // Ogni profilo ha il suo token dal momento in cui è nato: passare da uno
      // all'altro è già quello che serve, non c'è una credenziale da verificare.
      const stored: StoredSession | undefined = state.sessions[userId];
      if (stored) {
        state.activeUserId = userId;
        persist();

        const body = await call<{ user: SessionUser | null }>('GET', '/api/auth/session');
        if (body.user) return body.user;

        // La sessione è scaduta: il token vecchio non serve più.
        delete state.sessions[userId];
        state.activeUserId = null;
        persist();
      }

      // Nessun token, ma il profilo è nel database (sessione scaduta, o
      // localStorage svuotato): si riapre, perché qui non c'è niente da inserire.
      const reopened = await call<{ user: SessionUser }>('POST', '/api/auth/reactivate', { userId });
      return reopened.user;
    },

    close: async () => {
      await persister?.close();
      db.close();
    },
  };
}
