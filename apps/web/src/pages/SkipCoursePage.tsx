import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CourseSkipResponse, CourseSkipTest } from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';
import { ExerciseInput } from '../components/ExerciseInput';
import { useAsync } from '../useAsync';

/**
 * Saltare un corso intero: una prova campionata da tutte le lezioni, sempre le
 * stesse domande a ogni apertura, così non si può ritentare sperando in una
 * pesca più facile. Superarla chiude il corso; le parole restano da ripassare,
 * perché saltare non è sapere.
 */
export function SkipCoursePage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => api.skipTest(slug), [slug]);

  if (state.status === 'loading') return <div className="loading">Preparo la prova…</div>;
  if (state.status === 'error') {
    return (
      <div className="stack">
        <div className="alert alert--error" role="alert">
          {state.error}
        </div>
        <Link className="btn" to={`/corso/${slug}`}>
          Torna al corso
        </Link>
      </div>
    );
  }

  return <SkipRunner slug={slug} test={state.data} />;
}

function SkipRunner({ slug, test }: { slug: string; test: CourseSkipTest }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseSkipResponse | null>(null);
  const startedAt = useRef(Date.now());

  const exercises = test.exercises;
  const current = exercises[index];
  const value = current ? (answers[current.id] ?? '') : '';
  const answered = value.trim().length > 0;
  const last = index === exercises.length - 1;

  if (test.lessonsToClose === 0) {
    return (
      <div className="stack">
        <h1>Salta {test.course.title}</h1>
        <div className="alert">Hai già chiuso tutte le lezioni di questo corso.</div>
        <Link className="btn" to={`/corso/${slug}`}>
          Torna al corso
        </Link>
      </div>
    );
  }

  if (!current) {
    return <div className="alert alert--error">Questa prova non ha domande disponibili.</div>;
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = exercises.map((exercise) => ({
        exerciseId: exercise.id,
        response: answers[exercise.id] ?? '',
      }));
      const outcome = await api.skipCourse(slug, payload, Date.now() - startedAt.current);
      setResult(outcome);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
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

  if (result) {
    const { attempt } = result;
    return (
      <div className="stack">
        <section className="card">
          <div className="score">
            <span className="score-value">{attempt.score}%</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {attempt.passed
                  ? `Corso chiuso: ${result.lessonsSkipped} lezioni saltate`
                  : `Ti serve il ${test.threshold}% per chiudere il corso`}
              </p>
              <p className="muted small" style={{ margin: 0 }}>
                {attempt.correct} risposte corrette su {attempt.total}
                {result.reviewsCreated > 0
                  ? ` · ${result.reviewsCreated} parole nuove da ripassare`
                  : ''}
              </p>
            </div>
          </div>

          <p className="muted small" style={{ marginTop: '0.75rem' }}>
            {attempt.passed
              ? 'Le parole di queste lezioni sono nella coda dei ripassi: è lì che il corso si tiene davvero.'
              : 'Il test non chiude niente: puoi rifarlo o seguire le lezioni una per una.'}
          </p>

          <div className="row" style={{ marginTop: '1.25rem' }}>
            <Link className="btn btn--primary" to={`/corso/${slug}`}>
              Torna al corso
            </Link>
            <Link className="btn" to="/">
              Il mio percorso
            </Link>
            {attempt.passed ? null : (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setResult(null);
                  setIndex(0);
                  setAnswers({});
                  startedAt.current = Date.now();
                }}
              >
                Riprova
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <header>
        <p className="small" style={{ marginBottom: '0.4rem' }}>
          <Link to={`/corso/${slug}`}>← {test.course.title}</Link>
        </p>
        <h1 style={{ marginBottom: '0.2rem' }}>Salta {test.course.title}</h1>
        <p className="muted small" style={{ margin: 0 }}>
          {exercises.length} domande da tutte le lezioni · soglia {test.threshold}%. Se la superi,
          le {test.lessonsToClose} lezioni che restano risultano chiuse e le loro parole entrano
          nella coda dei ripassi.
        </p>
      </header>

      <div className="card">
        <div className="exercise-head">
          <span className="badge">
            Prova del corso {index + 1}/{exercises.length}
          </span>
          <div className="progress" style={{ flex: 1 }}>
            <span
              style={{ width: `${((index + (answered ? 1 : 0)) / exercises.length) * 100}%` }}
            />
          </div>
        </div>

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

          <button
            type="button"
            className="btn btn--primary"
            onClick={advance}
            disabled={!answered || busy}
          >
            {busy ? 'Correggo…' : last ? 'Consegna' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  );
}
