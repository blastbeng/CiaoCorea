import { Link } from 'react-router-dom';
import type { ExamLevelSummary } from '@ciaocorea/shared';
import { api } from '../api';
import { useAsync } from '../useAsync';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function LevelCard({ level, threshold }: { level: ExamLevelSummary; threshold: number }) {
  const share =
    level.totalLessons > 0
      ? Math.min(1, level.closedLessons / level.requiredLessons)
      : 0;

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <span className={`badge${level.passed ? ' badge--ok' : ''}`}>{level.label}</span>
          <h2 style={{ margin: '0.35rem 0 0.15rem' }}>{level.title}</h2>
        </div>
        {level.passed ? <span className="small badge badge--ok">Traguardo raggiunto</span> : null}
      </div>

      <p className="muted small" style={{ marginTop: 0 }}>
        {level.description}
      </p>

      <div className="progress" style={{ marginBottom: '0.35rem' }}>
        <span style={{ width: `${share * 100}%` }} />
      </div>
      <p className="small faint" style={{ marginTop: 0 }}>
        {level.closedLessons} di {level.totalLessons} lezioni chiuse
        {level.unlocked
          ? ' · la prova è aperta'
          : ` · se ne aprono ${level.requiredLessons} (${level.missingLessons} ancora da chiudere)`}
      </p>

      {level.bestScore !== null ? (
        <p className="small" style={{ marginTop: 0 }}>
          <strong>Miglior punteggio: {level.bestScore}%</strong>
          {' · '}
          {level.attempts === 1 ? 'una prova' : `${level.attempts} prove`}
          {level.passedAt ? ` · raggiunto il ${formatDate(level.passedAt)}` : ''}
        </p>
      ) : null}

      <div className="row" style={{ marginTop: '0.9rem' }}>
        {level.unlocked ? (
          <Link className="btn btn--primary" to={`/traguardo/${level.id}`}>
            {level.passed ? 'Rifai la prova' : 'Sostieni il traguardo'}
          </Link>
        ) : (
          <span className="muted small">
            Si apre con {level.requiredLessons} lezioni del livello chiuse. La soglia è il{' '}
            {threshold}%.
          </span>
        )}
      </div>
    </section>
  );
}

export function TraguardoPage() {
  const state = useAsync(() => api.exams(), []);

  if (state.status === 'loading') return <div className="loading">Leggo i traguardi…</div>;
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

  const { levels, threshold } = state.data;
  const open = levels.filter((level) => level.unlocked).length;
  const reached = levels.filter((level) => level.passed).length;

  return (
    <div className="stack">
      <header>
        <h1 style={{ marginBottom: '0.2rem' }}>Traguardo</h1>
        <p className="muted" style={{ marginBottom: '0.4rem' }}>
          Un controllo di metà strada per ogni livello: fino a venti domande prese solo dalle
          lezioni che hai già chiuso, nessun suggerimento, e alla fine sai dove tornare.
        </p>
        <p className="small faint">
          {open === 0
            ? 'Nessun traguardo è ancora aperto: il primo arriva a metà delle lezioni di un livello.'
            : `${open} ${open === 1 ? 'traguardo aperto' : 'traguardi aperti'}`}
          {reached > 0 ? ` · ${reached} già ${reached === 1 ? 'raggiunto' : 'raggiunti'}` : ''}
          {' · '}soglia {threshold}%
        </p>
      </header>

      <div className="alert">
        <strong>Non è un certificato.</strong> Il traguardo dice a che punto sei e cosa conviene
        riprendere: non sostituisce il percorso e non chiude le lezioni.
      </div>

      {levels.map((level) => (
        <LevelCard key={level.id} level={level} threshold={threshold} />
      ))}
    </div>
  );
}
