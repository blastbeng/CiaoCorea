import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api, PENDING_CHANGED } from '../api';
import { hasGeneratedUsername, useAuth } from '../auth';
import { ThemeToggle } from '../theme';
import { CookieBanner } from './CookieBanner';
import { WelcomeDialog } from './WelcomeDialog';

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

  // Si cambia pagina e si riparte dall'alto: restare a metà di quella prima è
  // disorientante. Se il link porta a una sezione (#dati, per esempio) si va
  // lì, che è quello che il lettore ha chiesto.
  useEffect(() => {
    const deadline = performance.now() + 1500;
    let frame = 0;

    const scroll = () => {
      if (!location.hash) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }

      let target: Element | null = null;
      try {
        target = document.querySelector(location.hash);
      } catch {
        // Un cancelletto che non è un selettore valido: si riparte dall'alto.
      }

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      // La pagina può arrivare dopo il primo giro (database e sessione si
      // aprono prima): si riprova per un attimo, poi si resta in cima.
      if (performance.now() < deadline) {
        frame = requestAnimationFrame(scroll);
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };

    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

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
          <NavLink to="/alfabeto">Alfabeto</NavLink>
          <NavLink to="/scrittura">Scrittura</NavLink>
          <NavLink to="/pronuncia">Pronuncia</NavLink>
          <NavLink to="/numeri">Numeri</NavLink>
          <NavLink to="/dizionario">Dizionario</NavLink>
          <NavLink to="/coniuga">Coniuga</NavLink>
          <NavLink to="/analisi">Analisi</NavLink>
          <NavLink to="/repertorio">Repertorio</NavLink>
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
            title="Il tuo profilo: il tuo nome"
          >
            <span className="user-chip__label">{user?.username ?? ''}</span>
            {nameIsGenerated ? (
              <span className="user-chip__hint">(cambia qui il tuo nome)</span>
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

      {/* Il fondo pagina è il posto della firma: chi arriva in fondo ha studiato
          abbastanza per voler sapere di chi è questo posto. */}
      <footer className="app-footer">
        <p className="app-footer__project">
          CiaoCorea – Impara il Coreano · esercizi e lettura, un giorno alla volta
        </p>
        <p className="app-footer__credit">
          Fatto da{' '}
          <a href="https://fabiovalentino.it" target="_blank" rel="noreferrer noopener">
            Fabio Valentino
          </a>
          {' · '}
          <Link to="/about">Chi sono</Link>
        </p>
      </footer>

      {/* Il benvenuto del giorno e il riquadro dei cookie stanno fuori dal
          flusso della pagina: compaiono sopra, una volta sola, e poi si
          tolgono di mezzo da soli. */}
      <WelcomeDialog />
      <CookieBanner />
    </div>
  );
}
