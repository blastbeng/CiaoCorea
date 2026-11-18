import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage, useAuth } from '../auth';
import { api } from '../api';
import { useAsync } from '../useAsync';

interface LocationState {
  from?: string;
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Come è aperta l'iscrizione lo dice il server: la pagina non deve
  // promettere un modulo che la rotta di registrazione rifiuterebbe.
  const info = useAsync(() => api.registration(), []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true">
            한
          </div>
          <h1>CiaoCorea</h1>
          <p className="muted small">Impara il coreano, un giorno alla volta.</p>
        </div>

        <form className="card" onSubmit={submit}>
          <label className="field">
            <span className="label">Email o nome utente</span>
            <input
              className="input"
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Accesso…' : 'Entra'}
          </button>

          {info.status === 'ready' && !info.data.closed ? (
            <p className="hint center" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              Non hai un account? <Link to="/registrazione">Iscriviti</Link>
              {info.data.needsCode ? ' con il codice di invito' : ''}.
            </p>
          ) : (
            <p className="hint center" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              Le iscrizioni sono chiuse: l’accesso è riservato.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
