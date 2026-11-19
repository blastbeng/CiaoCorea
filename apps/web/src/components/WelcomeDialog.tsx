import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** La data dell'ultima visita: `YYYY-MM-DD`, nel fuso di chi studia. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function seenToday(): boolean {
  try {
    return window.localStorage.getItem('ciaocorea.welcome.v1') === today();
  } catch {
    // Memoria del browser bloccata: il messaggio compare, e non è un danno.
    return false;
  }
}

/**
 * Il benvenuto del primo avvio del giorno. Non è una pagina di marketing: è la
 * spiegazione di come funziona il posto, prima che lo studente cominci —
 * compreso il fatto che i progressi restano in questo browser e non seguono
 * su altri dispositivi. Si apre una volta al giorno, non a ogni pagina.
 */
export function WelcomeDialog() {
  const [open, setOpen] = useState(() => !seenToday());
  const startRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem('ciaocorea.welcome.v1', today());
    } catch {
      // Se il browser non lascia scrivere, il messaggio torna domani: peggio
      // di così non va.
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    startRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);

    // Il foglio sotto non deve scorrere mentre si legge il benvenuto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-intro"
    >
      <button type="button" className="modal__backdrop" aria-label="Chiudi" onClick={close} />
      <div className="modal__panel">
        <p className="modal__eyebrow">CiaoCorea · Impara il Coreano</p>
        <h2 className="modal__title" id="welcome-title">
          Benvenuti!
        </h2>
        <p className="modal__lead" id="welcome-intro">
          Qui si impara il coreano partendo dall'alfabeto: lezioni brevi, esercizi corretti subito,
          testi da leggere, dialoghi da seguire e un quaderno per scrivere. Toccando l'altoparlante
          accanto a una parola la senti pronunciata.
        </p>

        <div className="welcome-points">
          <div className="welcome-point">
            <span className="welcome-point__title">Un passo alla volta</span>
            <p className="muted small">
              Il percorso parte dalle lettere e arriva alle frasi vere. La home ti dice che cosa
              fare oggi; le parole tornano da ripassare quando è il momento di rivederle.
            </p>
          </div>

          <div className="welcome-point">
            <span className="welcome-point__title">I progressi restano in questo browser</span>
            <p className="muted small">
              CiaoCorea non ha un account e non ha un server: quello che fai — lezioni, esercizi,
              testi, ripassi — viene salvato dentro il browser che stai usando, in questo computer
              o telefono. Da un altro dispositivo trovi il percorso dall'inizio, perché i progressi
              non sono stati copiati da nessuna parte. Per la stessa ragione non c'è una password:
              non c'è niente, da nessuna parte, a cui accedere.
            </p>
          </div>

          <div className="welcome-point">
            <span className="welcome-point__title">Più persone, un computer</span>
            <p className="muted small">
              Si può scegliere il proprio nome e passare da un profilo all'altro: i progressi
              restano separati. Non cancellare i dati del sito e non usare la navigazione in
              incognito, se ci tieni ai progressi: sono le uniche due cose che li fanno sparire.
            </p>
          </div>
        </div>

        <div className="modal__actions">
          <button ref={startRef} type="button" className="btn btn--primary" onClick={close}>
            Si comincia
          </button>
          <Link className="btn btn--ghost" to="/about" onClick={close}>
            Chi c'è dietro
          </Link>
        </div>
        <p className="faint small modal__note">
          Questo messaggio compare una volta al giorno. Lo ritrovi nella pagina «Chi sono».
        </p>
      </div>
    </div>
  );
}
