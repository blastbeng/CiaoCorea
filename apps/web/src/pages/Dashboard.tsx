import { Link } from 'react-router-dom';
import type { CourseView, PlanTask, StudyPlan } from '@ciaocorea/shared';
import { api } from '../api';
import { hasGeneratedUsername, useAuth } from '../auth';
import { useAsync } from '../useAsync';

function CourseCard({ course }: { course: CourseView }) {
  const { stats } = course;
  return (
    <article className="card">
      <div className="row row--between" style={{ marginBottom: '0.35rem' }}>
        <h2 style={{ margin: 0 }}>
          <Link to={`/corso/${course.slug}`}>{course.title}</Link>
        </h2>
        <span className="badge">{course.level}</span>
      </div>

      <p className="muted small">{course.description}</p>

      <div className="progress" role="progressbar" aria-valuenow={stats.percent}>
        <span style={{ width: `${stats.percent}%` }} />
      </div>

      <div className="row row--between" style={{ marginTop: '0.6rem' }}>
        <span className="faint small">
          {stats.passed} completate · {stats.skipped} saltate · {stats.lessons} lezioni
        </span>
        <Link className="btn btn--sm" to={`/corso/${course.slug}`}>
          Apri il corso
        </Link>
      </div>
    </article>
  );
}

/** Come si chiama il pulsante di ogni compito: un verbo, non un nome ripetuto. */
const TASK_ACTION: Record<PlanTask['key'], string> = {
  lesson: 'Apri la lezione',
  reviews: 'Ripassa',
  writing: 'Apri il quaderno',
  dialogue: 'Conversare',
};

/**
 * Il piano della giornata. Le decisioni le ha già prese il motore (cosa fare,
 * in che ordine, quanto manca alla settimana): qui si mostrano e basta, così la
 * pagina non può dire una cosa diversa da quella che risponderebbe l'API.
 */
function PlanCard({ plan }: { plan: StudyPlan }) {
  const closed = Math.min(plan.daysStudied, plan.goal);
  return (
    <section className="card plan">
      <div className="row row--between" style={{ marginBottom: '0.3rem' }}>
        <p className="stat-label" style={{ margin: 0 }}>
          Il piano di oggi
        </p>
        <span className="badge">
          {closed}/{plan.goal} giorni questa settimana
        </span>
      </div>

      <div className="plan__week" aria-hidden="true">
        {Array.from({ length: plan.goal }, (_, index) => (
          <span
            key={index}
            className={index < plan.daysStudied ? 'plan__dot plan__dot--done' : 'plan__dot'}
          />
        ))}
      </div>

      {plan.tasks.length > 0 ? (
        <ul className="plan__tasks">
          {plan.tasks.map((task) => (
            <li className="plan__task" key={task.key}>
              <span className="plan__task-text">
                <span className="plan__label">{task.label}</span>
                <span className="plan__detail">{task.detail}</span>
              </span>
              <Link className="btn btn--sm btn--primary" to={task.href}>
                {TASK_ACTION[task.key]}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="plan__note">{plan.note}</p>

      <p className="faint small">
        I giorni di studio della settimana li scegli tu:{' '}
        <Link to="/progressi">regola l’obiettivo nei progressi</Link>.
      </p>
    </section>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const state = useAsync(() => api.dashboard(), []);

  if (state.status === 'loading') return <div className="loading">Carico il percorso…</div>;
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

  const { courses, summary, dueCards, plan } = state.data;
  const nameIsGenerated = hasGeneratedUsername(user);

  return (
    <div className="stack">
      <header>
        <h1>Ciao, {user?.displayName ?? 'studente'}</h1>
        <p className="muted">
          {summary.lessonsPassed > 0
            ? 'Continua da dove hai lasciato: la costanza vale più delle sessioni lunghe.'
            : 'Si parte dalle lettere: poche cose al giorno, ripetute, si fissano.'}
        </p>
      </header>

      {/* Il primo giorno nessuno ha scelto il proprio nome: lo ha fatto il
          portale. Dirlo qui costa una riga e risparmia un profilo anonimo. */}
      {nameIsGenerated ? (
        <p className="alert alert--warn">
          Il nome utente <strong>@{user?.username}</strong> l'ha scelto il portale.{' '}
          <Link to="/profilo">Cambia qui il tuo username</Link> — o almeno il nome con cui vuoi
          essere chiamato.
        </p>
      ) : null}

      <PlanCard plan={plan} />

      {/* Gli errori non entrano nel piano: il piano decide cosa studiare, la
          banca dice cosa hai già sbagliato. Sono due cose diverse e si vedono
          diverse, ma se la banca non è vuota vale la pena dirlo qui. */}
      {summary.mistakesOpen > 0 ? (
        <p className="alert alert--info">
          {summary.mistakesOpen === 1
            ? 'Un esercizio sbagliato aspetta di essere rifatto.'
            : `${summary.mistakesOpen} esercizi sbagliati aspettano di essere rifatti.`}{' '}
          <Link to="/errori">Rifai gli errori</Link>
        </p>
      ) : null}

      <section className="grid grid--3">
        <div className="stat">
          <div className="stat-value">{summary.percent}%</div>
          <div className="stat-label">Percorso completato</div>
          <div className="progress" style={{ marginTop: '0.6rem' }}>
            <span style={{ width: `${summary.percent}%` }} />
          </div>
        </div>

        <div className="stat">
          <div className="stat-value">
            {summary.lessonsPassed + summary.lessonsSkipped}/{summary.lessonsTotal}
          </div>
          <div className="stat-label">Lezioni chiuse</div>
          <p className="faint small" style={{ margin: '0.4rem 0 0' }}>
            {summary.lessonsSkipped} saltate con il test
          </p>
        </div>

        <div className="stat">
          <div className="stat-value">{summary.streakDays}</div>
          <div className="stat-label">
            {summary.streakDays === 1 ? 'Giorno di fila' : 'Giorni di fila'}
          </div>
          <p className="faint small" style={{ margin: '0.4rem 0 0' }}>
            {dueCards > 0 ? `${dueCards} ripassi in scadenza` : 'Nessun ripasso in scadenza'}
          </p>
        </div>
      </section>

      <section className="stack">
        <h2>I tuoi corsi</h2>
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </section>
    </div>
  );
}
