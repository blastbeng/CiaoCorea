import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  type AttemptResponse,
  type CourseView,
  type LessonDetail,
  type PublicExercise,
  type ReadingPassage,
  type WordLookupResponse,
} from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';
import { ExerciseInput, isKorean } from '../components/ExerciseInput';
import { PronounceButton } from '../components/PronounceButton';
import { useAsync } from '../useAsync';

type Mode = 'lesson' | 'skip';

/* ------------------------------------------------------------------ */
/* Brani di lettura                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ogni parola del brano si può cliccare. La scheda dice come si legge — la
 * romanizzazione e l'audio — e che cosa vuol dire; le parole che il dizionario
 * non conosce restano comunque cliccabili per l'audio, perché la lettura serve
 * prima del significato.
 *
 * Una scheda alla volta: aprirne una chiude quella di prima, così il brano non
 * si riempie di riquadri sovrapposti e si legge sempre da dove si è partiti.
 */
let closeOpenWord: { id: object; close: () => void } | null = null;

function WordToken({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [match, setMatch] = useState<WordLookupResponse['match']>(null);
  const selfRef = useRef<object | null>(null);

  const parts = token.match(/^([^가-힣]*)([가-힣]+)([^가-힣]*)$/);
  if (!parts) return <>{token}</>;
  const [, before, word, after] = parts;

  async function toggle() {
    const me = (selfRef.current ??= {});
    if (open) {
      setOpen(false);
      if (closeOpenWord?.id === me) closeOpenWord = null;
      return;
    }
    if (closeOpenWord && closeOpenWord.id !== me) closeOpenWord.close();
    closeOpenWord = { id: me, close: () => setOpen(false) };
    setOpen(true);
    if (asked || loading) return;
    setLoading(true);
    try {
      const result = await api.lookupWord(word);
      setMatch(result.match);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
      setAsked(true);
    }
  }

  const head = match ? match.ko : word;

  return (
    <span className="word-wrap">
      {before}
      <button
        type="button"
        className={`word${open ? ' word--open' : ''}`}
        aria-expanded={open}
        onClick={toggle}
      >
        {word}
      </button>
      {after}
      {open ? (
        <span className="wordcard">
          <span className="row row--between" style={{ alignItems: 'center' }}>
            <strong className="ko">{head}</strong>
            <PronounceButton text={head} label={word} />
          </span>
          {loading ? <span className="faint small">Cerco nel dizionario…</span> : null}
          {!loading && match ? (
            <>
              <span>{match.it}</span>
              <span className="faint small">{match.rr}</span>
              {match.via !== 'exact' ? (
                <span className="faint small">
                  nel brano: {word} → voce: {match.ko}
                </span>
              ) : null}
            </>
          ) : null}
          {!loading && !match ? (
            <span className="faint small">
              Non è ancora nel dizionario del corso: ascolta come si legge.
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function PassageLine({ line }: { line: string }) {
  return (
    <p className="passage__line">
      {line.split(' ').map((token, index) => (
        <span key={`${token}-${index}`}>
          {index > 0 ? ' ' : ''}
          <WordToken token={token} />
        </span>
      ))}
    </p>
  );
}

/**
 * Un brano si legge prima di fare gli esercizi: le parole difficili sono già
 * sotto gli occhi, la traduzione arriva solo quando la lezione è chiusa, così
 * lo studente prova da sé e non legge la risposta per prima.
 *
 * La traduzione non è nascosta qui: il server la toglie dalla risposta finché
 * la lezione non è superata o saltata. Se il campo è vuoto, non c'è nulla da
 * mostrare.
 */
function PassageCard({ passage }: { passage: ReadingPassage }) {
  return (
    <section className="card passage">
      <div className="row row--between" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{passage.title}</h2>
        <PronounceButton text={passage.lines.join(' ')} label={passage.title} />
      </div>

      <div className="passage__ko">
        {passage.lines.map((line, index) => (
          <PassageLine key={`${passage.title}-${index}`} line={line} />
        ))}
      </div>

      <h3>Parole da guardare prima</h3>
      <ul className="gloss">
        {passage.gloss.map((item) => (
          <li key={`${item.ko}-${item.it}`}>
            <span className="ko">
              {item.ko} <PronounceButton text={item.ko} label={item.ko} />
            </span>
            <span className="gloss__it">{item.it}</span>
            <span className="faint small">{item.rr}</span>
          </li>
        ))}
      </ul>

      {passage.translation ? (
        <div className="passage__it">
          <h3>Traduzione</h3>
          <p>{passage.translation}</p>
        </div>
      ) : (
        <p className="hint">
          Prova a capire il brano da solo: la traduzione compare quando la lezione è
          superata o saltata.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Studio                                                              */
/* ------------------------------------------------------------------ */

function StudyView({ detail, onStart }: { detail: LessonDetail; onStart: (mode: Mode) => void }) {
  const { lesson } = detail;
  const canSkip = detail.skipTest.length > 0;

  return (
    <div className="stack">
      <section className="card">
        <h2>In breve</h2>
        <p className="muted">{lesson.goal}</p>
        <ul className="points">
          {lesson.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      {lesson.vocab.length > 0 ? (
        <section className="card">
          <h2>Parole della lezione</h2>
          <ul className="vocab">
            {lesson.vocab.map((item) => (
              <li key={`${item.ko}-${item.it}`}>
                <div className="ko">
                  {item.ko} <PronounceButton text={item.ko} label={item.ko} />
                </div>
                <div>{item.it}</div>
                <div className="faint small">{item.rr}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(lesson.passages ?? []).map((passage, index) => (
        <PassageCard key={`${lesson.id}-passage-${index}`} passage={passage} />
      ))}

      <div className="row">
        <button type="button" className="btn btn--primary" onClick={() => onStart('lesson')}>
          Inizia gli esercizi
        </button>
      </div>

      {canSkip ? (
        <section className="card">
          <h3>Conosci già questi contenuti?</h3>
          <p className="muted small">
            Affronta un test rapido di {detail.skipTest.length} domande. Se lo superi, la lezione
            risulta saltata e passi avanti; se no, ti restano gli esercizi completi.
          </p>
          <button type="button" className="btn" onClick={() => onStart('skip')}>
            Fai il test di salto
          </button>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Esercizi                                                            */
/* ------------------------------------------------------------------ */

interface RunnerProps {
  detail: LessonDetail;
  mode: Mode;
  onFinish: (result: AttemptResponse) => void;
}

function Runner({ detail, mode, onFinish }: RunnerProps) {
  const exercises = mode === 'skip' ? detail.skipTest : detail.exercises;
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
      const result = await api.submit(
        detail.course.slug,
        detail.lesson.id,
        mode,
        payload,
        Date.now() - startedAt.current,
      );
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
    return <div className="alert alert--error">Questa lezione non ha esercizi disponibili.</div>;
  }

  return (
    <div className="card">
      <div className="exercise-head">
        <span className="badge">
          {mode === 'skip' ? 'Test di salto' : 'Esercizio'} {index + 1}/{exercises.length}
        </span>
        <div className="progress" style={{ flex: 1 }}>
          <span style={{ width: `${((index + (answered ? 1 : 0)) / exercises.length) * 100}%` }} />
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
  );
}

/* ------------------------------------------------------------------ */
/* Esito                                                               */
/* ------------------------------------------------------------------ */

function nextLessonOf(course: CourseView, lessonId: string) {
  const all = course.units.flatMap((unit) => unit.lessons);
  const position = all.findIndex((lesson) => lesson.id === lessonId);
  if (position < 0 || position + 1 >= all.length) return null;
  return { slug: course.slug, lesson: all[position + 1]! };
}

interface ResultProps {
  detail: LessonDetail;
  mode: Mode;
  result: AttemptResponse;
  exercises: PublicExercise[];
  onRetry: () => void;
}

function ResultView({ detail, mode, result, exercises, onRetry }: ResultProps) {
  const { attempt } = result;
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const next = attempt.passed ? nextLessonOf(result.course, detail.lesson.id) : null;

  return (
    <div className="stack">
      <section className="card">
        <div className="score">
          <span className="score-value">{attempt.score}%</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {attempt.passed
                ? mode === 'skip'
                  ? 'Test superato: lezione saltata'
                  : 'Lezione superata'
                : 'Non ancora: ti serve l’80%'}
            </p>
            <p className="muted small" style={{ margin: 0 }}>
              {attempt.correct} risposte corrette su {attempt.total}
            </p>
          </div>
        </div>

        <div className="row" style={{ marginTop: '1.25rem' }}>
          {next ? (
            <Link
              className="btn btn--primary"
              to={`/corso/${next.slug}/lezione/${next.lesson.id}`}
            >
              Lezione successiva: {next.lesson.title}
            </Link>
          ) : null}

          <button type="button" className={next ? 'btn' : 'btn btn--primary'} onClick={onRetry}>
            Riprova
          </button>

          <Link className="btn btn--ghost" to={`/corso/${detail.course.slug}`}>
            Torna al corso
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Dettaglio</h2>
        <ul className="result-list">
          {attempt.results.map((item) => {
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
                  <div style={{ fontWeight: 600 }}>{exercise?.prompt ?? item.exerciseId}</div>
                  <div className="small">
                    <span className="muted">La tua risposta: </span>
                    <span className={exercise && isKorean(item.expected) ? 'hangul' : ''}>
                      {item.response || '—'}
                    </span>
                  </div>
                  {item.correct ? null : (
                    <div className="small">
                      <span className="muted">Risposta attesa: </span>
                      <span className={isKorean(item.expected) ? 'hangul' : ''}>
                        {item.expected}
                      </span>
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

/* ------------------------------------------------------------------ */
/* Sessione                                                            */
/* ------------------------------------------------------------------ */

function Session({ detail }: { detail: LessonDetail }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<AttemptResponse | null>(null);

  const start = (next: Mode) => {
    setMode(next);
    setResult(null);
    setRunId((value) => value + 1);
  };

  const exercises = mode === 'skip' ? detail.skipTest : detail.exercises;

  if (result && mode) {
    return (
      <ResultView
        detail={detail}
        mode={mode}
        result={result}
        exercises={exercises}
        onRetry={() => start(mode)}
      />
    );
  }

  if (mode) {
    return (
      <Runner
        key={`${mode}-${runId}`}
        detail={detail}
        mode={mode}
        onFinish={(attempt) => setResult(attempt)}
      />
    );
  }

  return <StudyView detail={detail} onStart={start} />;
}

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export function LessonPage() {
  const { slug = '', lessonId = '' } = useParams();
  const state = useAsync(() => api.lesson(slug, lessonId), [slug, lessonId]);

  if (state.status === 'loading') return <div className="loading">Carico la lezione…</div>;

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

  const detail = state.data;

  return (
    <div>
      <p className="small" style={{ marginBottom: '0.4rem' }}>
        <Link to={`/corso/${detail.course.slug}`}>← {detail.course.title}</Link>
        <span className="faint"> · {detail.unit.title}</span>
      </p>

      <header style={{ marginBottom: '1.25rem' }}>
        <div className="row row--between">
          <h1 style={{ marginBottom: '0.15rem' }}>{detail.lesson.title}</h1>
          <span className={`badge badge--${detail.lesson.state}`}>
            {detail.lesson.bestScore !== null ? `migliore ${detail.lesson.bestScore}%` : 'nuova'}
          </span>
        </div>
        <p className="ko-lg" style={{ margin: '0.2rem 0 0.5rem' }}>
          {detail.lesson.titleKo}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          {detail.lesson.goal} · {detail.lesson.durationMin} min
        </p>
      </header>

      <Session detail={detail} />
    </div>
  );
}
