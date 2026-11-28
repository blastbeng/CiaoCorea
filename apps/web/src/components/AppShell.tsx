import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, PENDING_CHANGED } from '../api';
import { CookieBanner } from './CookieBanner';
import { PronounceNotice } from './PronounceNotice';
import { SiteNav } from './SiteNav';
import { SupportButtons } from './SupportButtons';
import { WelcomeDialog } from './WelcomeDialog';

export function AppShell({ children }: { children: ReactNode }) {
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

        {/* Barra, cassetto, tema e nome: sono una cosa sola, e leggono tutti da
            src/nav.ts. */}
        <SiteNav dueCards={dueCards} mistakes={mistakes} />
      </header>

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
