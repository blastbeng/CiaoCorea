import { Link, useParams } from 'react-router-dom';
import { LESSON_STATE_LABEL, type LessonView } from '@ciaocorea/shared';
import { api } from '../api';
import { useAsync } from '../useAsync';

function LessonRow({ slug, lesson }: { slug: string; lesson: LessonView }) {
  const locked = lesson.state === 'locked';

  const body = (
    <>
      <span className="lesson-index">{lesson.titleKo.slice(0, 1) || '·'}</span>
      <span className="lesson-main">
        <span className="lesson-title">
          {lesson.title} <span className="hangul faint">· {lesson.titleKo}</span>
        </span>
        <span className="lesson-meta">
          {lesson.durationMin} min
          {lesson.bestScore !== null ? ` · miglior punteggio ${lesson.bestScore}%` : ''}
        </span>
      </span>
      <span className={`badge badge--${lesson.state}`}>{LESSON_STATE_LABEL[lesson.state]}</span>
    </>
  );

  if (locked) {
    return <div className="lesson-row lesson-row--locked">{body}</div>;
  }

  return (
    <Link className="lesson-row" to={`/corso/${slug}/lezione/${lesson.id}`}>
      {body}
    </Link>
  );
}

export function CoursePage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => api.course(slug), [slug]);

  if (state.status === 'loading') return <div className="loading">Carico il corso…</div>;
  if (state.status === 'error') {
    return (
      <div className="stack">
        <div className="alert alert--error" role="alert">
          {state.error}
        </div>
        <Link className="btn" to="/">
          Torna al percorso
        </Link>
      </div>
    );
  }

  const { course } = state.data;
  const { stats } = course;

  return (
    <div>
      <p className="small" style={{ marginBottom: '0.4rem' }}>
        <Link to="/">← Percorso</Link>
      </p>

      <header style={{ marginBottom: '1.25rem' }}>
        <div className="row row--between">
          <h1 style={{ marginBottom: '0.2rem' }}>{course.title}</h1>
          <span className="badge">{course.level}</span>
        </div>
        <p className="muted" style={{ marginBottom: '0.4rem' }}>
          {course.subtitle}
        </p>
        <p className="small">{course.description}</p>

        <div className="progress" style={{ marginTop: '0.75rem' }}>
          <span style={{ width: `${stats.percent}%` }} />
        </div>
        <p className="faint small" style={{ marginTop: '0.35rem' }}>
          {stats.percent}% · {stats.passed} completate · {stats.skipped} saltate su {stats.lessons}
        </p>

        {stats.lessons - stats.passed - stats.skipped > 0 ? (
          <p className="small" style={{ marginTop: '0.6rem' }}>
            Conosci già questa parte?{' '}
            <Link to={`/corso/${course.slug}/salta`}>Salta il corso con una prova</Link>
          </p>
        ) : null}
      </header>

      {course.units.map((unit) => (
        <section className="unit" key={unit.id}>
          <div className="unit-head">
            <h2 style={{ margin: 0 }}>{unit.title}</h2>
          </div>
          <p className="muted small">{unit.purpose}</p>

          <div className="lesson-list">
            {unit.lessons.map((lesson) => (
              <LessonRow key={lesson.id} slug={course.slug} lesson={lesson} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
