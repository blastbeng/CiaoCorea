import { useRef, useState } from 'react';
import type { WordLookupResponse } from '@ciaocorea/shared';
import { api } from '../api';
import { JamoBreakdown } from './JamoBreakdown';
import { PronounceButton } from './PronounceButton';

/**
 * Ogni parola coreana si può cliccare. La scheda dice come si legge — la
 * romanizzazione e l'audio — e che cosa vuol dire; le parole che il dizionario
 * non conosce restano comunque cliccabili per l'audio, perché la lettura serve
 * prima del significato.
 *
 * Una scheda alla volta, in tutta la pagina: aprirne una chiude quella di prima,
 * così il testo non si riempie di riquadri sovrapposti.
 */
let closeOpenWord: { id: object; close: () => void } | null = null;

/** La parola dentro il testo, con la sua scheda. */
export function WordToken({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [match, setMatch] = useState<WordLookupResponse['match']>(null);
  const [letters, setLetters] = useState(false);
  const selfRef = useRef<object | null>(null);

  const parts = token.match(/^([^가-힣]*)([가-힣]+)([^가-힣]*)$/);
  if (!parts) return <>{token}</>;
  const [, before, word, after] = parts;
  // La cifra fa parte della parola: 5층 è "il quinto piano", non "층" da solo,
  // e 1만 è diecimila, non la particella 만 ("solo").
  const digits = before.match(/(\d[\d,]*)$/);
  const query = digits ? `${digits[1]}${word}` : word;

  async function toggle() {
    const me = (selfRef.current ??= {});
    if (open) {
      setOpen(false);
      if (closeOpenWord?.id === me) closeOpenWord = null;
      return;
    }
    if (closeOpenWord && closeOpenWord.id !== me) closeOpenWord.close();
    closeOpenWord = { id: me, close: () => setOpen(false) };
    setOpen(true);
    if (asked || loading) return;
    setLoading(true);
    try {
      const result = await api.lookupWord(query);
      setMatch(result.match);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
      setAsked(true);
    }
  }

  const head = match ? match.ko : word;

  return (
    <span className="word-wrap">
      {before}
      <button
        type="button"
        className={`word${open ? ' word--open' : ''}`}
        aria-expanded={open}
        onClick={toggle}
      >
        {word}
      </button>
      {after}
      {open ? (
        <span className="wordcard">
          <span className="row row--between" style={{ alignItems: 'center' }}>
            <strong className="ko">{head}</strong>
            <PronounceButton text={head} label={word} />
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-expanded={letters}
            onClick={() => setLetters((value) => !value)}
          >
            {letters ? 'nascondi le lettere' : 'lettera per lettera'}
          </button>
          {letters ? <JamoBreakdown text={head} /> : null}
          {loading ? <span className="faint small">Cerco nel dizionario…</span> : null}
          {!loading && match ? (
            <>
              <span>{match.it}</span>
              <span className="faint small">{match.rr}</span>
              {match.senses && match.senses.length > 0 ? (
                <span className="faint small">
                  anche: {match.senses.map((sense) => sense.it).join(' · ')}
                </span>
              ) : null}
              {match.via === 'particle' && match.particle ? (
                <>
                  <span className="faint small">
                    nel testo: {word} = {match.ko} + {match.particle}
                  </span>
                  {match.particleHint ? (
                    <span className="faint small">{match.particleHint}</span>
                  ) : null}
                </>
              ) : null}
              {match.via === 'copula' && match.suffix ? (
                <span className="faint small">
                  nel testo: {word} = {match.ko} + {match.suffix}
                </span>
              ) : null}
              {match.via === 'stem' ? (
                <span className="faint small">
                  forma di {match.ko}
                  {match.ending ? ` (desinenza -${match.ending})` : ''}
                </span>
              ) : null}
              {match.note ? <span className="faint small">{match.note}</span> : null}
            </>
          ) : null}
          {!loading && !match ? (
            <span className="faint small">
              Non è ancora nel dizionario del corso: ascolta come si legge.
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Un testo coreano parola per parola: si legge, e ogni parola si può toccare
 * per sapere come suona e che cosa significa. Va bene per i brani, per le
 * battute dei dialoghi, per qualunque coreano che lo studente deve leggere.
 */
export function KoreanText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(' ').map((token, index) => (
        <span key={`${token}-${index}`}>
          {index > 0 ? ' ' : ''}
          <WordToken token={token} />
        </span>
      ))}
    </span>
  );
}
