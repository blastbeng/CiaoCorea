import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api, PENDING_CHANGED } from '../api';
import { hasGeneratedUsername, useAuth } from '../auth';
import { ThemeToggle } from '../theme';

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  // Il nome non è ancora suo: è quello che il portale gli ha dato al primo
  // avvio. Finché è così lo diciamo, accanto al nome.
  const nameIsGenerated = hasGeneratedUsername(user);
  const [dueCards, setDueCards] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

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

  // Il menu si chiude da solo quando cambia pagina: aperto sopra il contenuto
  // nuovo sarebbe solo un ostacolo da togliere.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            한
          </span>
          CiaoCorea
        </Link>

        <nav
          id="app-nav"
          className={navOpen ? 'app-nav app-nav--open' : 'app-nav'}
          onClick={() => setNavOpen(false)}
        >
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

          {/* Lo stesso paio di azioni dell'header, per quando l'header è
              stretto e le ha cedute al menu. */}
          <div className="nav-extra">
            <Link className="btn btn--sm btn--ghost btn--block" to="/profilo">
              {nameIsGenerated ? 'Il tuo profilo · cambia il nome' : 'Il tuo profilo'}
            </Link>
            <Link className="btn btn--sm btn--ghost btn--block" to="/profili">
              Profili
            </Link>
          </div>
        </nav>

        <div className="user-chip">
          <ThemeToggle />
          {/* Il nome è la porta del profilo: da lì si sceglie come farsi
              chiamare. Se è ancora quello generato, lo diciamo qui: è il
              momento in cui lo studente sta guardando. */}
          <Link
            className="user-chip__name"
            to="/profilo"
            title="Il tuo profilo: nome e nome utente"
          >
            <span className="user-chip__label">{user?.displayName ?? ''}</span>
            {nameIsGenerated ? (
              <span className="user-chip__hint">(cambia qui il tuo username)</span>
            ) : null}
          </Link>
          {/* Il database è di questo browser: cambiare utente è scegliere un
              altro profilo, non rifare l'accesso. Su schermo stretto questo
              passa nel menu: nell'header non ci starebbe. */}
          <div className="user-chip__actions">
            <Link className="btn btn--sm btn--ghost" to="/profili">
              Profili
            </Link>
          </div>
        </div>

        {/* Su schermo stretto le sette voci non stanno in una riga: il menu si
            apre da qui, e il pannello sotto l'header le mostra in colonna. */}
        <button
          type="button"
          className="btn btn--sm btn--ghost nav-toggle"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
          aria-controls="app-nav"
          aria-label={navOpen ? 'Chiudi il menu' : 'Apri il menu'}
          title={navOpen ? 'Chiudi il menu' : 'Apri il menu'}
        >
          <span aria-hidden="true">{navOpen ? '✕' : '☰'}</span>
        </button>
      </header>

      {navOpen ? (
        <button
          type="button"
          className="nav-scrim"
          onClick={() => setNavOpen(false)}
          aria-label="Chiudi il menu"
          tabIndex={-1}
        />
      ) : null}

      <main className="app-main">
        <div className="app-body">{children}</div>
      </main>

      <footer className="app-footer">
        CiaoCorea – Impara il Coreano · esercizi e lettura, un giorno alla volta
      </footer>
    </div>
  );
}
