import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api, PENDING_CHANGED } from '../api';
import { useAuth } from '../auth';
import { ThemeToggle } from '../theme';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dueCards, setDueCards] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  // I badge sono promemoria, non dati critici: se la richiesta fallisce si
  // tengono i numeri di prima invece di mostrare un errore nella shell.
  useEffect(() => {
    let active = true;

    const refresh = () =>
      api
        .due()
        .then((counts) => {
          if (!active) return;
          setDueCards(counts.dueCards);
          setMistakes(counts.mistakes);
        })
        .catch(() => undefined);

    refresh();
    window.addEventListener(PENDING_CHANGED, refresh);
    window.addEventListener('focus', refresh);

    return () => {
      active = false;
      window.removeEventListener(PENDING_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [location.pathname]);

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
          <NavLink to="/quaderno">Quaderno</NavLink>
          <NavLink to="/ripassi">
            Ripassi
            {dueCards > 0 ? (
              <span className="nav-badge" aria-label={`${dueCards} ripassi in scadenza`}>
                {dueCards > 99 ? '99+' : dueCards}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/errori">
            Errori
            {mistakes > 0 ? (
              <span
                className="nav-badge nav-badge--warn"
                aria-label={`${mistakes} esercizi da rifare`}
              >
                {mistakes > 99 ? '99+' : mistakes}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/progressi">Progressi</NavLink>
        </nav>

        <div className="user-chip">
          <ThemeToggle />
          <span className="user-chip__name">{user?.displayName ?? ''}</span>
          {/* Il database è di questo browser: cambiare utente è scegliere un
              altro profilo, non rifare l'accesso. */}
          <Link className="btn btn--sm btn--ghost" to="/login">
            Profili
          </Link>
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
