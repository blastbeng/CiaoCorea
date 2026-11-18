import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../useAsync';

/**
 * Elenco dei dialoghi. Alcuni sono legati a una lezione del percorso: finché
 * quella lezione non è passata o saltata la scheda resta chiusa e il pulsante
 * porta alla lezione che serve, non al dialogo. Il server ripete lo stesso
 * controllo, quindi qui il blocco è una cortesia, non una sicurezza.
 */
export function DialoguesPage() {
  const state = useAsync(() => api.dialogues(), []);

  if (state.status === 'loading') return <div className="loading">Carico i dialoghi…</div>;

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

  const { dialogues } = state.data;

  return (
    <div className="stack">
      <header>
        <h1>Conversazione</h1>
        <p className="muted">
          Dialoghi a copione: tu rispondi, la scena va avanti. Niente improvvisazione, ogni
          battuta ha una forma attesa e le varianti accettate sono già scritte.
        </p>
      </header>

      {dialogues.length === 0 ? (
        <div className="card empty">Nessun dialogo disponibile.</div>
      ) : (
        <section className="dialogue-grid">
          {dialogues.map((dialogue) => {
            const percent =
              dialogue.totalTurns === 0
                ? 0
                : Math.round((dialogue.answered / dialogue.totalTurns) * 100);
            const cta = dialogue.completed
              ? 'Ripeti'
              : dialogue.answered > 0
                ? 'Continua'
                : 'Inizia';
            const { locked, after } = dialogue;

            return (
              <article
                key={dialogue.slug}
                className={locked ? 'card dialogue-card dialogue-card--locked' : 'card dialogue-card'}
              >
                <div className="dialogue-card__head">
                  <h2>{dialogue.title}</h2>
                  <span className={locked ? 'badge badge--locked' : 'badge badge--available'}>
                    {locked ? 'in chiusura' : dialogue.level}
                  </span>
                </div>

                <p className="muted small">{dialogue.setting}</p>
                <p className="small">
                  <strong>Obiettivo:</strong> {dialogue.goal}
                </p>

                <div className="progress">
                  <span style={{ width: `${percent}%` }} />
                </div>

                <div className="dialogue-card__foot">
                  {locked && after ? (
                    <span className="faint small">
                      Si apre dopo{' '}
                      <Link to={`/corso/${after.courseSlug}/lezione/${after.lessonId}`}>
                        {after.lessonTitle}
                      </Link>
                    </span>
                  ) : (
                    <span className="faint small">
                      {dialogue.answered}/{dialogue.totalTurns} battute
                      {dialogue.answered > 0 ? ` · ${dialogue.correct} al primo colpo` : ''}
                    </span>
                  )}
                  {locked ? (
                    after ? (
                      <Link
                        className="btn btn--sm"
                        to={`/corso/${after.courseSlug}/lezione/${after.lessonId}`}
                      >
                        Vai alla lezione
                      </Link>
                    ) : (
                      <button type="button" className="btn btn--sm" disabled>
                        Bloccato
                      </button>
                    )
                  ) : (
                    <Link className="btn btn--primary btn--sm" to={`/dialoghi/${dialogue.slug}`}>
                      {cta}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
