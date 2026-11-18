import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, useAuth } from '../auth';
import { api } from '../api';
import { useAsync } from '../useAsync';

/**
 * Iscrizione. Il modulo si comporta come dice il server (rotta
 * /api/auth/registration): se chiede un codice lo mostra, se le iscrizioni
 * sono chiuse non promette nulla che poi rifiuterebbe.
 */
export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const info = useAsync(() => api.registration(), []);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closed = info.status === 'ready' && info.data.closed;
  const needsCode = info.status === 'ready' && info.data.needsCode;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        code: code.trim() || undefined,
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

        {closed ? (
          <div className="card">
            <p className="alert alert--error" role="alert">
              Le iscrizioni sono chiuse: chiedi un accesso a chi gestisce il corso.
            </p>
            <Link className="btn btn--block" to="/login">
              Torna all’accesso
            </Link>
          </div>
        ) : (
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
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                required
              />
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

            {needsCode ? (
              <label className="field">
                <span className="label">Codice di invito</span>
                <input
                  className="input"
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="XXXX-XXXX-XXXX"
                  required
                />
                <span className="hint">Te lo dà chi gestisce il corso; ogni codice ha i suoi posti.</span>
              </label>
            ) : null}

            {error ? (
              <p className="alert alert--error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? 'Registrazione…' : 'Comincia a studiare'}
            </button>

            <p className="hint center" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              Hai già un account?{' '}
              <Link to="/login">Accedi</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
