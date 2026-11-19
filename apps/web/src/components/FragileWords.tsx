import { useState } from 'react';
import { announcePending, api } from '../api';
import { errorMessage } from '../auth';
import { PronounceButton } from './PronounceButton';
import { useAsync } from '../useAsync';

/**
 * Le parole che hanno ceduto due volte o più. Stanno fuori dalla coda perché la
 * coda è un calendario: qui conta la fragilità, e una parola si può riprendere
 * oggi senza aspettare che il calendario la riporti — dopo il terzo errore
 * l'attesa sarebbe di una settimana, che è troppo per una parola che non c'è.
 */
export function FragileWords({ onRetried }: { onRetried?: () => void }) {
  const state = useAsync(() => api.fragileWords(), []);
  const [retried, setRetried] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'ready') return null;

  const { words, total } = state.data;
  if (words.length === 0) return null;

  const retry = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await api.retryFragile(id);
      setRetried((done) => [...done, id]);
      announcePending();
      // La parola è in coda adesso: la pagina ricarica e la mette davanti.
      onRetried?.();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card">
      <div className="row row--between" style={{ marginBottom: '0.3rem' }}>
        <p className="stat-label" style={{ margin: 0 }}>
          Le parole che scappano
        </p>
        <span className="badge">{total}</span>
      </div>

      <p className="muted small">
        Sbagliate due volte o più: aspettare il calendario non serve, conviene riprenderle oggi.
      </p>

      <ul className="fragile-list">
        {words.map((word) => (
          <li className="fragile" key={word.id}>
            <span className="fragile__word">
              <span className="hangul">
                {word.korean} <PronounceButton text={word.korean} label={word.korean} />
              </span>
              <span className="faint small">
                {word.italian}
                {word.hint ? ` · ${word.hint}` : ''}
              </span>
            </span>
            {retried.includes(word.id) ? (
              <span className="faint small">In coda per oggi</span>
            ) : (
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy === word.id}
                onClick={() => retry(word.id)}
              >
                Riprova oggi
              </button>
            )}
          </li>
        ))}
      </ul>

      {error ? (
        <p className="alert alert--error" role="alert" style={{ marginTop: '0.8rem' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
