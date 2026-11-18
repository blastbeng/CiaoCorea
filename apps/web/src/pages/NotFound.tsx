import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="card empty">
      <h1>Pagina non trovata</h1>
      <p className="muted">Il link non porta da nessuna parte, oppure la lezione è stata spostata.</p>
      <Link className="btn btn--primary" to="/">
        Torna al percorso
      </Link>
    </div>
  );
}
