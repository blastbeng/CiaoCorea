import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage, useAuth } from '../auth';

interface LocationState {
  from?: string;
}

/**
 * La schermata d'ingresso di un portale che vive nel browser: non c'è un
 * server da convincere, ci sono i profili che hanno già studiato su questo
 * computer. Si sceglie un nome e si continua; la password serve solo per un
 * profilo che ha chiuso la sessione.
 */
export function Login() {
  const { accounts, user, login, switchUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const go = () => navigate(from && from !== '/login' ? from : '/', { replace: true });

  const choose = async (userId: string, fallbackEmail: string) => {
    setError(null);
    setBusy(userId);
    try {
      const chosen = await switchUser(userId);
      if (chosen) {
        go();
      } else {
        // La sessione è scaduta: si riparte dalla password, col nome già scritto.
        setEmail(fallbackEmail);
        setError('La sessione di questo profilo è scaduta: inserisci la password.');
      }
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy('form');
    try {
      await login(email.trim(), password);
      go();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
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

        {accounts.length > 0 ? (
          <div className="card">
            <span className="label">Chi sta studiando?</span>
            <ul className="account-list">
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    className="account-pick"
                    disabled={busy !== null || account.id === user?.id}
                    onClick={() => void choose(account.id, account.email)}
                  >
                    <span className="account-pick__name">{account.displayName}</span>
                    <span className="faint small">
                      {account.email}
                      {account.id === user?.id ? ' · profilo attivo' : ''}
                      {account.id !== user?.id && !account.hasSession ? ' · serve la password' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Link className="btn btn--block" to="/registrazione">
              Crea un nuovo profilo
            </Link>
          </div>
        ) : null}

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
              autoFocus={accounts.length === 0}
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

          <button className="btn btn--primary btn--block" type="submit" disabled={busy !== null}>
            {busy === 'form' ? 'Accesso…' : 'Entra'}
          </button>

          {accounts.length > 0 ? null : (
            <p className="hint center" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              Primo avvio su questo browser? <Link to="/registrazione">Crea un profilo</Link>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
