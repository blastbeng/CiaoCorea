import { useEffect, useMemo, useState } from 'react';
import type { TextAnalysisResponse } from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';
import { PronounceButton } from '../components/PronounceButton';
import { WordToken } from '../components/KoreanText';

/**
 * Quello che si incontra fuori dal corso: un cartello, un menu, un messaggio.
 * Il testo non si traduce — si spezza in parole, ognuna delle quali si può
 * toccare per la scheda del dizionario e per l'audio. Quello che il corso non
 * ha ancora insegnato resta scritto, ma evidenziato, così si sa che è lì che
 * bisogna tornare.
 */

const SAMPLES: Array<{ label: string; text: string }> = [
  {
    label: 'Un cartello',
    text: '영업 중입니다. 주차 가능합니다.',
  },
  {
    label: 'Una frase del corso',
    text: '수업은 화요일과 목요일 저녁 일곱 시에 시작합니다.',
  },
  {
    label: 'Il tempo',
    text: '오늘은 날씨가 좋아요. 하지만 저는 추운 날씨를 좋아해요.',
  },
];

export function AnalysisPage() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState<TextAnalysisResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Il testo si analizza quando lo studente lo chiede (o quando arriva da un
  // esempio): analizzarlo a ogni tasto premuto vorrebbe dire riempire la
  // pagina di risultati che stanno ancora cambiando sotto gli occhi.
  async function analyze(value: string) {
    const clean = value.trim();
    if (clean === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.analyzeText(clean));
      setAsked(clean);
    } catch (caught) {
      setError(errorMessage(caught));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  // Il primo giro parte da solo sull'esempio: una pagina vuota non spiega
  // che cosa fa.
  useEffect(() => {
    void analyze(SAMPLES[0].text);
    // Solo all'apertura: dopo, è lo studente a decidere quando analizzare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pieces = useMemo(() => result?.tokens ?? [], [result]);

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">읽기 · Leggere</p>
        <h1>Il testo che hai davanti</h1>
        <p className="muted">
          Incolla una frase coreana — un cartello, un messaggio, una riga di una canzone — e tocca
          le parole: ognuna apre la sua scheda, con il significato e la pronuncia. Le parole che il
          corso non ha ancora insegnato restano segnate, così sai dove sei.
        </p>
      </header>

      <section className="card stack" aria-labelledby="analysis-input-title">
        <h2 id="analysis-input-title">Incolla il testo</h2>
        <textarea
          className="input analysis-input"
          lang="ko"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void analyze(text);
            }
          }}
          spellCheck={false}
        />
        <div className="sample-row">
          {SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="chip chip--sample"
              onClick={() => {
                setText(sample.text);
                void analyze(sample.text);
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <div className="row row--between">
          <span className="faint small">Ctrl+Invio per analizzare.</span>
          <button
            type="button"
            className="btn"
            onClick={() => void analyze(text)}
            disabled={busy || text.trim() === ''}
          >
            {busy ? 'Analizzo…' : 'Analizza'}
          </button>
        </div>
        {error ? <p className="alert alert--error">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className="card stack" aria-labelledby="analysis-text-title">
            <div className="row row--between analysis-head">
              <h2 id="analysis-text-title">Parola per parola</h2>
              <p className="faint small">
                {result.words} parole · {result.known} già nel corso ·{' '}
                {result.unknown.length > 0
                  ? `${result.unknown.length} da scoprire`
                  : 'tutte conosciute'}
              </p>
            </div>
            <p className="analysis-text" lang="ko" title={asked}>
              {pieces.map((piece, index) => (
                <WordToken key={`${piece.text}-${index}`} token={piece.text} />
              ))}
            </p>
            <p className="faint small">
              Tocca una parola: la scheda dice come si legge, come si scompone in lettere e che
              cosa significa.
            </p>
          </section>

          {result.unknown.length > 0 ? (
            <section className="card stack" aria-labelledby="analysis-new-title">
              <h2 id="analysis-new-title">Da scoprire</h2>
              <p className="muted small">
                Queste parole non sono ancora nel dizionario del corso. Leggile, ascoltale, e non
                preoccuparti se il senso resta sfumato: torneranno in una lezione.
              </p>
              <ul className="unknown-list">
                {result.unknown.map((word) => (
                  <li key={word} className="unknown-item">
                    <span className="ko" lang="ko">
                      {word}
                    </span>
                    <span className="faint small">{wordReading(result, word)}</span>
                    <PronounceButton text={word} label={word} />
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="alert alert--ok">
              Tutte le parole di questo testo sono già nel corso: è un buon momento per rileggerlo
              senza la scheda.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

/** La lettura ricostruita di una parola sconosciuta, presa dai suoi token. */
function wordReading(result: TextAnalysisResponse, word: string): string {
  const token = result.tokens.find((piece) => piece.hangul && piece.text === word);
  return token?.reading ?? '';
}
