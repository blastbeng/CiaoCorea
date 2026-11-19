import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { errorMessage } from '../auth';
import { useAsync } from '../useAsync';

function formatDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

const GOAL_DAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Obiettivo della settimana: lo sceglie lo studente. Un numero che si regge
 * vale più di uno alto, e sopra quello si costruisce il piano della giornata.
 */
function GoalForm({ initial }: { initial: number }) {
  const [goal, setGoal] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.setGoal(goal);
      setGoal(response.weeklyGoal);
      setSaved(response.weeklyGoal);
      setMessage({
        kind: 'ok',
        text: `Obiettivo salvato: ${response.weeklyGoal} ${response.weeklyGoal === 1 ? 'giorno' : 'giorni'} di studio a settimana.`,
      });
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack stack--tight" onSubmit={submit}>
      <p className="muted small">
        Un giorno conta quando fai almeno un esercizio, un ripasso o un testo nel quaderno. Metti
        il numero che reggerai davvero: il piano di oggi si regola su questo.
      </p>

      <label className="field">
        <span className="stat-label">Giorni di studio a settimana</span>
        <select
          className="input"
          value={goal}
          onChange={(event) => setGoal(Number(event.target.value))}
        >
          {GOAL_DAYS.map((days) => (
            <option key={days} value={days}>
              {days} {days === 1 ? 'giorno' : 'giorni'}
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={busy || goal === saved}>
          {busy ? 'Salvo…' : 'Salva l’obiettivo'}
        </button>
      </div>

      {message ? (
        <p className={message.kind === 'ok' ? 'alert alert--ok' : 'alert alert--error'}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

export function ProfilePage() {
  const state = useAsync(() => api.profile(), []);

  if (state.status === 'loading') return <div className="loading">Conto i tuoi progressi…</div>;

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

  const profile = state.data;
  const { summary, totals, srs, activity, dialogues, vocabulary } = profile;
  const maxDay = Math.max(1, ...activity.map((day) => day.exercises));
  const recent = activity.slice(-14);
  const lessonsClosed = summary.lessonsPassed + summary.lessonsSkipped;

  return (
    <div className="stack">
      <header>
        <h1>I tuoi progressi</h1>
        <p className="muted">
          Studio dal {formatDate(profile.memberSince)}. Qui c'è ciò che hai fatto, non ciò che
          devi fare: per quello c'è il percorso.
        </p>
      </header>

      <section className="grid grid--3">
        <div className="stat">
          <div className="stat-value">
            {lessonsClosed}/{summary.lessonsTotal}
          </div>
          <div className="stat-label">Lezioni chiuse</div>
        </div>
        <div className="stat">
          <div className="stat-value">{summary.percent}%</div>
          <div className="stat-label">Avanzamento</div>
        </div>
        <div className="stat">
          <div className="stat-value">{summary.streakDays}</div>
          <div className="stat-label">Giorni di fila</div>
        </div>
        <div className="stat">
          <div className="stat-value">{totals.exercises}</div>
          <div className="stat-label">Esercizi fatti</div>
        </div>
        <div className="stat">
          <div className="stat-value">{totals.accuracy}%</div>
          <div className="stat-label">Risposte giuste</div>
        </div>
        <div className="stat">
          <div className="stat-value">{srs.words}</div>
          <div className="stat-label">Parole in ripasso</div>
        </div>
      </section>

      <section className="card">
        <h2>Settimana</h2>
        <p className="muted small">
          Sei a {summary.streakDays} {summary.streakDays === 1 ? 'giorno di fila' : 'giorni di fila'}
          . Che cosa fare oggi sta scritto nel piano, sulla home: qui decidi solo il ritmo della
          settimana.
        </p>
        <GoalForm initial={profile.weeklyGoal} />
      </section>

      <section className="card">
        <h2>Corsi</h2>
        <div className="stack stack--tight">
          {profile.courses.map((course) => (
            <div className="course-row" key={course.slug}>
              <Link className="course-row__title" to={`/corso/${course.slug}`}>
                {course.title}
              </Link>
              <span className="faint small">
                {course.stats.passed} superate
                {course.stats.skipped > 0 ? ` · ${course.stats.skipped} saltate` : ''} ·{' '}
                {course.stats.percent}%
              </span>
              <div className="progress">
                <span style={{ width: `${course.stats.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid--2">
        <div className="card">
          <h2>Ripassi</h2>
          <div className="stack stack--tight">
            <p className="muted small">
              {srs.cards === 0
                ? 'Nessuna parola in ripasso: le prime card arrivano chiudendo una lezione.'
                : `${srs.cards} card da ${srs.words} parole. ${srs.due} in scadenza oggi, ${srs.reviewed} già ripassate, ${srs.mature} a distanza di una settimana o più.`}
            </p>
            <div className="row">
              <Link className="btn btn--sm" to="/ripassi">
                Vai ai ripassi
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Conversazione e dizionario</h2>
          <div className="stack stack--tight">
            <p className="muted small">
              {dialogues.completed} dialoghi su {dialogues.total} portati a termine ·{' '}
              {dialogues.answered} battute recitate, {dialogues.correct} giuste al primo colpo.
            </p>
            <p className="muted small">
              {vocabulary.seen} parole del dizionario incontrate su {vocabulary.total}.
            </p>
            <div className="row">
              <Link className="btn btn--sm" to="/dialoghi">
                Dialoghi
              </Link>
              <Link className="btn btn--sm" to="/dizionario">
                Dizionario
              </Link>
              <Link className="btn btn--sm" to="/quaderno">
                Quaderno
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Ritmo</h2>
        {recent.length === 0 ? (
          <p className="muted small">Non hai ancora fatto esercizi: la prima lezione apre il percorso.</p>
        ) : (
          <>
            <p className="muted small">
              Ultime {recent.length} giornate studiate; l'altezza dice quanti esercizi hai fatto.
              I ripassi e i testi del quaderno contano come giorno di studio, ma non alzano le
              barre.
            </p>
            <div className="heat" aria-label="Esercizi per giorno">
              {recent.map((day) => (
                <div
                  className="heat-col"
                  key={day.day}
                  title={`${formatDay(day.day)}: ${day.exercises} esercizi, ${day.correct} giusti, ${day.lessonsCompleted} lezioni chiuse, ${day.reviews} ripassi, ${day.writing} testi`}
                >
                  <span
                    className="heat-bar"
                    style={{ height: `${Math.max(6, Math.round((day.exercises / maxDay) * 100))}%` }}
                  />
                  <span className="heat-day faint small">{formatDay(day.day)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>Identità</h2>
        <p className="muted small">
          Profilo <strong>@{profile.user.username}</strong>, creato il{' '}
          {formatDate(profile.memberSince)}. Non ci sono password: per cambiare studente si passa
          a un altro profilo nella sezione Profili.
        </p>
        <div className="row">
          <Link className="btn btn--sm" to="/profilo">
            Nome e nome utente
          </Link>
          <Link className="btn btn--sm btn--ghost" to="/profili">
            Cambia profilo
          </Link>
        </div>
      </section>
    </div>
  );
}
