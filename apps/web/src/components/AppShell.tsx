import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            한
          </span>
          CiaoCorea
        </Link>

        <nav className="app-nav">
          <NavLink to="/" end>
            Percorso
          </NavLink>
          <NavLink to="/dialoghi">Conversazione</NavLink>
          <NavLink to="/dizionario">Dizionario</NavLink>
          <NavLink to="/ripassi">Ripassi</NavLink>
          <NavLink to="/progressi">Progressi</NavLink>
        </nav>

        <div className="user-chip">
          <span>{user?.displayName ?? ''}</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={handleLogout}>
            Esci
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-body">{children}</div>
      </main>

      <footer className="app-footer">
        CiaoCorea – Impara il Coreano · esercizi e lettura, un giorno alla volta
      </footer>
    </div>
  );
}
