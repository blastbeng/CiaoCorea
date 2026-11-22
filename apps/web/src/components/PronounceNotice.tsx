import { useEffect, useState } from 'react';
import { onPronounceNotice } from '../pronounce';

/**
 * L'avviso che compare quando si chiede l'audio e il dispositivo non ha una
 * voce coreana. Sta nella shell perché il pulsante è ovunque — lessico, brani,
 * dialoghi — e ogni pagina dovrebbe spiegare il silenzio allo stesso modo.
 */
export function PronounceNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => onPronounceNotice(setMessage), []);

  if (message === null) return null;

  return (
    <aside className="pronounce-note" role="status" aria-live="polite">
      <p className="small">{message}</p>
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        onClick={() => setMessage(null)}
      >
        Ho capito
      </button>
    </aside>
  );
}
