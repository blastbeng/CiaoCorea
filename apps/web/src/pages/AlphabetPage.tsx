import { useMemo, useState } from 'react';
import {
  CONSONANTS,
  FINALS,
  TABLE_LEADS,
  TABLE_TAILS,
  TABLE_VOWELS,
  VOWELS,
  composeSyllable,
  jamoInfo,
  romanizeSyllable,
  type ConsonantLetter,
} from '@ciaocorea/engine';
import { PronounceButton } from '../components/PronounceButton';

const KIND_LABEL: Record<ConsonantLetter['kind'], string> = {
  base: 'di base',
  tense: 'tesa',
  aspirated: 'aspirata',
};

/** Il nome di una lettera: ㄱ → 기역. */
function nameOf(char: string): string {
  return jamoInfo(char)?.name ?? '';
}

export function AlphabetPage() {
  const [lead, setLead] = useState('ㄱ');
  const [vowel, setVowel] = useState('ㅏ');
  const [tail, setTail] = useState('');
  const [openConsonant, setOpenConsonant] = useState('ㄱ');
  const [openVowel, setOpenVowel] = useState('ㅏ');
  const [cell, setCell] = useState('가');

  const composed = useMemo(() => composeSyllable(lead, vowel, tail) ?? '', [lead, vowel, tail]);
  const consonant = CONSONANTS.find((letter) => letter.char === openConsonant) ?? CONSONANTS[0];
  const vowelLetter = VOWELS.find((letter) => letter.char === openVowel) ?? VOWELS[0];
  const cellParts = useMemo(() => {
    const first = cell.charAt(0);
    const second = cell.charAt(1);
    return { lead: first, vowel: second };
  }, [cell]);

  return (
    <div className="stack alpha">
      <header className="stack stack--tight">
        <p className="faint small">한글 · L'alfabeto</p>
        <h1>Quaranta lettere, un solo blocco</h1>
        <p className="muted">
          L'hangul non è un disegno da copiare a memoria: ogni sillaba è un blocco che mette insieme
          una consonante, una vocale e, se serve, una consonante finale. Quando conosci le lettere,
          sai leggere anche una parola che non hai mai visto.
        </p>
      </header>

      <section className="card stack alpha-composer" aria-labelledby="alpha-composer-title">
        <h2 id="alpha-composer-title">Prova a comporre una sillaba</h2>
        <div className="alpha-composer-controls">
          <label>
            Consonante iniziale
            <select value={lead} onChange={(event) => setLead(event.target.value)}>
              {CONSONANTS.map((letter) => (
                <option key={letter.char} value={letter.char}>
                  {letter.char} · {letter.rr} ({letter.name})
                </option>
              ))}
            </select>
          </label>
          <label>
            Vocale
            <select value={vowel} onChange={(event) => setVowel(event.target.value)}>
              {VOWELS.map((letter) => (
                <option key={letter.char} value={letter.char}>
                  {letter.char} · {letter.rr} ({letter.name})
                </option>
              ))}
            </select>
          </label>
          <label>
            Finale (facoltativa)
            <select value={tail} onChange={(event) => setTail(event.target.value)}>
              {TABLE_TAILS.map((letter) => (
                <option key={letter || 'none'} value={letter}>
                  {letter === '' ? 'nessuna' : letter}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="alpha-result" aria-live="polite">
          <span className="alpha-result-char" lang="ko">
            {composed}
          </span>
          <div className="alpha-result-text">
            <p className="alpha-result-rr">{composed ? romanizeSyllable(composed) : '—'}</p>
            <p className="alpha-result-parts">
              {lead} ({nameOf(lead)}) + {vowel} ({nameOf(vowel)})
              {tail ? ` + ${tail} (${nameOf(tail)})` : ''}
            </p>
            <PronounceButton text={composed} label={composed} />
          </div>
        </div>
        <p className="muted">
          La finale non si pronuncia «staccata»: chiude la sillaba e basta. In 밥 la ㅂ chiude la
          bocca senza far uscire aria.
        </p>
      </section>

      <section className="stack" aria-labelledby="alpha-consonants-title">
        <h2 id="alpha-consonants-title">Le consonanti</h2>
        <p className="muted">
          Diciannove lettere in tre famiglie: le cinque di base (ㄱ ㄷ ㅂ ㅅ ㅈ), le loro versioni{' '}
          <strong>tese</strong> (ㄲ ㄸ ㅃ ㅆ ㅉ) e le <strong>aspirate</strong> (ㅋ ㅌ ㅍ ㅊ), che si
          pronunciano con un soffio d'aria.
        </p>
        <div className="alpha-grid">
          {CONSONANTS.map((letter) => (
            <button
              key={letter.char}
              type="button"
              className={letter.char === openConsonant ? 'alpha-tile alpha-tile--on' : 'alpha-tile'}
              onClick={() => setOpenConsonant(letter.char)}
              aria-pressed={letter.char === openConsonant}
            >
              <span className="alpha-tile-char" lang="ko">
                {letter.char}
              </span>
              <span className="alpha-tile-rr">{letter.rr}</span>
              <span className={`alpha-tile-kind alpha-tile-kind--${letter.kind}`}>
                {KIND_LABEL[letter.kind]}
              </span>
            </button>
          ))}
        </div>

        <article className="card alpha-detail">
          <div className="alpha-detail-head">
            <span className="alpha-detail-char" lang="ko">
              {consonant.char}
            </span>
            <div>
              <h3>
                {consonant.name} · {consonant.rr}
              </h3>
              <p className="muted">
                Suono {consonant.ipa} · consonante {KIND_LABEL[consonant.kind]}
              </p>
            </div>
            <PronounceButton text={consonant.example} label={consonant.example} />
          </div>
          <p>{consonant.sound}</p>
          <p className="alpha-example">
            Con la vocale ㅏ: <strong lang="ko">{consonant.example}</strong>{' '}
            <span className="muted">({romanizeSyllable(consonant.example)})</span>
          </p>
        </article>
      </section>

      <section className="stack" aria-labelledby="alpha-vowels-title">
        <h2 id="alpha-vowels-title">Le vocali</h2>
        <p className="muted">
          Dieci vocali semplici e undici composte. Le composte sono due vocali unite: ㅗ + ㅏ = ㅘ,
          ㅜ + ㅓ = ㅝ. La seconda parte si scrive sempre a destra o sotto la prima.
        </p>
        <div className="alpha-grid alpha-grid--vowels">
          {VOWELS.map((letter) => (
            <button
              key={letter.char}
              type="button"
              className={letter.char === openVowel ? 'alpha-tile alpha-tile--on' : 'alpha-tile'}
              onClick={() => setOpenVowel(letter.char)}
              aria-pressed={letter.char === openVowel}
            >
              <span className="alpha-tile-char" lang="ko">
                {letter.char}
              </span>
              <span className="alpha-tile-rr">{letter.rr}</span>
              <span className="alpha-tile-kind">
                {letter.from ? letter.from.join(' + ') : 'semplice'}
              </span>
            </button>
          ))}
        </div>

        <article className="card alpha-detail">
          <div className="alpha-detail-head">
            <span className="alpha-detail-char" lang="ko">
              {vowelLetter.char}
            </span>
            <div>
              <h3>
                {vowelLetter.name} · {vowelLetter.rr}
              </h3>
              <p className="muted">Suono {vowelLetter.ipa}</p>
            </div>
            <PronounceButton text={vowelLetter.name} label={vowelLetter.name} />
          </div>
          <p>{vowelLetter.sound}</p>
          {vowelLetter.from ? (
            <p className="alpha-example">
              Nasce da {vowelLetter.from[0]} + {vowelLetter.from[1]}:{' '}
              <strong lang="ko">{vowelLetter.name}</strong>{' '}
              <span className="muted">({romanizeSyllable(vowelLetter.name)})</span>
            </p>
          ) : null}
        </article>
      </section>

      <section className="stack" aria-labelledby="alpha-table-title">
        <h2 id="alpha-table-title">La tabella delle sillabe</h2>
        <p className="muted">
          Ogni casella è una sillaba vera: riga la consonante, colonna la vocale. Le sillabe di una
          riga cominciano tutte con lo stesso suono; quelle di una colonna finiscono tutte con la
          stessa vocale. Tocca una casella per leggerla.
        </p>
        <div className="alpha-table-wrap">
          <table className="alpha-table">
            <caption className="sr-only">
              Sillabe formate dalle quattordici consonanti e dalle dodici vocali più comuni
            </caption>
            <thead>
              <tr>
                <th scope="col">—</th>
                {TABLE_VOWELS.map((letter) => (
                  <th key={letter} scope="col" lang="ko">
                    {letter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_LEADS.map((leadChar) => (
                <tr key={leadChar}>
                  <th scope="row" lang="ko">
                    {leadChar}
                  </th>
                  {TABLE_VOWELS.map((vowelChar) => {
                    const syllable = composeSyllable(leadChar, vowelChar);
                    if (!syllable) return <td key={vowelChar}>·</td>;
                    return (
                      <td key={vowelChar}>
                        <button
                          type="button"
                          className={
                            syllable === cell ? 'alpha-cell alpha-cell--on' : 'alpha-cell'
                          }
                          onClick={() => setCell(syllable)}
                          aria-pressed={syllable === cell}
                          aria-label={`${syllable}, ${romanizeSyllable(syllable)}`}
                        >
                          <span lang="ko">{syllable}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="alpha-cell-detail" aria-live="polite">
          <span lang="ko">{cell}</span>
          <div>
            <p>
              {romanizeSyllable(cell)} · {nameOf(cellParts.lead)} + {nameOf(cellParts.vowel)}
            </p>
            <p className="muted">
              {cellParts.lead} suona [{jamoInfo(cellParts.lead)?.ipa ?? '—'}] davanti alla vocale.
            </p>
          </div>
          <PronounceButton text={cell} label={cell} />
        </div>

        <p className="muted">
          Le vocali ㅒ, ㅖ, ㅘ, ㅙ, ㅚ, ㅝ, ㅞ, ㅟ, ㅢ seguono le stesse regole: cambia la vocale,
          non il meccanismo.
        </p>
      </section>

      <section className="stack" aria-labelledby="alpha-finals-title">
        <h2 id="alpha-finals-title">Le consonanti finali: sette suoni, ventisette lettere</h2>
        <p className="muted">
          In fondo alla sillaba si possono scrivere ventisette combinazioni di lettere, ma i suoni
          sono solo sette: le altre si riducono a uno di questi. Per questo 값 «valore» e 갑 «guscio»
          finiscono con lo stesso suono, [kap̚].
        </p>
        <div className="alpha-finals">
          {FINALS.map((final) => (
            <article key={final.ipa} className="card alpha-final">
              <p className="alpha-final-ipa">[{final.ipa}]</p>
              <p className="alpha-final-letters" lang="ko">
                {final.letters.join(' ')}
              </p>
              <p>{final.sound}</p>
              <ul className="alpha-final-examples">
                {final.examples.map((example) => (
                  <li key={example.ko}>
                    <strong lang="ko">{example.ko}</strong>{' '}
                    <span className="muted">
                      {example.rr} · {example.it}
                    </span>{' '}
                    <PronounceButton text={example.ko} label={example.ko} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="alpha-next-title">
        <h2 id="alpha-next-title">Da dove cominciare</h2>
        <ol className="alpha-steps">
          <li>
            Impara a riconoscere le cinque consonanti di base ㄱ ㄴ ㄷ ㅂ ㅅ e le vocali ㅏ ㅓ ㅗ ㅜ
            ㅡ ㅣ.
          </li>
          <li>
            Componi con il riquadro qui sopra: ㄱ + ㅏ = 가, ㄴ + ㅜ = 누, ㅅ + ㅣ = 시. Leggi ad
            alta voce, poi ascolta.
          </li>
          <li>
            Aggiungi le aspirate ㅋ ㅌ ㅍ ㅊ e le tese ㄲ ㄸ ㅃ ㅆ ㅉ: sono le coppie che agli
            italiani riescono più difficili, perché l'italiano non distingue un suono «teso» da uno
            «aspirato».
          </li>
          <li>
            Passa alle finali: chiudono la sillaba e cambiano la parola (하 «ha» e 한 «han» non sono
            la stessa cosa).
          </li>
        </ol>
      </section>
    </div>
  );
}
