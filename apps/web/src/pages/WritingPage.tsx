import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { WritingCheck, WritingEntry, WritingPromptView, WritingVerdict } from '@ciaocorea/shared';
import { api } from '../api';
import { errorMessage } from '../auth';
import { HangulInput } from '../components/HangulInput';
import { PronounceButton } from '../components/PronounceButton';
import { useAsync } from '../useAsync';

const VERDICT_BADGE: Record<WritingVerdict, string> = {
  model: 'badge badge--passed',
  close: 'badge badge--in_progress',
  far: 'badge badge--locked',
};

const VERDICT_LABEL: Record<WritingVerdict, string> = {
  model: 'come il modello',
  close: 'quasi',
  far: 'da rivedere',
};

const VERDICT_ALERT: Record<WritingVerdict, string> = {
  model: 'alert alert--ok',
  close: 'alert alert--info',
  far: 'alert alert--error',
};

/** Il commento della correzione: dice cosa fare, non solo com'è andata. */
function verdictText(check: WritingCheck): string {
  if (check.verdict === 'model') {
    return 'È la forma del modello. Riscrivila una volta senza guardare: è così che si fissa.';
  }
  if (check.verdict === 'close') {
    return 'Ci sei quasi: le parole ci sono, la forma no. Guarda dove il tuo testo si stacca dal modello.';
  }
  return check.missing.length > 0
    ? 'Manca qualche parola che la consegna chiedeva. Riguarda il modello e riprova.'
    : 'La frase è un’altra. Rileggi la consegna e il modello, poi riprova.';
}

function PromptCard({
  prompt,
  onWritten,
}: {
  prompt: WritingPromptView;
  /** Prima prova su questa consegna: la pagina ne tiene il conto nel riepilogo. */
  onWritten: (promptId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<WritingEntry | null>(prompt.last);
  const [result, setResult] = useState<{ check: WritingCheck; text: string } | null>(null);

  if (!prompt.unlocked) {
    return (
      <article className="card writing-card writing-card--locked">
        <div className="writing-card__head">
          <h2>{prompt.title}</h2>
          <span className="badge badge--locked">Bloccata</span>
        </div>
        <p className="muted small">{prompt.task}</p>
        <p className="faint small">
          Si apre dopo{' '}
          <Link to={`/corso/${prompt.courseSlug}/lezione/${prompt.lessonId}`}>
            {prompt.lessonTitle}
          </Link>
        </p>
      </article>
    );
  }

  const submit = async () => {
    if (busy || text.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.submitWriting(prompt.id, text);
      setResult({ check: response.check, text: response.entry.text });
      setLast(response.entry);
      setText('');
      setOpen(false);
      if (!last) onWritten(prompt.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const rewrite = () => {
    setResult(null);
    setError(null);
    setOpen(true);
  };

  return (
    <article className="card writing-card">
      <div className="writing-card__head">
        <h2>{prompt.title}</h2>
        {last ? (
          <span className={VERDICT_BADGE[last.verdict]}>{VERDICT_LABEL[last.verdict]}</span>
        ) : (
          <span className="badge badge--available">da scrivere</span>
        )}
      </div>

      <p className="small">{prompt.task}</p>

      {prompt.words.length > 0 ? (
        <div className="chips">
          {prompt.words.map((word) => (
            <span className="chip chip--hint" key={word} lang="ko">
              {word} <PronounceButton text={word} label={word} />
            </span>
          ))}
        </div>
      ) : null}

      {result ? (
        <div className="stack stack--tight">
          <p className={VERDICT_ALERT[result.check.verdict]}>{verdictText(result.check)}</p>

          <div className="compare">
            <div>
              <span className="stat-label">Il tuo testo</span>
              <p className="compare__ko" lang="ko">
                {result.text} <PronounceButton text={result.text} label="il tuo testo" />
              </p>
            </div>
            <div>
              <span className="stat-label">Modello</span>
              <p className="compare__ko" lang="ko">
                {result.check.model}{' '}
                <PronounceButton text={result.check.model} label="il modello" />
              </p>
            </div>
          </div>

          {result.check.missing.length > 0 ? (
            <p className="small">
              Parole che mancavano:{' '}
              <span className="hangul" lang="ko">
                {result.check.missing.join(' · ')}
              </span>
            </p>
          ) : null}

          {result.check.notes ? <p className="hint">{result.check.notes}</p> : null}

          <div className="row">
            <button type="button" className="btn btn--primary btn--sm" onClick={rewrite}>
              Scrivi di nuovo
            </button>
          </div>
        </div>
      ) : open ? (
        <div className="stack stack--tight">
          <HangulInput
            value={text}
            onChange={setText}
            multiline
            rows={3}
            autoFocus
            disabled={busy}
            placeholder="Scrivi la tua frase in coreano"
          />
          <div className="row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || text.trim() === ''}
              onClick={submit}
            >
              {busy ? 'Confronto…' : 'Confronta con il modello'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Chiudi
            </button>
          </div>
        </div>
      ) : (
        <div className="writing-card__foot">
          <span className="faint small">
            {last
              ? `Ultima prova: ${new Date(last.createdAt).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'short',
                })}`
              : 'Non ancora provata'}
          </span>
          <div className="row">
            <Link
              className="faint small"
              to={`/corso/${prompt.courseSlug}/lezione/${prompt.lessonId}`}
            >
              Rivedi la lezione
            </Link>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
              Scrivi
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Il quaderno: le consegne chiedono di produrre una frase, non di riconoscerla.
 * Non c'è correzione automatica di una frase libera, quindi il patto è un
 * altro: si scrive, si confronta con il modello, e la differenza la vede lo
 * studente. Per questo il modello arriva solo dopo l'invio.
 */
export function WritingPage() {
  const state = useAsync(() => api.writing(), []);
  // Le consegne provate in questa visita: il riepilogo in testa non deve
  // restare fermo a "0 provate" dopo che hai appena scritto.
  const [written, setWritten] = useState<string[]>([]);

  if (state.status === 'loading') return <div className="loading">Apro il quaderno…</div>;

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

  const { prompts, stats } = state.data;

  // Le consegne arrivano già nell'ordine dei corsi: si raggruppano senza
  // riordinarle, così il quaderno segue il percorso.
  const groups: Array<{ slug: string; title: string; prompts: WritingPromptView[] }> = [];
  for (const prompt of prompts) {
    const group = groups.find((item) => item.slug === prompt.courseSlug);
    if (group) group.prompts.push(prompt);
    else groups.push({ slug: prompt.courseSlug, title: prompt.courseTitle, prompts: [prompt] });
  }

  return (
    <div className="stack">
      <header>
        <h1>Quaderno</h1>
        <p className="muted">
          Qui scrivi tu. Nessuno corregge una frase libera al posto tuo: dopo l'invio vedi il
          modello, le parole che la consegna chiedeva e una nota di grammatica. Il confronto è il
          lavoro — leggere la differenza insegna più di un voto.
        </p>
        <p className="faint small">
          {Math.min(stats.total, stats.done + written.length)}/{stats.total} consegne provate ·{' '}
          {stats.unlocked} aperte su {stats.total}
        </p>
      </header>

      {prompts.length === 0 ? (
        <div className="card empty">Nessuna consegna disponibile.</div>
      ) : (
        groups.map((group) => (
          <section key={group.slug} className="stack">
            <div className="row row--between">
              <h2>{group.title}</h2>
              <Link className="faint small" to={`/corso/${group.slug}`}>
                Vai al corso
              </Link>
            </div>
            <div className="writing-grid">
              {group.prompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onWritten={(promptId) =>
                    setWritten((previous) =>
                      previous.includes(promptId) ? previous : [...previous, promptId],
                    )
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
