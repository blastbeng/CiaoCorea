import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api, PENDING_CHANGED } from '../api';
import { hasGeneratedUsername, useAuth } from '../auth';
import { ACCOUNT_LINKS, NAV, type NavEntry, type NavItem } from '../nav';
import { ThemeToggle } from '../theme';
import { CookieBanner } from './CookieBanner';
import { PronounceNotice } from './PronounceNotice';
import { SupportButtons } from './SupportButtons';
import { WelcomeDialog } from './WelcomeDialog';

/**
 * Sotto questa larghezza la barra non ci sta: le cinque voci diventano un
 * pannello. Il numero è lo stesso del CSS, ed è l'unico posto in cui cambia.
 */
const NARROW_QUERY = '(max-width: 1080px)';

function useNarrowLayout() {
  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return narrow;
}

/** Il conto accanto a una voce: ripassi in scadenza o errori da rifare. */
function CountBadge({ count, warn }: { count: number; warn?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={warn ? 'nav-badge nav-badge--warn' : 'nav-badge'}
      aria-label={
        warn ? `${count} esercizi da rifare` : `${count} ripassi in scadenza`
      }
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function itemBadge(item: NavItem, dueCards: number, mistakes: number) {
  if (item.badge === 'due') return <CountBadge count={dueCards} />;
  if (item.badge === 'mistakes') return <CountBadge count={mistakes} warn />;
  return null;
}

function groupHasPage(entry: Extract<NavEntry, { kind: 'group' }>, pathname: string) {
  return entry.items.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  // Il nome non è ancora suo: è quello che il portale gli ha dato al primo
  // avvio. Finché è così lo diciamo, accanto al nome.
  const nameIsGenerated = hasGeneratedUsername(user);
  const [dueCards, setDueCards] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  // Quale gruppo ha la tendina aperta. Uno alla volta: due pannelli aperti
  // sarebbero di nuovo una lista di voci senza capo né coda.
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const narrow = useNarrowLayout();
  const navRef = useRef<HTMLElement | null>(null);
  // Mouse, dito o tastiera: la tendina si comporta in modo diverso, e al click
  // serve sapere da dove è arrivato.
  const pointerKind = useRef<string>('');

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

  // Si cambia pagina e il menu si chiude: aperto sopra il contenuto nuovo
  // sarebbe solo un ostacolo da togliere.
  useEffect(() => {
    setNavOpen(false);
    setOpenMenu(null);
  }, [location.pathname]);

  // Con la tendina aperta, un tocco fuori la chiude; Escape fa lo stesso.
  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      const nav = navRef.current;
      if (nav && !nav.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

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

  const groupFrame = (entry: Extract<NavEntry, { kind: 'group' }>) => {
    const open = openMenu === entry.id;
    const active = groupHasPage(entry, location.pathname);
    return { open, active };
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

        <nav
          id="app-nav"
          ref={navRef}
          className={navOpen ? 'app-nav app-nav--open' : 'app-nav'}
          aria-label="Sezioni del sito"
          onClick={() => setNavOpen(false)}
        >
          {NAV.map((entry) => {
            if (entry.kind === 'link') {
              return (
                <NavLink
                  key={entry.id}
                  to={entry.to}
                  end={entry.to === '/'}
                  className={({ isActive }) => {
                    // Un corso e le sue lezioni vivono sotto «Percorso»: la
                    // barra deve dire che sei lì, non spegnersi del tutto.
                    const here =
                      isActive ||
                      (entry.to === '/' && location.pathname.startsWith('/corso/'));
                    return here ? 'nav-link active' : 'nav-link';
                  }}
                  title={entry.hint}
                >
                  {entry.label}
                </NavLink>
              );
            }

            const { open, active } = groupFrame(entry);
            const panelId = `nav-panel-${entry.id}`;

            return (
              <div
                key={entry.id}
                className="nav-group"
                data-open={open ? 'true' : 'false'}
                data-active={active ? 'true' : 'false'}
                onPointerEnter={(event) => {
                  // Solo con il mouse: sul telefono il puntatore non esiste e
                  // il pannello vive nel cassetto.
                  if (!narrow && event.pointerType === 'mouse') setOpenMenu(entry.id);
                }}
                onPointerLeave={(event) => {
                  if (!narrow && event.pointerType === 'mouse') {
                    setOpenMenu((current) => (current === entry.id ? null : current));
                  }
                }}
                onPointerDown={(event) => {
                  pointerKind.current = event.pointerType;
                }}
                onBlur={(event) => {
                  // Da tastiera non c'è un mouse che esce dal gruppo: la
                  // tendina si chiude quando il fuoco va fuori da lì.
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOpenMenu((current) => (current === entry.id ? null : current));
                  }
                }}
              >
                {narrow ? (
                  // Nel cassetto il gruppo è una sezione: titolo e voci, tutte
                  // in vista. Nascondere pagine dietro un altro tocco sarebbe
                  // di nuovo il labirinto da cui siamo partiti.
                  <p className="nav-group__heading">{entry.label}</p>
                ) : (
                  <button
                    type="button"
                    className="nav-group__toggle"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={(event) => {
                      // Con il mouse la tendina si è già aperta al passaggio:
                      // un click che la richiudesse sarebbe solo un lampo. Da
                      // tastiera (detail 0) e da dito invece il click è il
                      // gesto che apre e richiude.
                      const fromMouse = pointerKind.current === 'mouse' && event.detail > 0;
                      setOpenMenu((current) =>
                        fromMouse ? entry.id : current === entry.id ? null : entry.id,
                      );
                    }}
                  >
                    {entry.label}
                    <span className="nav-group__caret" aria-hidden="true" />
                  </button>
                )}

                <div className="nav-panel" id={panelId}>
                  <p className="nav-panel__intro">{entry.hint}</p>
                  {entry.items.map((item) => (
                    <NavLink key={item.to} to={item.to} className="nav-panel__item">
                      <span className="nav-panel__label">
                        {item.label}
                        {itemBadge(item, dueCards, mistakes)}
                      </span>
                      <span className="nav-panel__hint">{item.hint}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Le pagine del profilo: nella barra starebbero strette, nel
              cassetto sono le ultime righe, dopo quelle dello studio. */}
          <div className="nav-extra">
            {ACCOUNT_LINKS.map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-panel__item">
                <span className="nav-panel__label">{item.label}</span>
                <span className="nav-panel__hint">{item.hint}</span>
              </NavLink>
            ))}
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

        {/* Sotto i 1080px le voci non stanno in una riga: il menu si apre da
            qui, e il pannello sotto l'header le mostra per gruppi. */}
        <button
          type="button"
          className="btn btn--sm btn--ghost nav-toggle"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
          aria-controls="app-nav"
          aria-label={navOpen ? 'Chiudi il menu' : 'Apri il menu'}
          title={navOpen ? 'Chiudi il menu' : 'Apri il menu'}
        >
          {/* Tre barre disegnate, non ☰ e ✕: quei caratteri mancano in molti
              font e sul sistema sbagliato diventano due quadratini. */}
          <span className="nav-toggle__bars" data-open={navOpen ? 'true' : 'false'} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>

      {navOpen && narrow ? (
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
        {/* Chi arriva in fondo ha studiato abbastanza per decidere se il posto
            vale un caffè: la richiesta sta qui, piccolo e senza inseguire
            nessuno. */}
        <div className="app-footer__support">
          <p className="app-footer__support-title">
            <span aria-hidden="true">☕</span> Ti è utile? Offrimi un caffè
          </p>
          <p className="app-footer__support-note">
            CiaoCorea è gratis, senza pubblicità e senza tracciamento: un caffè paga il
            dominio e le ore di revisione delle lezioni.
          </p>
          <SupportButtons />
        </div>
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
      <PronounceNotice />
    </div>
  );
}
