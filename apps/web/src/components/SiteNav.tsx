import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { hasGeneratedUsername, useAuth } from '../auth';
import { NAV, type NavEntry } from '../nav';
import { ThemeToggle } from '../theme';

/**
 * Sotto questa larghezza la barra non entra: le cinque voci diventano un
 * cassetto. Il numero è lo stesso del CSS, ed è l'unico posto in cui cambia.
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

/**
 * Il ramo contiene la pagina che stai guardando? Serve a tenere accesa la voce
 * del menù (e il suo ramo) anche quando la pagina è una figlia: /dialoghi/
 * primo-incontro è ancora «Conversazione».
 */
function containsRoute(entry: NavEntry, pathname: string): boolean {
  if (entry.to) {
    if (entry.to === '/') {
      if (pathname === '/') return true;
    } else if (pathname === entry.to || pathname.startsWith(`${entry.to}/`)) {
      return true;
    }
  }
  return (entry.children ?? []).some((child) => containsRoute(child, pathname));
}

function panelId(path: string[]) {
  return `nav-sub-${path.join('-')}`;
}

/** Il conto accanto a una voce: ripassi in scadenza o errori da rifare. */
function Badge({ entry, dueCards, mistakes }: { entry: NavEntry; dueCards: number; mistakes: number }) {
  const count = entry.badge === 'due' ? dueCards : entry.badge === 'mistakes' ? mistakes : 0;
  if (count <= 0) return null;
  return (
    <span
      className={entry.badge === 'mistakes' ? 'nav-badge nav-badge--warn' : 'nav-badge'}
      aria-label={
        entry.badge === 'mistakes' ? `${count} esercizi da rifare` : `${count} ripassi in scadenza`
      }
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Un livello del cassetto: il suo titolo e le voci che mostra. */
interface DrawerLevel {
  title: string;
  hint?: string;
  items: NavEntry[];
}

const DRAWER_ROOT: DrawerLevel = { title: 'Menù', items: NAV };

export function SiteNav({ dueCards, mistakes }: { dueCards: number; mistakes: number }) {
  const narrow = useNarrowLayout();
  const location = useLocation();
  const { user } = useAuth();
  // Il nome non è ancora suo: è quello che il portale gli ha dato al primo
  // avvio. Finché è così lo diciamo, accanto al nome.
  const nameIsGenerated = hasGeneratedUsername(user);

  // Il ramo aperto nella barra: gli id dall'alto in basso (es. studio/testi).
  // Uno solo alla volta: due pannelli aperti sarebbero di nuovo un elenco
  // senza capo né coda.
  const [openPath, setOpenPath] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  // Nel cassetto si scende un livello alla volta: la pila dice dove sei.
  const [trail, setTrail] = useState<DrawerLevel[]>([DRAWER_ROOT]);
  const navRef = useRef<HTMLElement | null>(null);
  // Mouse, dito o tastiera: la tendina si comporta in modo diverso, e al click
  // serve sapere da dove è arrivato.
  const pointerKind = useRef('');

  // Si cambia pagina e il menù si chiude: aperto sopra il contenuto nuovo
  // sarebbe solo un ostacolo da togliere, e la pila riparte dall'inizio.
  useEffect(() => {
    setNavOpen(false);
    setOpenPath([]);
    setTrail([DRAWER_ROOT]);
  }, [location.pathname]);

  // Con la barra aperta, un tocco fuori la chiude; Escape chiude un livello
  // per volta — prima il sottomenù, poi il menù.
  useEffect(() => {
    if (!openPath.length) return;

    const onPointerDown = (event: PointerEvent) => {
      const nav = navRef.current;
      if (nav && !nav.contains(event.target as Node)) setOpenPath([]);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPath((current) => current.slice(0, -1));
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openPath.length]);

  // Nel cassetto Escape fa una cosa sola: sale di un livello; se sei già al
  // primo, chiude il cassetto.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTrail((current) => {
        if (current.length > 1) return current.slice(0, -1);
        setNavOpen(false);
        return current;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const isMouse = (event: { pointerType: string }) => event.pointerType === 'mouse';

  /** La riga della barra: un link, oppure un pulsante che apre il sottomenù. */
  const renderRow = (entry: NavEntry, prefix: string[]): ReactNode => {
    const path = [...prefix, entry.id];
    const key = path.join('/');
    const open = openPath.join('/') === key;

    if (!entry.children) {
      return (
        <li key={key} className="nav-row">
          <NavLink
            to={entry.to ?? '/'}
            className="nav-row__link"
            onClick={() => {
              setOpenPath([]);
              setNavOpen(false);
            }}
          >
            <span className="nav-row__label">
              {entry.label}
              <Badge entry={entry} dueCards={dueCards} mistakes={mistakes} />
            </span>
            {entry.hint ? <span className="nav-row__hint">{entry.hint}</span> : null}
          </NavLink>
        </li>
      );
    }

    return (
      <li key={key} className="nav-row nav-row--menu" data-open={open ? 'true' : 'false'}>
        <button
          type="button"
          className="nav-row__link nav-row__link--menu"
          aria-expanded={open}
          aria-controls={panelId(path)}
          onClick={(event) => {
            // Con il mouse il sottomenù si è già aperto al passaggio: un click
            // che lo richiudesse sarebbe solo un lampo.
            const fromMouse = pointerKind.current === 'mouse' && event.detail > 0;
            setOpenPath((current) => {
              if (fromMouse) return path;
              return current.join('/') === key ? prefix : path;
            });
          }}
          onPointerEnter={(event) => {
            if (isMouse(event)) setOpenPath(path);
          }}
          onPointerLeave={(event) => {
            if (!isMouse(event)) return;
            setOpenPath((current) => (current.join('/') === key ? prefix : current));
          }}
        >
          <span className="nav-row__label">
            {entry.label}
            <Badge entry={entry} dueCards={dueCards} mistakes={mistakes} />
          </span>
          {entry.hint ? <span className="nav-row__hint">{entry.hint}</span> : null}
          <span className="nav-row__chevron" aria-hidden="true" />
        </button>
        <ul id={panelId(path)} className="nav-sub">
          {entry.children.map((child) => renderRow(child, path))}
        </ul>
      </li>
    );
  };

  /** Le prime cinque voci della barra: link diretti o menù con la loro tendina. */
  const renderTop = (entry: NavEntry): ReactNode => {
    if (!entry.children) {
      return (
        <NavLink
          key={entry.id}
          to={entry.to ?? '/'}
          end={entry.to === '/'}
          onClick={() => setOpenPath([])}
          className={({ isActive }) => {
            // Un corso e le sue lezioni vivono sotto «Percorso»: la barra
            // deve dire che sei lì, non spegnersi del tutto.
            const here =
              isActive || (entry.to === '/' && location.pathname.startsWith('/corso/'));
            return here ? 'nav-trigger nav-trigger--active' : 'nav-trigger';
          }}
          title={entry.hint}
        >
          {entry.label}
        </NavLink>
      );
    }

    const open = openPath[0] === entry.id;
    const active = containsRoute(entry, location.pathname);
    const right = entry.align === 'right';

    return (
      <div
        key={entry.id}
        className="nav-item"
        data-open={open ? 'true' : 'false'}
        data-active={active ? 'true' : 'false'}
        onPointerEnter={(event) => {
          if (isMouse(event)) setOpenPath([entry.id]);
        }}
        onPointerLeave={(event) => {
          if (!isMouse(event)) return;
          setOpenPath((current) => (current[0] === entry.id ? [] : current));
        }}
        onPointerDown={(event) => {
          pointerKind.current = event.pointerType;
        }}
        onBlur={(event) => {
          // Da tastiera non c'è un mouse che esce dal ramo: il menù si chiude
          // quando il fuoco va fuori da lì.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpenPath((current) => (current[0] === entry.id ? [] : current));
          }
        }}
      >
        <button
          type="button"
          className="nav-trigger"
          aria-expanded={open}
          aria-controls={`nav-panel-${entry.id}`}
          onClick={(event) => {
            const fromMouse = pointerKind.current === 'mouse' && event.detail > 0;
            setOpenPath((current) =>
              fromMouse ? [entry.id] : current[0] === entry.id ? [] : [entry.id],
            );
          }}
        >
          {entry.label}
          <span className="nav-caret" aria-hidden="true" />
        </button>
        <div
          id={`nav-panel-${entry.id}`}
          className={right ? 'nav-panel nav-panel--right' : 'nav-panel'}
        >
          {entry.hint ? <p className="nav-panel__intro">{entry.hint}</p> : null}
          <ul className="nav-list">
            {entry.children.map((child) => renderRow(child, [entry.id]))}
          </ul>
        </div>
      </div>
    );
  };

  const level = trail[trail.length - 1];

  /** Il cassetto: si scende un livello alla volta e si torna con «Indietro». */
  const drawer = (
    <>
      {trail.length > 1 ? (
        <div className="drawer-head">
          <button
            type="button"
            className="drawer-back"
            onClick={() => setTrail((current) => current.slice(0, -1))}
          >
            <span className="drawer-back__arrow" aria-hidden="true" />
            Indietro
          </button>
          <span className="drawer-title">{level.title}</span>
        </div>
      ) : null}
      {level.hint ? <p className="drawer-hint">{level.hint}</p> : null}
      <ul className="drawer-list">
        {level.items.map((entry) =>
          entry.children ? (
            <li key={entry.id}>
              <button
                type="button"
                className="drawer-row"
                onClick={() =>
                  setTrail((current) => [
                    ...current,
                    { title: entry.label, hint: entry.hint, items: entry.children ?? [] },
                  ])
                }
              >
                <span className="drawer-row__text">
                  <span className="drawer-row__label">
                    {entry.label}
                    <Badge entry={entry} dueCards={dueCards} mistakes={mistakes} />
                  </span>
                  {entry.hint ? <span className="drawer-row__hint">{entry.hint}</span> : null}
                </span>
                <span className="drawer-row__chevron" aria-hidden="true" />
              </button>
            </li>
          ) : (
            <li key={entry.id}>
              <NavLink
                to={entry.to ?? '/'}
                className="drawer-row"
                onClick={() => setNavOpen(false)}
              >
                <span className="drawer-row__text">
                  <span className="drawer-row__label">
                    {entry.label}
                    <Badge entry={entry} dueCards={dueCards} mistakes={mistakes} />
                  </span>
                  {entry.hint ? <span className="drawer-row__hint">{entry.hint}</span> : null}
                </span>
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </>
  );

  return (
    <>
      <nav
        id="app-nav"
        ref={navRef}
        className={navOpen ? 'app-nav app-nav--open' : 'app-nav'}
        aria-label="Sezioni del sito"
      >
        {narrow ? drawer : NAV.map(renderTop)}
      </nav>

      <div className="user-chip">
        <ThemeToggle />
        {/* Il nome è la porta del profilo: da lì si sceglie come farsi chiamare.
            Se è ancora quello generato, lo diciamo qui: è il momento in cui lo
            studente sta guardando. */}
        <Link className="user-chip__name" to="/profilo" title="Il tuo profilo: il tuo nome">
          <span className="user-chip__label">{user?.username ?? ''}</span>
          {nameIsGenerated ? (
            <span className="user-chip__hint">(cambia qui il tuo nome)</span>
          ) : null}
        </Link>
      </div>

      {/* Sotto i 1080px le voci non stanno in una riga: il menù si apre da
          qui, e il cassetto scende un livello alla volta. */}
      <button
        type="button"
        className="btn btn--sm btn--ghost nav-toggle"
        onClick={() => {
          setNavOpen((open) => !open);
          setTrail([DRAWER_ROOT]);
        }}
        aria-expanded={navOpen}
        aria-controls="app-nav"
        aria-label={navOpen ? 'Chiudi il menù' : 'Apri il menù'}
        title={navOpen ? 'Chiudi il menù' : 'Apri il menù'}
      >
        {/* Tre barre disegnate, non ☰ e ✕: quei caratteri mancano in molti
            font e sul sistema sbagliato diventano due quadratini. */}
        <span className="nav-toggle__bars" data-open={navOpen ? 'true' : 'false'} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {navOpen && narrow ? (
        <button
          type="button"
          className="nav-scrim"
          onClick={() => setNavOpen(false)}
          aria-label="Chiudi il menù"
          tabIndex={-1}
        />
      ) : null}
    </>
  );
}
