import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  DialogueAnswerResponse,
  DialogueDetail,
  DialogueSummary,
  PublicDialogueTurn,
} from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';
import { HangulInput } from '../components/HangulInput';
import { useAsync } from '../useAsync';

/**
 * La prima battuta che aspetta una risposta, a partire da `from`. Le battute
 * dell'altro interlocutore si attraversano da sole: sono già scritte.
 */
function nextAnswerIndex(turns: readonly PublicDialogueTurn[], from: number): number {
  for (let index = Math.max(0, from); index < turns.length; index += 1) {
    if (turns[index]?.answer) return index;
  }
  return turns.length;
}

export function DialoguePage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => api.dialogue(slug), [slug]);

  if (state.status === 'loading') return <div className="loading">Apro il dialogo…</div>;

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

  // key: cambiando dialogo il runner riparte pulito, senza stato del precedente.
  return <DialogueRunner key={state.data.dialogue.slug} initial={state.data} />;
}

/**
 * Schermo di rinvio per un dialogo il cui prerequisito non è ancora chiuso.
 * Il server risponde 409 allo stesso modo: qui si evita solo di far perdere
 * tempo a chi arriva col link in mano.
 */
function DialogueGate({ dialogue }: { dialogue: DialogueSummary }) {
  const after = dialogue.after;
  return (
    <div className="stack">
      <header>
        <Link to="/dialoghi" className="faint small">
          ← Conversazione
        </Link>
        <h1>{dialogue.title}</h1>
        <p className="muted small">{dialogue.setting}</p>
      </header>
      <div className="card stack">
        <span className="badge badge--locked">non ancora disponibile</span>
        <p>
          {after ? (
            <>
              Questo dialogo allena <strong>{after.lessonTitle}</strong>, la lezione{' '}
              {after.lessonId} del corso {after.courseTitle}. Superala (o saltala) e qui si apre.
            </>
          ) : (
            'Questo dialogo non è ancora disponibile.'
          )}
        </p>
        <div className="row">
          {after ? (
            <Link className="btn btn--primary" to={`/corso/${after.courseSlug}/lezione/${after.lessonId}`}>
              Vai alla lezione
            </Link>
          ) : null}
          <Link className="btn btn--ghost" to="/dialoghi">
            Torna ai dialoghi
          </Link>
        </div>
      </div>
    </div>
  );
}

function DialogueRunner({ initial }: { initial: DialogueDetail }) {
  const [detail, setDetail] = useState(initial);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<DialogueAnswerResponse | null>(null);

  // Prerequisito non chiuso: si mostra la strada, non la prima battuta.
  if (detail.dialogue.locked) return <DialogueGate dialogue={detail.dialogue} />;

  const { turns, turnIndex, dialogue } = detail;
  const currentIndex = nextAnswerIndex(turns, turnIndex);
  const current = currentIndex < turns.length ? turns[currentIndex]! : null;
  const completed = current === null;

  const submit = async (value: string) => {
    if (busy || !current) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.answerDialogue(dialogue.slug, value);
      setFeedback(result);
      setAnswer('');

      if (result.correct) {
        setDetail((previous) => ({
          ...previous,
          turnIndex: result.turnIndex,
          dialogue: {
            ...previous.dialogue,
            answered: result.answered,
            correct: result.correctCount,
            completed: result.completed,
          },
          // Il server non manda il coreano della battuta prima che sia
          // superata: appena lo è, lo si scrive nel transcript locale.
          turns: previous.turns.map((turn, index) =>
            index === currentIndex ? { ...turn, ko: result.expected ?? turn.ko } : turn,
          ),
        }));
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    setBusy(true);
    setError(null);
    try {
      setDetail(await api.restartDialogue(dialogue.slug));
      setFeedback(null);
      setAnswer('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <header className="row row--between">
        <div>
          <Link to="/dialoghi" className="faint small">
            ← Conversazione
          </Link>
          <h1>{dialogue.title}</h1>
          <p className="muted small">{dialogue.setting}</p>
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={restart} disabled={busy}>
          Ricomincia
        </button>
      </header>

      <details className="card">
        <summary className="small">
          <strong>Obiettivo:</strong> {dialogue.goal}
        </summary>
        <ul className="points">
          {dialogue.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>

      <section className="chat" aria-live="polite">
        {turns.slice(0, currentIndex).map((turn) => {
          const mine = turn.speaker === 'Tu';
          return (
            <div key={turn.id} className={`chat__row${mine ? ' chat__row--me' : ''}`}>
              <div className="chat__bubble">
                <span className="chat__speaker">{turn.speaker}</span>
                {turn.ko ? <p className="chat__ko">{turn.ko}</p> : null}
                <p className="chat__it">{turn.it}</p>
                {turn.note ? <p className="chat__note">{turn.note}</p> : null}
              </div>
            </div>
          );
        })}

        {current ? (
          <div className="card chat__task">
            <p className="stat-label">
              Tocca a te · battuta {dialogue.answered + 1} di {dialogue.totalTurns}
            </p>
            <p className="chat__it chat__it--task">{current.it}</p>
            {current.answer?.hint ? <p className="hint">{current.answer.hint}</p> : null}

            {current.answer?.kind === 'choice' ? (
              <div className="options">
                {current.answer.options?.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="option option--ko"
                    disabled={busy}
                    onClick={() => submit(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="stack">
                <HangulInput
                  value={answer}
                  onChange={setAnswer}
                  onSubmit={() => submit(answer)}
                  disabled={busy}
                  autoFocus
                  placeholder="Scrivi la tua battuta in coreano"
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy || answer.trim() === ''}
                  onClick={() => submit(answer)}
                >
                  Invia
                </button>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {feedback && !completed ? (
        feedback.correct ? (
          <div className="alert alert--info">
            <strong>Giusto.</strong> {feedback.expected}
            {feedback.note ? <p className="small">{feedback.note}</p> : null}
          </div>
        ) : (
          <div className="alert alert--error">
            <strong>Non ancora.</strong>{' '}
            {feedback.expected ? (
              <>
                La forma è <span className="hangul">{feedback.expected}</span>.
                {feedback.note ? <p className="small">{feedback.note}</p> : null}
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() => submit(feedback.expected ?? '')}
                >
                  Usa questa forma e prosegui
                </button>
              </>
            ) : (
              'Rileggi la battuta precedente e riprova: la forma non è quella.'
            )}
          </div>
        )
      ) : null}

      {completed ? (
        <div className="card stack">
          <h2>Dialogo completato</h2>
          <p>
            {dialogue.correct}/{dialogue.totalTurns} battute al primo colpo.
          </p>
          <p className="muted small">
            Le frasi del dialogo sono entrate nella coda dei ripassi: torneranno nei prossimi
            giorni.
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={restart} disabled={busy}>
              Ripeti il dialogo
            </button>
            <Link className="btn btn--ghost" to="/dialoghi">
              Torna ai dialoghi
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
