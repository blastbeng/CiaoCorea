import { useState } from 'react';
import { Link } from 'react-router-dom';
import { announcePending, api } from '../api';
import { errorMessage } from '../auth';
import { useAsync } from '../useAsync';

export function ReviewPage() {
  const state = useAsync(() => api.review(), []);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  if (state.status === 'loading') return <div className="loading">Cerco i ripassi di oggi…</div>;
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

  const { cards } = state.data;

  if (cards.length === 0) {
    return (
      <div className="card empty">
        <h1>Nessun ripasso in scadenza</h1>
        <p className="muted">
          Le parole tornano qui quando è il momento di rivederle. Intanto puoi andare avanti con
          una lezione.
        </p>
        <Link className="btn btn--primary" to="/">
          Torna al percorso
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card empty">
        <h1>Ripassi finiti</h1>
        <p className="muted">
          {remaining && remaining > 0
            ? `Restano ${remaining} parole in scadenza: puoi continuare.`
            : 'Per oggi hai chiuso: le prossime carte torneranno più avanti.'}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn--primary" to="/">
            Torna al percorso
          </Link>
          {remaining && remaining > 0 ? (
            <button type="button" className="btn" onClick={state.reload}>
              Ricarica
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const card = cards[index];

  const grade = async (value: 0 | 1 | 2) => {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.gradeCard(card.id, value);
      setRemaining(response.dueCards);
      announcePending();
      if (index + 1 >= cards.length) {
        setFinished(true);
      } else {
        setIndex(index + 1);
        setRevealed(false);
      }
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="row row--between">
        <h1 style={{ margin: 0 }}>Ripassi</h1>
        <span className="badge">
          {index + 1}/{cards.length}
        </span>
      </div>

      <div className="progress">
        <span style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>

      <section className="card flash">
        <p className="stat-label">Leggi e ricorda</p>
        <div className="flash-front hangul">{card.front}</div>
        {card.hint ? <p className="hint">{card.hint}</p> : null}

        {revealed ? (
          <>
            <p className="flash-back">{card.back}</p>
            <div className="grade-grid">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => grade(0)}
              >
                Non lo so
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => grade(1)}
              >
                Difficile
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => grade(2)}
              >
                Facile
              </button>
            </div>
          </>
        ) : (
          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setRevealed(true)}
            >
              Mostra la risposta
            </button>
          </div>
        )}

        {error ? (
          <p className="alert alert--error" role="alert" style={{ marginTop: '1rem' }}>
            {error}
          </p>
        ) : null}
      </section>

      <p className="faint small center">
        La carta torna tanto più tardi quanto più la ricordi: rispondi con sincerità.
      </p>
    </div>
  );
}
