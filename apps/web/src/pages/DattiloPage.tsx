import { useMemo, useState, type KeyboardEvent } from 'react';
import { PronounceButton } from '../components/PronounceButton';
import {
  DOUBLE_TAILS,
  KEY_TO_JAMO,
  LAYOUT_ROWS,
  SHIFT_TO_JAMO,
  TYPED_VOWELS,
  TYPING_LEVELS,
  TYPING_PHRASES,
  keysText,
  keystrokesFor,
  typedText,
  type TypingLevel,
} from '../dubeolsik';
import { shuffle } from '../palestra-drill';

/**
 * La pagina della tastiera coreana.
 *
 * Lo studente non ha una tastiera coreano installato, e non gli serve per
 * imparare i posti: qui preme le lettere del suo computer e sono i moduli di
 * `dubeolsik.ts` a tradurle in jamo, come farebbe un IME. La memoria che si
 * forma è di posti e di movimenti, quindi è quella che si ritrova su un
 * computer di Seul, su una tastiera coreana, su un telefono con la tastiera
 * coreana.
 */

/** Le file del drill: quelle di difficoltà più le frasi da digitare tutte d'un fiato. */
const PRACTICE: TypingLevel[] = [
  ...TYPING_LEVELS,
  {
    id: 'frasi',
    label: 'Frasi fatte',
    blurb:
      'Cinque parole che si digitano a memoria: sono i blocchi che in coreano si imparano come un solo movimento, e qui si diventa veloci su quelli.',
    words: TYPING_PHRASES,
  },
];

/* -------------------------------------------------------------------------- */
/* La mappa dei tasti                                                         */
/* -------------------------------------------------------------------------- */

function KeyboardMap({ next }: { next?: string | null }) {
  return (
    <div className="keyboard" aria-label="Mappa della tastiera coreana due gruppi">
      {LAYOUT_ROWS.map((row, index) => (
        <div className="keyboard-row" key={index}>
          {row.map((cap) => (
            <div
              className={cap.key === next ? 'kb-key kb-key--next' : 'kb-key'}
              key={cap.key}
              title={`${cap.key} = ${cap.jamo}${cap.shift ? ` · Shift+${cap.key} = ${cap.shift}` : ''}`}
            >
              <span className="kb-key-key">{cap.key}</span>
              <span className="kb-key-jamo" lang="ko">
                {cap.jamo}
              </span>
              {cap.shift ? (
                <span className="kb-key-shift" lang="ko">
                  {cap.shift}
                </span>
              ) : (
                <span className="kb-key-shift" aria-hidden="true">
                  ·
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Il drill                                                                   */
/* -------------------------------------------------------------------------- */

function TypingDrill({ level }: { level: TypingLevel }) {
  // L'ordine è mescolato all'ingresso nella file: la terza volta che si torna
  // su «rispediti» la mano non deve sapere quale parola viene dopo.
  const words = useMemo(() => shuffle(level.words), [level.id]);
  const [index, setIndex] = useState(0);
  const [pressed, setPressed] = useState('');
  const [reveal, setReveal] = useState(true);
  const [done, setDone] = useState<number[]>([]);

  const word = words[index];
  const expected = useMemo(() => keystrokesFor(word.ko) ?? [], [word.ko]);

  const mistakes = pressed
    .split('')
    .filter((key, position) => key !== expected[position]).length;
  const finished = pressed === keysText(expected);
  const nextKey = expected[pressed.length] ?? null;

  function advance() {
    const order = (index + 1) % words.length;
    setIndex(order);
    setPressed('');
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      setPressed((current) => current.slice(0, -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (finished) {
        setDone((current) => (current.includes(index) ? current : [...current, index]));
        advance();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setPressed('');
      return;
    }
    if (event.key.length !== 1) return;

    const upper = event.key.toUpperCase();
    const scrive = KEY_TO_JAMO[upper] ?? (event.key === upper ? SHIFT_TO_JAMO[upper] : undefined);
    if (!scrive) return;

    // Il tasto è uno di quelli che scrivono coreano: lo prendiamo noi, non il
    // campo, così una «r» resta ㄱ anche su una tastiera italiana.
    event.preventDefault();
    setPressed((current) => current + event.key);
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row row--between" style={{ alignItems: 'baseline' }}>
          <p className="ko-lg" style={{ margin: 0 }} lang="ko">
            {word.ko} <PronounceButton text={word.ko} label={word.ko} />
          </p>
          <span className="badge">
            {index + 1} / {words.length}
          </span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          <strong>{word.it}</strong>
        </p>

        <input
          className="input input--ko"
          value={typedText(pressed)}
          readOnly
          onKeyDown={handleKey}
          placeholder="Clicca qui e scrivi: i tasti latino del tuo computer sono i tasti coreani"
          aria-label={`Scrivi ${word.ko} con la tastiera coreana`}
          autoComplete="off"
          spellCheck={false}
          lang="ko"
        />

        <div className="trail" aria-label="Tasti premuti">
          {expected.map((key, position) => {
            const typed = pressed[position];
            const classes = ['trail-key'];
            if (typed === undefined) classes.push(reveal ? 'trail-key--next-key' : 'trail-key--hidden');
            else if (typed === key) classes.push('trail-key--ok');
            else classes.push('trail-key--bad');

            return (
              <span className={classes.join(' ')} key={position}>
                {reveal || typed !== undefined ? key : '·'}
              </span>
            );
          })}
        </div>

        <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={reveal}
            onChange={(event) => setReveal(event.target.checked)}
          />
          <span className="small">Mostra i tasti da premere</span>
        </label>

        <KeyboardMap next={reveal && !finished ? nextKey : null} />

        {finished ? (
          <div className="alert alert--ok" aria-live="polite">
            <p>
              <strong>Digitato</strong> —{' '}
              <span className="ko" lang="ko">
                {word.ko}
              </span>{' '}
              = <span className="trail-key trail-key--ok">{keysText(expected)}</span>
            </p>
            <p className="small">
              {mistakes === 0
                ? 'Nessun tasto fuori posto.'
                : `${mistakes} ${mistakes === 1 ? 'tasto fuori posto' : 'tasti fuori posto'}: ricomincia la parola e guarda solo i posti.`}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDone((current) => (current.includes(index) ? current : [...current, index]));
                advance();
              }}
              autoFocus
            >
              Prossima parola
            </button>
          </div>
        ) : (
          <p className="faint small" style={{ margin: 0 }}>
            Esc = ricomincia la parola · Spazio cancella un tasto · Invio = passa alla parola dopo
          </p>
        )}
      </section>

      <p className="faint small center" aria-live="polite">
        {done.length === 0
          ? 'Parole digitate in questa file: nessuna'
          : `Parole digitate in questa file: ${done.length} di ${words.length}`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagina                                                                     */
/* -------------------------------------------------------------------------- */

export function DattiloPage() {
  const [mode, setMode] = useState(PRACTICE[0].id);
  const level = PRACTICE.find((entry) => entry.id === mode) ?? PRACTICE[0];

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">타자 · La tastiera</p>
        <h1>Scrivere coreano con le mani</h1>
        <p className="muted">
          La tastiera coreana standard si chiama 두벌식, «a due gruppi»: le consonanti stanno sulla
          mano sinistra, le vocali sulla destra. È la tastiera di un computer coreano, la seconda
          lingua di ogni sistema operativo, quella che si trova in ufficio e in università.
        </p>
        <p className="muted">
          Qui non serve installarla: premi i tasti del tuo computer e la pagina li traduce in jamo,
          poi compone le sillabe come fa un IME coreano. Ciò che impari sono i posti, e i posti sono
          gli stessi su una tastiera stampata in coreano.
        </p>
      </header>

      <div className="chips" role="tablist" aria-label="File di digitazione">
        {PRACTICE.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className={entry.id === mode ? 'chip chip--on' : 'chip'}
            aria-selected={entry.id === mode}
            onClick={() => setMode(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: '-0.4rem' }}>
        {level.blurb}
      </p>

      <TypingDrill key={level.id} level={level} />

      <section className="card stack">
        <h2>Le tre regole della tastiera</h2>
        <ul className="points">
          <li>
            <strong>La file di mezzo per prima.</strong> A sinistra ㅁ ㄴ ㅇ ㄹ ㅎ (A S D F G), a
            destra ㅗ ㅓ ㅏ ㅣ (H J K L): nove tasti, e coprono una buona parte del coreano che si
            usa ogni giorno.
          </li>
          <li>
            <strong>Shift fa le doppie, sempre.</strong> {'ㄲ R · ㄸ E · ㅃ Q · ㅆ T · ㅉ W · ㅒ O · ㅖ P'}.
            Sono sette, e sono le uniche lettere che richiedono lo Shift.
          </li>
          <li>
            <strong>Quello che non ha un tasto si digita in due.</strong> Le vocali composte e i
            ricevitivi doppi sono due tasti in fila, nell'ordine in cui si vedono: ㅘ = ㅗ poi ㅏ, ㄺ = ㄹ
            poi ㄱ.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Le vocali senza tasto</h2>
        <div className="row row--wrap">
          {TYPED_VOWELS.map((pair) => (
            <span className="chip chip--ko" key={pair.vowel} lang="ko">
              {pair.vowel} = {pair.keys[0]}
              {pair.keys[1]}
            </span>
          ))}
        </div>
        <p className="faint small" style={{ margin: 0 }}>
          ㅐ e ㅔ non sono in elenco: il tasto ce l'hanno già (O e P, con Shift per ㅒ e ㅖ), e un IME
          coreano non le compone dalle vocali semplici.
        </p>
      </section>

      <section className="card stack">
        <h2>I ricevitivi doppi</h2>
        <div className="row row--wrap">
          {Object.entries(DOUBLE_TAILS).map(([tail, [first, second]]) => (
            <span className="chip chip--ko" key={tail} lang="ko">
              {tail} = {first}
              {second}
            </span>
          ))}
        </div>
        <p className="faint small" style={{ margin: 0 }}>
          Si premono in fila le due consonanti che si vedono nella sillaba: 닭 sono i tasti e k f r,
          non un tasto speciale.
        </p>
      </section>

      <section className="card stack">
        <h2>Digitare fuori dall'app</h2>
        <ul className="points">
          <li>
            <strong>La tastiera coreana si aggiunge, non si compra.</strong> Windows: Impostazioni →
            Lingua → aggiungi «Coreano»; macOS: Taste di sistema → Tastiere → «Korean — 2-Set»; su
            telefono, aggiungi la tastiera coreana. Il layout che si attiva è questo, lo stesso su
            tutti i sistemi.
          </li>
          <li>
            <strong>Numeri e punteggiatura non cambiano.</strong> Il due gruppi è costruito sul
            QWERTY americano e lascia stare i tasti attorno alle lettere: si scrive un 4 dove si è
            sempre scritto un 4.
          </li>
          <li>
            <strong>La vocale che inizia una sillaba vuole la ㅇ muta.</strong> 앞 si digita ㅇ ㅏ ㅂ,
            quindi d k q: la prima lettera del blocco è sempre una consonante, anche quando non si
            sente.
          </li>
        </ul>
      </section>
    </div>
  );
}
