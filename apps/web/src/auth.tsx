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
import { api, ApiError } from './api';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: SessionUser };

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  code?: string;
}

interface AuthContextValue {
  state: AuthState;
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    api
      .session()
      .then(({ user }) => {
        if (!active) return;
        setState(user ? { status: 'authenticated', user } : { status: 'anonymous' });
      })
      .catch(() => {
        // Rete assente o server appena riavviato: meglio la schermata di
        // accesso che un errore bloccante.
        if (active) setState({ status: 'anonymous' });
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setState({ status: 'authenticated', user });
  }, []);

  // Iscrizione e accesso fanno la stessa cosa, dal punto di vista di questa
  // pagina: il server ha già messo il cookie di sessione, quindi lo studente
  // è dentro e il percorso si apre sulla prima lezione.
  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await api.register(input);
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ status: 'anonymous' });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      login,
      register,
      logout,
    }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve stare dentro AuthProvider');
  return value;
}

/** Messaggio unico per gli errori dell'API: il codice serve solo ai log. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Errore inatteso.';
}
