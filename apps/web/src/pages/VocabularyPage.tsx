import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VocabEntry, VocabFilterOption } from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';
import { HangulInput } from '../components/HangulInput';
import { PronounceButton } from '../components/PronounceButton';

const PAGE = 40;

interface Meta {
  total: number;
  curriculum: number;
  courses: VocabFilterOption[];
}

/**
 * Il dizionario del curricolo: ciò che si è incontrato (o si incontrerà) nelle
 * lezioni, cercato in italiano, in romanizzazione o in coreano. Non è una
 * lezione e non ha stato: è lo strumento che sta fra una lezione e l'altra.
 */
export function VocabularyPage() {
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, curriculum: 0, courses: [] });
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [appending, setAppending] = useState(false);
  // Cambia solo per ripetere una ricerca già identica: il pulsante «Riprova».
  const [nonce, setNonce] = useState(0);

  // Ricerca con un breve ritardo: si cerca mentre si scrive, ma non si
  // interroga il server a ogni battitura.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    const timer = setTimeout(() => {
      api
        .vocabulary(query, course, 0, PAGE)
        .then((response) => {
          if (cancelled) return;
          setEntries(response.entries);
          setMeta({
            total: response.total,
            curriculum: response.curriculum,
            courses: response.courses,
          });
          setOffset(response.entries.length);
          setStatus('ready');
        })
        .catch((problem: unknown) => {
          if (cancelled) return;
          setError(errorMessage(problem));
          setStatus('error');
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, course, nonce]);

  const loadMore = async () => {
    setAppending(true);
    setError(null);
    try {
      const response = await api.vocabulary(query, course, offset, PAGE);
      setEntries((previous) => [...previous, ...response.entries]);
      setOffset((previous) => previous + response.entries.length);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setAppending(false);
    }
  };

  const shown = query.trim().length > 0 ? meta.total : meta.curriculum;

  return (
    <div className="stack">
      <header>
        <h1>Dizionario</h1>
        <p className="muted">
          Le parole del percorso, tutte in un elenco. Cerca in italiano, in romanizzazione o in
          coreano: ogni voce dice in quale lezione è arrivata.
        </p>
      </header>

      <section className="card">
        <div className="stack stack--tight">
          <div className="row row--wrap row--between">
            <div className="stack stack--tight" style={{ flex: 1, minWidth: '16rem' }}>
              <label className="stat-label" htmlFor="vocab-search">
                Cerca
              </label>
              {keyboard ? (
                <HangulInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Cerca in coreano: 커피"
                  id="vocab-search"
                />
              ) : (
                <input
                  id="vocab-search"
                  className="input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="caffè, keopi, coffee…"
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </div>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setKeyboard((value) => !value)}
            >
              {keyboard ? 'Nascondi tastiera coreano' : 'Tastiera coreano'}
            </button>
          </div>

          <div className="row row--wrap">
            <button
              type="button"
              className={course === '' ? 'filter filter--on' : 'filter'}
              onClick={() => setCourse('')}
            >
              Tutti i corsi · {meta.curriculum}
            </button>
            {meta.courses.map((option) => (
              <button
                type="button"
                key={option.slug}
                className={course === option.slug ? 'filter filter--on' : 'filter'}
                onClick={() => setCourse(option.slug)}
              >
                {option.title} · {option.count}
              </button>
            ))}
          </div>
        </div>
      </section>

      {status === 'error' ? (
        <div className="alert alert--error" role="alert">
          {error}{' '}
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setNonce((value) => value + 1)}
          >
            Riprova
          </button>
        </div>
      ) : null}

      {status === 'loading' ? <div className="loading">Cerco nel dizionario…</div> : null}

      {status === 'ready' ? (
        <div className="stack stack--tight">
          <p className="faint small">
            {shown === 0
              ? 'Nessuna voce. Prova una forma più corta: una sillaba, o la romanizzazione.'
              : query.trim().length > 0
                ? `${meta.total} voci per «${query.trim()}»`
                : `${meta.curriculum} voci nel percorso`}
            {course ? ` · corso filtrato: ${meta.courses.find((c) => c.slug === course)?.title ?? course}` : ''}
          </p>

          {entries.length === 0 ? (
            <div className="card empty">
              <p className="muted">
                Questa parola non è ancora nel percorso. Le lezioni che la introducono sono il posto
                giusto per incontrarla.
              </p>
            </div>
          ) : (
            <section className="vocab-list">
              {entries.map((entry) => (
                <article className="card vocab-entry" key={`${entry.courseSlug}-${entry.ko}`}>
                  <div className="vocab-entry__ko hangul">
                    {entry.ko} <PronounceButton text={entry.ko} label={entry.ko} />
                  </div>
                  <div className="vocab-entry__rr">{entry.rr}</div>
                  <div className="vocab-entry__it">{entry.it}</div>
                  <Link
                    className="faint small vocab-entry__lesson"
                    to={`/corso/${entry.courseSlug}/lezione/${entry.lessonId}`}
                  >
                    {entry.courseTitle} · {entry.lessonTitle}
                  </Link>
                </article>
              ))}
            </section>
          )}

          {entries.length < meta.total ? (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn" onClick={loadMore} disabled={appending}>
                {appending ? 'Carico…' : `Mostra altre (${meta.total - entries.length} rimaste)`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
