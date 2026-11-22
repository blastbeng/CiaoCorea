import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChallengeExercise, ChallengeResultResponse } from '@ciaocorea/shared';
import { api, announcePending } from '../api';
import { errorMessage } from '../auth';
import { ExerciseInput, isKorean } from '../components/ExerciseInput';
import { useAsync } from '../useAsync';

interface RunnerProps {
  exercises: ChallengeExercise[];
  onFinish: (result: ChallengeResultResponse) => void;
}

function Runner({ exercises, onFinish }: RunnerProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const current = exercises[index];
  const value = current ? (answers[current.id] ?? '') : '';
  const answered = value.trim().length > 0;
  const last = index === exercises.length - 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = exercises.map((exercise) => ({
        exerciseId: exercise.id,
        response: answers[exercise.id] ?? '',
      }));
      const result = await api.submitChallenge(payload, Date.now() - startedAt.current);
      announcePending();
      onFinish(result);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  };

  const advance = () => {
    if (busy) return;
    if (last) {
      void submit();
      return;
    }
    setIndex(index + 1);
  };

  if (!current) {
    return <div className="alert alert--error">La sfida non ha domande disponibili.</div>;
  }

  return (
    <div className="card">
      <div className="exercise-head">
        <span className="badge">
          Domanda {index + 1}/{exercises.length}
        </span>
        <div className="progress" style={{ flex: 1 }}>
          <span style={{ width: `${((index + (answered ? 1 : 0)) / exercises.length) * 100}%` }} />
        </div>
      </div>

      <p className="small faint" style={{ marginBottom: '0.5rem' }}>
        {current.course.level} · {current.course.title} — {current.lesson.title}
      </p>

      <p className="exercise-prompt">{current.prompt}</p>
      {current.hint ? <p className="hint">Suggerimento: {current.hint}</p> : null}

      <ExerciseInput
        exercise={current}
        value={value}
        onChange={(next) => setAnswers((previous) => ({ ...previous, [current.id]: next }))}
        onSubmit={advance}
        disabled={busy}
      />

      {error ? (
        <p className="alert alert--error" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </p>
      ) : null}

      <div className="row" style={{ marginTop: '1.25rem' }}>
        {index > 0 ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setIndex(index - 1)}
            disabled={busy}
          >
            Indietro
          </button>
        ) : null}

        <button type="button" className="btn btn--primary" onClick={advance} disabled={!answered || busy}>
          {busy ? 'Correggo…' : last ? 'Consegna' : 'Avanti'}
        </button>
      </div>
    </div>
  );
}

interface ResultProps {
  exercises: ChallengeExercise[];
  result: ChallengeResultResponse;
  onRetry: () => void;
}

function ResultView({ exercises, result, onRetry }: ResultProps) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const verdict =
    result.score >= 80
      ? 'Ottimo: queste cose sono ancora tue.'
      : result.score >= 60
        ? 'Buon ripasso: qualcosa è scivolato, ma la strada è giusta.'
        : 'Da riprendere: gli errori sono già nella banca, e la lezione è a un clic.';

  return (
    <div className="stack">
      <section className="card">
        <p className="small faint" style={{ marginBottom: '0.4rem' }}>
          Sfida del giorno
        </p>
        <div className="score">
          <span className="score-value">{result.score}%</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{verdict}</p>
            <p className="muted small" style={{ margin: 0 }}>
              {result.correct} risposte corrette su {result.total}
              {result.wrong > 0
                ? ` · ${result.wrong} in banca degli errori`
                : ' · nessun errore nuovo'}
            </p>
          </div>
        </div>

        <div className="row" style={{ marginTop: '1.25rem' }}>
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Rifai la sfida
          </button>
          {result.wrong > 0 ? (
            <Link className="btn" to="/errori">
              Vai agli errori
            </Link>
          ) : null}
          <Link className="btn btn--ghost" to="/">
            Torna al percorso
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Dettaglio</h2>
        <ul className="result-list">
          {result.results.map((item) => {
            const exercise = byId.get(item.exerciseId);
            return (
              <li
                key={item.exerciseId}
                className={`result-item result-item--${item.correct ? 'ok' : 'wrong'}`}
              >
                <span
                  className={`result-mark result-mark--${item.correct ? 'ok' : 'wrong'}`}
                  aria-hidden="true"
                >
                  {item.correct ? '✓' : '✗'}
                </span>
                <div>
                  <div className="small faint">
                    {exercise ? (
                      <Link to={`/corso/${exercise.course.slug}/lezione/${exercise.lesson.id}`}>
                        {exercise.course.level} · {exercise.lesson.title}
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ fontWeight: 600 }}>{exercise?.prompt ?? item.exerciseId}</div>
                  <div className="small">
                    <span className="muted">La tua risposta: </span>
                    <span className={isKorean(item.response) ? 'hangul' : ''}>
                      {item.response || '—'}
                    </span>
                  </div>
                  {item.correct ? null : (
                    <div className="small">
                      <span className="muted">Risposta attesa: </span>
                      <span className={isKorean(item.expected) ? 'hangul' : ''}>{item.expected}</span>
                    </div>
                  )}
                  {exercise?.explain ? <div className="hint">{exercise.explain}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export function ChallengePage() {
  const state = useAsync(() => api.challenge(), []);
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<ChallengeResultResponse | null>(null);

  if (state.status === 'loading') return <div className="loading">Preparo la sfida…</div>;
  if (state.status === 'error') {
    return (
      <div className="stack">
        <div className="alert alert--error" role="alert">
          {state.error}
        </div>
        <Link className="btn" to="/">
          Torna al percorso
        </Link>
      </div>
    );
  }

  const { exercises, availableLessons } = state.data;

  if (exercises.length === 0) {
    return (
      <div className="stack">
        <header>
          <h1 style={{ marginBottom: '0.2rem' }}>Sfida del giorno</h1>
          <p className="muted">
            Un misto delle lezioni che hai già chiuso, per riprenderle in mano senza
            sapere quale corso uscirà.
          </p>
        </header>

        <section className="card">
          <h2>Prima una lezione</h2>
          <p className="muted">
            {availableLessons === 0
              ? 'La sfida pesca solo da ciò che hai già studiato: chiudi la prima lezione e torna qui.'
              : 'Le lezioni chiuse non hanno ancora esercizi da ripassare.'}
          </p>
          <div className="row">
            <Link className="btn btn--primary" to="/">
              Vai al percorso
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <header>
        <h1 style={{ marginBottom: '0.2rem' }}>Sfida del giorno</h1>
        <p className="muted" style={{ marginBottom: '0.4rem' }}>
          {exercises.length} domande da {availableLessons}{' '}
          {availableLessons === 1 ? 'lezione già chiusa' : 'lezioni già chiuse'}. La sfida non
          cambia il percorso: serve a ricordare, e gli errori finiscono nella banca.
        </p>
      </header>

      {result ? (
        <ResultView
          exercises={exercises}
          result={result}
          onRetry={() => {
            setResult(null);
            setRunId((value) => value + 1);
          }}
        />
      ) : (
        <Runner
          key={runId}
          exercises={exercises}
          onFinish={(finished) => setResult(finished)}
        />
      )}
    </div>
  );
}
