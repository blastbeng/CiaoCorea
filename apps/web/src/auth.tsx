import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SessionUser } from '@ciaocorea/shared';
import type { LocalAccount } from '@ciaocorea/store';
import { api, ApiError } from './api';

type AuthState =
  | { status: 'loading' }
  | { status: 'ready'; user: SessionUser }
  | { status: 'error'; message: string };

interface AuthContextValue {
  state: AuthState;
  user: SessionUser | null;
  /** I profili creati su questo browser: è la sezione utenti. */
  accounts: LocalAccount[];
  /** L'apertura del sito: riprende chi c'era, o apre il primo profilo. */
  start: () => Promise<void>;
  /** Un profilo in più su questo computer, e ci si entra dentro. */
  addProfile: () => Promise<SessionUser>;
  /** Passa a un altro profilo: un clic, niente credenziali. */
  switchUser: (userId: string) => Promise<SessionUser | null>;
  /** Il nome con cui lo studente vuole essere chiamato. */
  rename: (displayName: string) => Promise<SessionUser>;
  /** Il nome utente con la chiocciola, unico su questo computer. */
  changeUsername: (username: string) => Promise<SessionUser>;
  refreshAccounts: () => Promise<void>;
}

/**
 * `true` finché lo studente non ha scelto un nome suo: al primo avvio il nome
 * utente è quello generato dal portale, e vale la pena dirgli che può cambiarlo.
 */
export function hasGeneratedUsername(user: SessionUser | null): boolean {
  return user !== null && !user.usernameChosen;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);

  const refreshAccounts = useCallback(async () => {
    try {
      const body = await api.accounts();
      setAccounts(body.accounts);
    } catch {
      // L'elenco dei profili è comodità: la sezione utenti lo leggerà di nuovo
      // al prossimo ingresso, e studiare non si ferma qui.
      setAccounts([]);
    }
  }, []);

  const start = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const user = await api.bootstrap();
      setState({ status: 'ready', user });
      await refreshAccounts();
    } catch (problem) {
      // Database che non si apre, wasm che non arriva: qui non c'è un login da
      // mostrare, c'è solo da ricaricare.
      setState({ status: 'error', message: errorMessage(problem) });
    }
  }, [refreshAccounts]);

  useEffect(() => {
    void start();
  }, [start]);

  const addProfile = useCallback(async () => {
    const user = await api.addProfile();
    setState({ status: 'ready', user });
    await refreshAccounts();
    return user;
  }, [refreshAccounts]);

  const switchUser = useCallback(
    async (userId: string) => {
      const user = await api.switchUser(userId);
      if (user) setState({ status: 'ready', user });
      await refreshAccounts();
      return user;
    },
    [refreshAccounts],
  );

  const rename = useCallback(
    async (displayName: string) => {
      const user = await api.rename(displayName);
      setState({ status: 'ready', user });
      await refreshAccounts();
      return user;
    },
    [refreshAccounts],
  );

  const changeUsername = useCallback(
    async (username: string) => {
      const user = await api.changeUsername(username);
      setState({ status: 'ready', user });
      await refreshAccounts();
      return user;
    },
    [refreshAccounts],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'ready' ? state.user : null,
      accounts,
      start,
      addProfile,
      switchUser,
      rename,
      changeUsername,
      refreshAccounts,
    }),
    [state, accounts, start, addProfile, switchUser, rename, changeUsername, refreshAccounts],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve stare dentro AuthProvider');
  return value;
}

/** Messaggio unico per gli errori: il codice serve solo ai log. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Errore inatteso.';
}
