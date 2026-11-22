import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LESSON_STATE_LABEL, type ReadingRef } from '@ciaocorea/shared';
import { api } from '../api';
import { KoreanText } from '../components/KoreanText';
import { PronounceButton } from '../components/PronounceButton';
import { useAsync } from '../useAsync';

/** Le sillabe coreane del brano: è la misura onesta di quanto è lungo. */
function hangulCount(lines: string[]): number {
  let total = 0;
  for (const line of lines) {
    for (const char of line) {
      if (/\p{Script=Hangul}/u.test(char)) total += 1;
    }
  }
  return total;
}

/** Quanto ci vuole a leggerlo, senza fermarsi su ogni parola: ~120 sillabe al minuto. */
function readingMinutes(lines: string[]): number {
  return Math.max(1, Math.round(hangulCount(lines) / 120));
}

function matches(reading: ReadingRef, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = [
    reading.title,
    reading.course.title,
    reading.lesson.title,
    reading.lines.join(' '),
    ...reading.gloss.flatMap((item) => [item.ko, item.it, item.rr]),
    reading.translation,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function ReadingCard({ reading }: { reading: ReadingRef }) {
  const closed = reading.lesson.state === 'passed' || reading.lesson.state === 'skipped';
  const minutes = readingMinutes(reading.lines);

  return (
    <article className="card passage">
      <div className="row row--between" style={{ alignItems: 'center', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>{reading.title}</h2>
        <PronounceButton
          text={reading.lines.join(' ')}
          label={`il brano ${reading.title}`}
        />
      </div>

      <p className="faint small">
        {reading.level} · {reading.course.title} ·{' '}
        <Link to={`/corso/${reading.course.slug}/lezione/${reading.lesson.id}`}>
          {reading.lesson.title}
        </Link>{' '}
        · {hangulCount(reading.lines)} sillabe · circa {minutes} min
        {closed ? null : (
          <>
            {' '}
            · <span className={`badge badge--${reading.lesson.state}`}>
              {LESSON_STATE_LABEL[reading.lesson.state]}
            </span>
          </>
        )}
      </p>

      <div className="passage__ko">
        {reading.lines.map((line, index) => (
          <p className="passage__line" key={`${reading.id}-${index}`}>
            <KoreanText text={line} />
          </p>
        ))}
      </div>

      {reading.gloss.length > 0 ? (
        <details className="reading-gloss">
          <summary className="small">
            Parole da guardare prima ({reading.gloss.length})
          </summary>
          <ul className="gloss">
            {reading.gloss.map((item) => (
              <li key={`${item.ko}-${item.it}`}>
                <span className="ko">
                  {item.ko} <PronounceButton text={item.ko} label={item.ko} />
                </span>
                <span className="gloss__it">{item.it}</span>
                <span className="faint small">{item.rr}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {reading.translation ? (
        <details className="passage__it">
          <summary className="small">Traduzione</summary>
          <p>{reading.translation}</p>
        </details>
      ) : (
        <p className="hint">
          Prova a capire il brano da solo: la traduzione compare quando la lezione è
          superata o saltata.
        </p>
      )}
    </article>
  );
}

/**
 * La sala di lettura. I brani del percorso stanno tutti qui, nell'ordine in cui
 * si incontrano: si rilegge quello che si è già studiato e si sbircia quello
 * che arriverà. La traduzione resta legata allo stato della lezione — non è una
 * scorciatoia, è la stessa regola della pagina della lezione.
 */
export function ReadingsPage() {
  const state = useAsync(() => api.readings(), []);
  const [level, setLevel] = useState('');
  const [query, setQuery] = useState('');

  const readings = state.data?.readings ?? [];
  const levels = state.data?.levels ?? [];

  const shown = useMemo(
    () =>
      readings.filter(
        (reading) =>
          (level === '' || reading.level === level) && matches(reading, query),
      ),
    [readings, level, query],
  );

  if (state.status === 'loading') return <div className="loading">Cerco i brani…</div>;

  if (state.status === 'error') {
    return (
      <div className="alert alert--error" role="alert">
        {state.error}{' '}
        <button type="button" className="btn btn--sm btn--ghost" onClick={state.reload}>
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">읽기 · La lettura</p>
        <h1>La sala di lettura</h1>
        <p className="muted">
          Tutti i brani del percorso in un posto solo. Si leggono con calma, toccando le
          parole che non tornano: la scheda dice come si legge e che cosa vuol dire. Quelli
          che hai già studiato li rileggi volentieri, e la traduzione è lì; quelli che
          aspettano ancora la loro lezione si possono leggere, ma la traduzione arriva solo
          dopo.
        </p>
      </header>

      <section className="card stack stack--tight" aria-label="Filtri">
        <div className="sample-row">
          <button
            type="button"
            className={level === '' ? 'chip chip--on' : 'chip'}
            onClick={() => setLevel('')}
          >
            Tutti ({readings.length})
          </button>
          {levels.map((entry) => (
            <button
              key={entry.level}
              type="button"
              className={level === entry.level ? 'chip chip--on' : 'chip'}
              onClick={() => setLevel(entry.level)}
            >
              {entry.level} ({entry.count})
            </button>
          ))}
        </div>
        <label className="stack stack--tight">
          <span className="small">Cerca nel testo, nel titolo o nel glossario</span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="per esempio: 교통, 가족, 안녕"
          />
        </label>
        <p className="faint small" role="status">
          {shown.length} {shown.length === 1 ? 'brano' : 'brani'}
          {level === '' ? '' : ` di livello ${level}`}
          {query.trim() === '' ? '' : ` per “${query.trim()}”`} · traduzione disponibile
          per {state.data?.withTranslation ?? 0} di {readings.length}.
        </p>
      </section>

      {shown.length === 0 ? (
        <p className="muted">
          Nessun brano corrisponde alla ricerca. Prova con una parola più corta, o togli
          il filtro di livello.
        </p>
      ) : (
        <div className="stack">
          {shown.map((reading) => (
            <ReadingCard key={reading.id} reading={reading} />
          ))}
        </div>
      )}
    </div>
  );
}
