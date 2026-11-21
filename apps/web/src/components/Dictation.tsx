import { useState } from 'react';
import type { VocabItem } from '@ciaocorea/shared';
import { compact } from '@ciaocorea/engine';
import { speakKorean, ttsSupported } from '../pronounce';
import { HangulInput } from './HangulInput';
import { PronounceButton } from './PronounceButton';

const ROUND_SIZE = 6;

/** Mescolamento di Fisher-Yates: ogni ordine ha la stessa probabilità. */
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Solo parole singole: un dettato su «-(으)ㄹ 수 있다» non misura l'ortografia,
 * misura la memoria di una formula. Le voci con spazi, trattini o parentesi
 * restano fuori.
 */
function draw(items: readonly VocabItem[]): VocabItem[] {
  const pool = items.filter((item) => /^[가-힣]+$/.test(item.ko.trim()));
  return shuffle(pool).slice(0, Math.min(ROUND_SIZE, pool.length));
}

/**
 * Dettato breve sulle parole della lezione.
 *
 * Non è un esercizio valutato: non tocca il progresso e non finisce negli
 * errori. Serve a separare due cose che a leggere sembrano una sola — sentire
 * una parola e saperla scrivere — e a farlo con il lessico che si ha davanti
 * in quel momento. Il significato resta sempre visibile: senza di esso, per
 * chi comincia, il dettato sarebbe un indovinello; con esso resta un esercizio
 * di ortografia, che è quello che serve.
 */
export function Dictation({ items, lessonId }: { items: VocabItem[]; lessonId: string }) {
  // Le parole si mescolano al montaggio e solo quando lo studente ricomincia:
  // un cambio di render non deve rimescolarle sotto le dita.
  const [words, setWords] = useState(() => draw(items));

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<null | boolean>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);

  if (words.length === 0) return null;

  const current = words[index];
  const canSpeak = ttsSupported();

  function check() {
    if (checked !== null || value.trim() === '') return;
    const ok = compact(value) === compact(current.ko);
    setChecked(ok);
    if (ok) setRight((count) => count + 1);
  }

  function next() {
    if (index + 1 >= words.length) {
      setFinished(true);
      return;
    }
    setIndex((position) => position + 1);
    setValue('');
    setChecked(null);
  }

  function restart() {
    setWords(draw(items));
    setIndex(0);
    setValue('');
    setChecked(null);
    setRight(0);
    setFinished(false);
  }

  return (
    <section className="card" aria-labelledby={`dettato-${lessonId}`}>
      <div className="row row--between" style={{ alignItems: 'baseline', marginBottom: '0.35rem' }}>
        <h2 id={`dettato-${lessonId}`} style={{ margin: 0 }}>
          Dettato
        </h2>
        <span className="badge">
          {finished ? `${right}/${words.length}` : `${index + 1} di ${words.length}`}
        </span>
      </div>

      <p className="muted small" style={{ marginTop: 0 }}>
        {canSpeak
          ? 'Ascolta la parola e scrivila in coreano. Puoi riascoltarla quante volte vuoi, anche più lentamente.'
          : 'Il tuo browser non ha una voce coreana: scrivi la parola partendo dal significato, poi controlla.'}
      </p>

      {finished ? (
        <div className="stack">
          <p className={right === words.length ? 'alert alert--ok' : 'alert alert--info'} role="status">
            {right === words.length
              ? `Tutte giuste: ${right} su ${words.length}.`
              : `${right} su ${words.length}. Le parole sbagliate si possono riascoltare qui sotto.`}
          </p>
          <ul className="gloss">
            {words.map((word) => (
              <li key={`${word.ko}-${word.it}`}>
                <span className="ko">
                  {word.ko} <PronounceButton text={word.ko} label={word.ko} />
                </span>
                <span className="gloss__it">{word.it}</span>
                <span className="faint small">{word.rr}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn--primary" onClick={restart}>
              Rifai il dettato
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="row" style={{ alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {canSpeak ? (
              <>
                <button type="button" className="btn" onClick={() => speakKorean(current.ko)}>
                  Ascolta
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => speakKorean(current.ko, 0.6)}
                >
                  Più lento
                </button>
              </>
            ) : null}
            <span className="small">
              Significato: <strong>{current.it}</strong>
            </span>
          </div>

          <HangulInput
            value={value}
            onChange={setValue}
            onSubmit={check}
            disabled={checked !== null}
            placeholder="Scrivi la parola che hai sentito"
            autoFocus
          />

          {checked === null ? (
            <div className="row">
              <button
                type="button"
                className="btn btn--primary"
                onClick={check}
                disabled={value.trim() === ''}
              >
                Controlla
              </button>
            </div>
          ) : (
            <div className="stack" role="status">
              <p className={checked ? 'alert alert--ok' : 'alert alert--error'} style={{ margin: 0 }}>
                {checked ? 'Giusto.' : `Non ancora: la parola era «${current.ko}».`}
              </p>
              <div className="row" style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <PronounceButton text={current.ko} label={current.ko} />
                <span className="faint small">{current.rr}</span>
                <button type="button" className="btn btn--primary" onClick={next}>
                  {index + 1 >= words.length ? 'Vedi il risultato' : 'Prossima parola'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
