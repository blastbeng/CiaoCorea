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
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: SessionUser };

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  state: AuthState;
  user: SessionUser | null;
  /** I profili creati su questo browser: è la schermata di scelta dell'utente. */
  accounts: LocalAccount[];
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  /** Passa a un altro profilo; null se la sua sessione è scaduta. */
  switchUser: (userId: string) => Promise<SessionUser | null>;
  logout: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
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
      // L'elenco dei profili è comodità: se non si legge, si entra con la
      // password e basta.
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .session()
      .then(({ user }) => {
        if (!active) return;
        setState(user ? { status: 'authenticated', user } : { status: 'anonymous' });
      })
      .catch(() => {
        // Database appena creato o wasm non ancora pronto: meglio la schermata
        // di accesso che un errore bloccante.
        if (active) setState({ status: 'anonymous' });
      })
      .finally(() => {
        if (active) void refreshAccounts();
      });
    return () => {
      active = false;
    };
  }, [refreshAccounts]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user } = await api.login(email, password);
      setState({ status: 'authenticated', user });
      await refreshAccounts();
    },
    [refreshAccounts],
  );

  // Creare un profilo e entrare sono la stessa cosa: il database è locale, non
  // c'è nessuna email da confermare.
  const register = useCallback(
    async (input: RegisterInput) => {
      const { user } = await api.register(input);
      setState({ status: 'authenticated', user });
      await refreshAccounts();
    },
    [refreshAccounts],
  );

  const switchUser = useCallback(
    async (userId: string) => {
      const user = await api.switchUser(userId);
      setState(user ? { status: 'authenticated', user } : { status: 'anonymous' });
      await refreshAccounts();
      return user;
    },
    [refreshAccounts],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ status: 'anonymous' });
      await refreshAccounts();
    }
  }, [refreshAccounts]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      accounts,
      login,
      register,
      switchUser,
      logout,
      refreshAccounts,
    }),
    [state, accounts, login, register, switchUser, logout, refreshAccounts],
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
