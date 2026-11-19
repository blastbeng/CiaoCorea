import { useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'ciaocorea.cookies.v1';

function consentGiven(): boolean {
  try {
    // Senza memoria del browser il riquadro non può ricordare la risposta:
    // meglio non mostrarlo che mostrarlo a ogni pagina.
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * Il riquadro dei cookie. Non c'è niente da cedere — il sito è statico e non
 * ha tracciamenti — ma la legge europea chiede di dirlo, e vale la pena dirlo
 * con parole che si capiscono: che cosa salva il browser, dove sta, e che
 * svuotare i dati del sito porta via anche i progressi.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(() => !consentGiven());

  if (!open) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // Se non si può scrivere, il riquadro torna alla prossima apertura.
    }
    setOpen(false);
  };

  return (
    <aside className="cookies" role="region" aria-label="Cookie e memoria del browser">
      <div className="cookies__text">
        <p>
          <strong>Cookie e memoria del browser.</strong> CiaoCorea non usa cookie per tracciarti,
          per farti pubblicità o per profilarti, e nessun dato esce dal tuo dispositivo. Il browser
          conserva soltanto ciò che serve al sito per funzionare: il profilo attivo, i progressi e
          le preferenze come il tema chiaro o scuro.
        </p>
        <p className="faint small">
          Svuotando i dati del sito si cancella anche tutto questo — progressi compresi.{' '}
          <Link to="/about#dati" onClick={() => setOpen(false)}>
            Che cosa salvo, per bene
          </Link>
        </p>
      </div>
      <button type="button" className="btn btn--primary btn--sm" onClick={accept}>
        Accetta
      </button>
    </aside>
  );
}
