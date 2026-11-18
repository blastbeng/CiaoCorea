import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, useAuth } from '../auth';

/**
 * Creare un profilo su questo browser. Niente codici di invito e niente
 * conferma via email: il database è qui, e il nome serve solo a distinguere
 * due studenti sullo stesso computer.
 */
export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      navigate('/', { replace: true });
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
            <span className="label">Come ti chiamiamo</span>
            <input
              className="input"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              maxLength={60}
              required
              autoFocus
            />
          </label>

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
            />
            <span className="hint">Serve a riconoscere il profilo al prossimo avvio.</span>
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="hint">Almeno 8 caratteri. Potrai cambiarla nei progressi.</span>
          </label>

          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Creazione…' : 'Comincia a studiare'}
          </button>

          <p className="hint center" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
            Hai già un profilo su questo browser? <Link to="/login">Scegli chi studia</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
