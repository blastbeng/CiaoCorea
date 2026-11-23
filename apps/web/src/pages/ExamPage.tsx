import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  ExamExercise,
  ExamPaper,
  ExamResultResponse,
} from '@ciaocorea/shared';
import { api, announcePending } from '../api';
import { errorMessage } from '../auth';
import { ExerciseInput, isKorean } from '../components/ExerciseInput';
import { useAsync } from '../useAsync';

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

interface RunnerProps {
  paper: ExamPaper;
  onFinish: (result: ExamResultResponse) => void;
}

function Runner({ paper, onFinish }: RunnerProps) {
  const { exercises } = paper;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  // Il tempo si vede ma non comanda: non c'è un limite che taglia la prova.
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
      const result = await api.submitExam(paper.level.id, payload, Date.now() - startedAt.current);
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
    return <div className="alert alert--error">Il traguardo non ha domande disponibili.</div>;
  }

  return (
    <div className="card">
      <div className="exercise-head">
        <span className="badge">
          {paper.level.label} · {index + 1}/{exercises.length}
        </span>
        <div className="progress" style={{ flex: 1 }}>
          <span style={{ width: `${((index + (answered ? 1 : 0)) / exercises.length) * 100}%` }} />
        </div>
        <span className="small faint" title="Il tempo è solo un’informazione: non c’è un limite">
          ⏱ {clock(seconds)}
        </span>
      </div>

      <p className="exercise-prompt">{current.prompt}</p>

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
          {busy ? 'Correggo…' : last ? 'Consegna il traguardo' : 'Avanti'}
        </button>
      </div>

      <p className="small faint" style={{ marginTop: '1rem', marginBottom: 0 }}>
        Nessun suggerimento durante la prova: è un controllo, non una lezione. Le risposte
        arrivano tutte insieme alla consegna.
      </p>
    </div>
  );
}

interface ResultProps {
  exercises: ExamExercise[];
  result: ExamResultResponse;
  onRetry: () => void;
}

function ResultView({ exercises, result, onRetry }: ResultProps) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  // Le lezioni da riprendere, una volta sola, nell’ordine in cui compaiono.
  const toReview = new Map<string, { course: string; lesson: string; slug: string; id: string }>();
  for (const item of result.results) {
    if (item.correct) continue;
    const exercise = byId.get(item.exerciseId);
    if (!exercise) continue;
    const key = `${exercise.course.slug}/${exercise.lesson.id}`;
    if (!toReview.has(key)) {
      toReview.set(key, {
        course: exercise.course.title,
        lesson: exercise.lesson.title,
        slug: exercise.course.slug,
        id: exercise.lesson.id,
      });
    }
  }

  const verdict = result.passed
    ? result.firstPass
      ? 'Traguardo raggiunto: la strada è solida.'
      : 'Di nuovo sopra la soglia.'
    : 'Non ancora: la prova serve proprio a questo.';

  return (
    <div className="stack">
      <section className="card">
        <p className="small faint" style={{ marginBottom: '0.4rem' }}>
          Traguardo {result.level.label} · {result.level.title}
        </p>
        <div className="score">
          <span className="score-value">{result.score}%</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{verdict}</p>
            <p className="muted small" style={{ margin: 0 }}>
              {result.correct} risposte corrette su {result.total} · soglia {result.threshold}%
              {result.level.bestScore !== null ? ` · miglior punteggio ${result.level.bestScore}%` : ''}
              {result.wrong > 0
                ? ` · ${result.wrong} ${result.wrong === 1 ? 'errore' : 'errori'} in banca`
                : ''}
            </p>
          </div>
        </div>

        {!result.passed ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Rifallo quando vuoi: le domande cambiano a ogni prova, e questa non tocca il
            percorso. Gli errori sono già nella banca, da rifare uno alla volta.
          </p>
        ) : null}

        <div className="row" style={{ marginTop: '1.25rem' }}>
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Rifai la prova
          </button>
          {result.wrong > 0 ? (
            <Link className="btn" to="/errori">
              Vai agli errori
            </Link>
          ) : null}
          <Link className="btn btn--ghost" to="/traguardo">
            Tutti i traguardi
          </Link>
          <Link className="btn btn--ghost" to="/">
            Torna al percorso
          </Link>
        </div>
      </section>

      {toReview.size > 0 ? (
        <section className="card">
          <h2>Dove tornare</h2>
          <p className="muted small">
            Le lezioni da cui vengono le risposte sbagliate: leggere di nuovo il punto e rifare
            gli esercizi vale più di un’altra prova.
          </p>
          <ul className="result-list">
            {[...toReview.values()].map((item) => (
              <li key={`${item.slug}/${item.id}`} className="result-item">
                <span className="result-mark" aria-hidden="true">
                  →
                </span>
                <div>
                  <Link to={`/corso/${item.slug}/lezione/${item.id}`} style={{ fontWeight: 600 }}>
                    {item.lesson}
                  </Link>
                  <div className="small faint">{item.course}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

export function ExamPage() {
  const { level = '' } = useParams();
  const state = useAsync(() => api.exam(level), [level]);
  const [result, setResult] = useState<ExamResultResponse | null>(null);

  if (state.status === 'loading') return <div className="loading">Preparo la prova…</div>;
  if (state.status === 'error') {
    return (
      <div className="stack">
        <header>
          <h1 style={{ marginBottom: '0.2rem' }}>Traguardo</h1>
        </header>
        <div className="alert alert--error" role="alert">
          {state.error}
        </div>
        <div className="row">
          <Link className="btn btn--primary" to="/traguardo">
            Tutti i traguardi
          </Link>
          <Link className="btn btn--ghost" to="/">
            Torna al percorso
          </Link>
        </div>
      </div>
    );
  }

  const paper = state.data;
  if (result) {
    return (
      <ResultView
        exercises={paper.exercises}
        result={result}
        onRetry={() => {
          setResult(null);
          state.reload();
        }}
      />
    );
  }

  return (
    <div className="stack">
      <header>
        <h1 style={{ marginBottom: '0.2rem' }}>Traguardo {paper.level.label}</h1>
        <p className="muted" style={{ marginBottom: '0.4rem' }}>
          {paper.level.title} · {paper.exercises.length} domande · soglia {paper.threshold}%.
          Le domande vengono dalle lezioni che hai già chiuso.
        </p>
      </header>

      <Runner
        paper={paper}
        onFinish={(next) => {
          setResult(next);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
