import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExerciseResult, MistakeItem, MistakesStats } from '@ciaocorea/shared';
import { announcePending, api } from '../api';
import { errorMessage } from '../auth';
import { ExerciseInput, isKorean } from '../components/ExerciseInput';
import { PronounceButton } from '../components/PronounceButton';
import { useAsync } from '../useAsync';

/** "Sbagliato una volta" e "sbagliato quattro volte" non sono lo stesso problema. */
function timesText(count: number): string {
  if (count <= 1) return 'sbagliato una volta';
  return `sbagliato ${count} volte`;
}

function Origin({ item }: { item: MistakeItem }) {
  return (
    <p className="faint small" style={{ margin: '0 0 0.9rem' }}>
      Da <Link to={`/corso/${item.courseSlug}/lezione/${item.lessonId}`}>{item.lessonTitle}</Link>{' '}
      · {item.courseTitle} · {timesText(item.wrongCount)}
    </p>
  );
}

function Empty() {
  return (
    <div className="card empty">
      <h1>Nessun errore da rifare</h1>
      <p className="muted">
        Qui finiscono gli esercizi che sbagli: tornano una volta sola, e quando li azzecchi escono
        dalla banca. Per ora è vuota — buon segno.
      </p>
      <Link className="btn btn--primary" to="/">
        Torna al percorso
      </Link>
    </div>
  );
}

/**
 * Il ripasso degli errori: uno alla volta, gli esercizi che lo studente ha
 * sbagliato davvero, con la lezione da cui vengono. Non è il ripasso delle
 * parole — quello è a schede — e non è una lezione: qui non c'è voto, e non si
 * sblocca nulla. Azzeccarlo toglie l'esercizio dalla banca.
 */
export function MistakesPage() {
  const state = useAsync(() => api.mistakes(), []);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const [wrongCount, setWrongCount] = useState<number | null>(null);
  const [stats, setStats] = useState<MistakesStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'loading') return <div className="loading">Apro la banca degli errori…</div>;
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

  const { items } = state.data;
  if (items.length === 0) return <Empty />;

  const counts = stats ?? state.data.stats;
  const current = items[index];

  // Sessione finita: quello che è uscito dalla banca è uscito, il resto aspetta.
  if (!current) {
    return (
      <div className="stack">
        <div className="card empty">
          <h1>Giro finito</h1>
          <p className="muted">
            {counts.total === 0
              ? 'Hai rifatto tutti gli errori in banca: nessuno è rimasto indietro.'
              : `Restano ${counts.total} esercizi in banca: quelli che hai sbagliato di nuovo aspettano un altro giro.`}
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            {counts.total > 0 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setIndex(0);
                  setValue('');
                  setResult(null);
                  setWrongCount(null);
                  setError(null);
                  state.reload();
                }}
              >
                Rifai quelli che restano
              </button>
            ) : null}
            <Link className="btn" to="/">
              Torna al percorso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.answerMistake(current.exercise.id, value);
      setResult(response.result);
      setWrongCount(response.wrongCount);
      setStats(response.stats);
      announcePending();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    setIndex(index + 1);
    setValue('');
    setResult(null);
    setWrongCount(null);
    setError(null);
  };

  return (
    <div className="stack">
      <div className="row row--between">
        <h1 style={{ margin: 0 }}>Errori</h1>
        <span className="badge">
          {index + 1}/{items.length}
        </span>
      </div>

      <p className="muted small" style={{ marginTop: '-0.4rem' }}>
        {counts.total === 1 ? 'Un esercizio in banca' : `${counts.total} esercizi in banca`} ·{' '}
        {counts.lessons === 1 ? 'da 1 lezione' : `da ${counts.lessons} lezioni`}
      </p>

      <div className="progress">
        <span style={{ width: `${(index / items.length) * 100}%` }} />
      </div>

      <section className="card">
        <span className="badge">Esercizio sbagliato</span>
        <Origin item={current} />

        <p className="exercise-prompt">{current.exercise.prompt}</p>
        {current.exercise.hint && !result ? (
          <p className="hint">Suggerimento: {current.exercise.hint}</p>
        ) : null}

        <ExerciseInput
          exercise={current.exercise}
          value={value}
          onChange={setValue}
          onSubmit={() => {
            if (!result && !busy && value.trim().length > 0) void submit();
          }}
          disabled={busy || result !== null}
        />

        {error ? (
          <p className="alert alert--error" role="alert" style={{ marginTop: '1rem' }}>
            {error}
          </p>
        ) : null}

        {result ? (
          <div style={{ marginTop: '1.25rem' }}>
            <p className={result.correct ? 'result-mark result-mark--ok' : 'result-mark result-mark--wrong'}>
              {result.correct ? 'Giusto.' : 'Non ancora.'}
            </p>
            <p className="small">
              Risposta attesa:{' '}
              <strong className={isKorean(result.expected) ? 'hangul' : ''}>{result.expected}</strong>
              {isKorean(result.expected) ? (
                <PronounceButton text={result.expected} label={result.expected} />
              ) : null}
            </p>
            {result.correct && wrongCount === null ? (
              <p className="faint small">Fuori dalla banca: non lo rivedrai qui.</p>
            ) : null}
            {!result.correct && wrongCount !== null ? (
              <p className="faint small">
                Resta in banca, {timesText(wrongCount)}: rileggi la lezione e riprova.
              </p>
            ) : null}
            {current.exercise.explain ? (
              <p className="hint" style={{ marginTop: '0.5rem' }}>
                {current.exercise.explain}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="row" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void submit()}
              disabled={busy || value.trim().length === 0}
            >
              {busy ? 'Correggo…' : 'Controlla'}
            </button>
          </div>
        )}

        {result ? (
          <div className="row" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn--primary" onClick={advance}>
              {index + 1 >= items.length ? 'Chiudi il giro' : 'Avanti'}
            </button>
            <Link className="btn btn--ghost" to={`/corso/${current.courseSlug}/lezione/${current.lessonId}`}>
              Rivedi la lezione
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
