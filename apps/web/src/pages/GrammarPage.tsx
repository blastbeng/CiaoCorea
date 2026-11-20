import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { GrammarEntry, VocabFilterOption } from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';

const PAGE = 40;

interface Meta {
  total: number;
  curriculum: number;
  courses: VocabFilterOption[];
}

/**
 * Il repertorio: le spiegazioni del percorso lette come un indice, non come
 * lezioni. Si cerca una regola — 오늘은 «-지만 dove era?» — e si torna alla
 * lezione che la insegna. Non ha stato e non si chiude: è una consultazione.
 */
export function GrammarPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [course, setCourse] = useState('');
  const [entries, setEntries] = useState<GrammarEntry[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, curriculum: 0, courses: [] });
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [appending, setAppending] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    const timer = setTimeout(() => {
      api
        .grammar(query, course, 0, PAGE)
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
      const response = await api.grammar(query, course, offset, PAGE);
      setEntries((previous) => [...previous, ...response.entries]);
      setOffset((previous) => previous + response.entries.length);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setAppending(false);
    }
  };

  const searching = query.trim().length > 0;
  const shown = searching ? meta.total : meta.curriculum;

  return (
    <div className="stack">
      <header>
        <h1>Repertorio</h1>
        <p className="muted">
          Tutte le spiegazioni del percorso in un indice solo. Cerca una forma — <span className="hangul">것 같다</span>,
          -지만, 받침 — e leggi dove la lezione la insegna: ogni voce è una frase presa da lì.
        </p>
      </header>

      <section className="card">
        <div className="stack stack--tight">
          <div className="stack stack--tight" style={{ flex: 1, minWidth: '16rem' }}>
            <label className="stat-label" htmlFor="grammar-search">
              Cerca una regola
            </label>
            <input
              id="grammar-search"
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="것 같다, -지만, passato, 받침…"
              autoComplete="off"
              spellCheck={false}
            />
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

      {status === 'loading' ? <div className="loading">Cerco nel repertorio…</div> : null}

      {status === 'ready' ? (
        <div className="stack stack--tight">
          <p className="faint small">
            {shown === 0
              ? 'Nessuna spiegazione. Prova una parola più corta: una forma coreana o un termine italiano.'
              : searching
                ? `${meta.total} spiegazioni per «${query.trim()}»`
                : `${meta.curriculum} spiegazioni nel percorso`}
          </p>

          {entries.length === 0 ? (
            <div className="card empty">
              <p className="muted">
                Questa regola non compare ancora nel percorso. Il dizionario copre le parole, il
                repertorio le spiegazioni: se manca, la lezione che la insegna non è ancora arrivata.
              </p>
            </div>
          ) : (
            <section className="vocab-list vocab-list--wide">
              {entries.map((entry) => (
                <article className="card vocab-entry" key={entry.id}>
                  <div className="row row--between row--wrap">
                    <span className="faint small">
                      {entry.level} · {entry.courseTitle}
                    </span>
                    {entry.keywords.length > 0 ? (
                      <span className="hangul small">{entry.keywords.slice(0, 3).join(' · ')}</span>
                    ) : null}
                  </div>
                  <p className="grammar-entry__point">{entry.point}</p>
                  <Link
                    className="faint small vocab-entry__lesson"
                    to={`/corso/${entry.courseSlug}/lezione/${entry.lessonId}`}
                  >
                    {entry.lessonTitleKo} · {entry.lessonTitle}
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
