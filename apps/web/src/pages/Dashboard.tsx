import { Link } from 'react-router-dom';
import type { CourseView } from '@ciaocorea/shared';
import { api } from '../api';
import { useAuth } from '../auth';
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

  const { courses, summary, dueCards } = state.data;

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

      {summary.nextLesson ? (
        <section className="card">
          <p className="stat-label">Riprendi da qui</p>
          <h2 style={{ marginBottom: '0.15rem' }}>{summary.nextLesson.lessonTitle}</h2>
          <p className="muted small">
            {courses.find((course) => course.slug === summary.nextLesson?.courseSlug)?.title}
          </p>
          <Link
            className="btn btn--primary"
            to={`/corso/${summary.nextLesson.courseSlug}/lezione/${summary.nextLesson.lessonId}`}
          >
            Apri la lezione
          </Link>
        </section>
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

      {dueCards > 0 ? (
        <div className="alert alert--info row row--between">
          <span>Hai {dueCards} parole da ripassare oggi.</span>
          <Link className="btn btn--sm" to="/ripassi">
            Vai ai ripassi
          </Link>
        </div>
      ) : null}

      <section className="stack">
        <h2>I tuoi corsi</h2>
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </section>
    </div>
  );
}
