import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CONJUGATION_CLASSES,
  CONJUGATION_ENDINGS,
  conjugate,
  pronunciationRomanize,
} from '@ciaocorea/engine';
import { api } from '../api';
import { HangulInput } from '../components/HangulInput';
import { PronounceButton } from '../components/PronounceButton';

/**
 * «Coniuga»: si scrive la voce del dizionario (먹다, 살다, 모르다) e si vede la
 * tabella delle forme che il percorso insegna. Le forme vengono dal motore
 * `conjugate`, che per ogni classe segue il paradigma verificato nei test: se
 * una forma non è sicura, la pagina mostra «—» invece di inventarla.
 *
 * Serve a due cose: rispondere a «come si dice …?» mentre si legge una lezione,
 * e far vedere *perché* una radice irregolare si comporta così — accanto alla
 * tabella c'è la regola della classe, con le altre voci che le somigliano.
 */

/** Le voci da cui partire: una per classe, così la pagina si capisce subito. */
const STARTERS = ['먹다', '가다', '공부하다', '듣다', '살다', '붓다', '춥다', '빨갛다', '모르다', '쓰다'];

export function ConiugaPage() {
  const [query, setQuery] = useState('');
  const [lemma, setLemma] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [params] = useSearchParams();

  // Dal dizionario si arriva qui con ?w=먹다: la parola è già scelta.
  useEffect(() => {
    const word = params.get('w')?.trim();
    if (word) {
      setQuery(word);
      setLemma(word);
    }
  }, [params]);

  // I suggerimenti sono le voci del dizionario del percorso: si evita di
  // coniugare parole che poi il corso non usa, e si vede subito come si scrive.
  useEffect(() => {
    const text = query.trim();
    if (text.length === 0) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      api
        .vocabulary(text, '', 0, 24)
        .then((response) => {
          if (!active) return;
          const words = response.entries
            .map((entry) => entry.ko)
            .filter((ko) => ko.endsWith('다') && !ko.includes(' '));
          setSuggestions([...new Set(words)].slice(0, 8));
        })
        .catch(() => {
          if (active) setSuggestions([]);
        });
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const table = useMemo(() => (lemma ? conjugate(lemma) : null), [lemma]);
  const known = useMemo(() => (lemma ? CONJUGATION_CLASSES.some((cls) => cls.examples.includes(lemma)) : false), [lemma]);

  const lookup = (word: string) => {
    setQuery(word);
    setLemma(word);
  };

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Strumenti</p>
        <h1>Coniuga</h1>
        <p className="muted">
          Scrivi un verbo o un aggettivo come sta sul dizionario — 먹다, 살다, 모르다 — e vedi le
          forme che il percorso insegna: presente, passato, causa, collegamento, contrasto, formale,
          futuro e i due modificanti. Accanto c’è la classe della radice, che spiega perché le forme
          sono proprio quelle.
        </p>
      </header>

      <section className="card">
        <HangulInput
          id="coniuga-lemma"
          value={query}
          onChange={setQuery}
          onSubmit={() => setLemma(query.trim())}
          placeholder="먹다"
        />
        <div className="chips" role="list" aria-label="Voci da provare">
          {STARTERS.map((word) => (
            <button
              key={word}
              type="button"
              className={word === lemma ? 'chip chip--on' : 'chip'}
              onClick={() => lookup(word)}
            >
              {word}
            </button>
          ))}
        </div>
        {suggestions.length > 0 ? (
          <div className="chips" role="list" aria-label="Voci del dizionario">
            {suggestions.map((word) => (
              <button key={word} type="button" className="chip" onClick={() => lookup(word)}>
                {word}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {lemma && !table ? (
        <section className="card">
          <p>
            <strong>{lemma}</strong> non è una voce di dizionario coniugabile.
          </p>
          <p className="muted">
            Servono la forma intera che si cerca sul dizionario: <code>먹다</code>, non{' '}
            <code>먹</code> né <code>먹어요</code>. Le parole che finiscono per 다 senza essere verbi
            o aggettivi (바다, 감사합니다) restano fuori.
          </p>
        </section>
      ) : null}

      {table ? (
        <section className="card conj-card">
          <div className="conj-head">
            <div>
              <h2 className="conj-lemma">{table.lemma}</h2>
              <p className="conj-rr">{pronunciationRomanize(table.lemma)}</p>
            </div>
            <div className="conj-head__actions">
              <span className="badge">{table.class.label}</span>
              <PronounceButton text={table.lemma} />
            </div>
          </div>

          <p className="conj-rule">{table.class.info.rule}</p>
          <p className="muted conj-signal">
            <strong>Come si riconosce:</strong> {table.class.info.signal}
          </p>

          {table.class.kind === 'adjective' ? (
            <p className="conj-note">
              È un <strong>aggettivo</strong>: non ha la forma in <code>-는</code> (quella è dei
              verbi). Per descrivere un nome si usa la riga <code>-(으)ㄴ</code>: 좋은 사람 «una
              persona buona».
            </p>
          ) : null}
          {table.class.kind === 'unknown' ? (
            <p className="conj-note">
              Questa voce non è nel dizionario del percorso, quindi non so se è un verbo o un
              aggettivo: la forma in <code>-는</code> è quella dei verbi, e negli aggettivi al suo
              posto va <code>-(으)ㄴ</code>.
            </p>
          ) : null}

          <ul className="conj-forms">
            {CONJUGATION_ENDINGS.map((ending) => {
              const form = table.forms.find((entry) => entry.key === ending.key)?.form ?? null;
              return (
                <li key={ending.key} className={form ? 'conj-form' : 'conj-form conj-form--missing'}>
                  <div className="conj-form__label">
                    <span className="conj-form__name">{ending.label}</span>
                    <span className="conj-form__ending">{ending.ending}</span>
                    <span className="conj-form__hint">{ending.hint}</span>
                  </div>
                  <div className="conj-form__value">
                    {form ? (
                      <>
                        <span className="conj-form__ko">{form}</span>
                        <span className="conj-form__rr">{pronunciationRomanize(form)}</span>
                        <PronounceButton text={form} />
                      </>
                    ) : (
                      <span
                        className="muted"
                        title="La classe non permette di darla con sicurezza"
                      >
                        {ending.key === 'modificanteVerbo' && table.class.kind === 'adjective'
                          ? '— gli aggettivi non hanno questa forma'
                          : '— non esiste per questa parola'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {!known ? (
            <p className="muted">
              La voce non è tra gli esempi delle lezioni. Le forme seguono la classe, ma per una
              parola nuova conviene controllarle su un dizionario:{' '}
              <Link to="/dizionario">il dizionario del percorso</Link> resta la fonte delle voci
              verificate.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2>Le classi di radice</h2>
        <p className="muted">
          Sono le stesse del corso <Link to="/corso/radici">Radici</Link>. Ogni classe ha una regola
          sola: riconosciuta quella, le forme vengono da sé. Le voci in elenco si possono aprire qui
          sopra.
        </p>
        <div className="conj-legend">
          {CONJUGATION_CLASSES.map((cls) => (
            <article key={cls.id} className="conj-class">
              <h3>{cls.label}</h3>
              <p className="muted">{cls.signal}</p>
              <p>{cls.rule}</p>
              <div className="chips">
                {cls.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="chip"
                    onClick={() => lookup(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
