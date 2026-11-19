import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, useAuth } from '../auth';

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * La sezione utenti del portale: il database vive nel browser, quindi gli
 * studenti sono profili nello stesso posto. Si sceglie un nome e si continua
 * da dove si era: niente password, niente accessi.
 */
export function ProfilesPage() {
  const { user, accounts, addProfile, switchUser } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (userId: string) => {
    setError(null);
    setBusy(userId);
    try {
      const chosen = await switchUser(userId);
      if (chosen) navigate('/', { replace: true });
      else setError('Impossibile riaprire questo profilo: riprova.');
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    setError(null);
    setBusy('add');
    try {
      await addProfile();
      // Il profilo nuovo è già aperto: lo si porta alla home, dove il piano
      // della giornata lo aspetta.
      navigate('/', { replace: true });
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <header>
        <h1>Profili</h1>
        <p className="muted">
          I progressi vivono in questo browser, separati profilo da profilo. Si entra con un clic
          e si esce quando si vuole: non ci sono password da ricordare.
        </p>
      </header>

      <section className="card">
        <span className="label">Chi sta studiando?</span>
        <ul className="account-list">
          {accounts.map((account) => {
            const mine = account.id === user?.id;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  className={mine ? 'account-pick account-pick--mine' : 'account-pick'}
                  disabled={busy !== null}
                  onClick={() => {
                    // Il profilo già aperto non ha niente da fare: si torna alla
                    // home, dove lo studente stava studiando.
                    if (mine) {
                      navigate('/', { replace: true });
                      return;
                    }
                    void choose(account.id);
                  }}
                >
                  <span className="account-pick__name">@{account.username}</span>
                  <span className="faint small">
                    dal {formatDay(account.createdAt)}
                    {mine ? ' · profilo attivo' : ''}
                  </span>
                  {mine ? (
                    <span className="account-pick__go" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void add()}
            disabled={busy !== null}
          >
            {busy === 'add' ? 'Creo il profilo…' : 'Aggiungi un profilo'}
          </button>
        </div>
        <p className="hint">
          Il nome (stile <span className="faint small">@VeloceTigre42</span>) nasce generato e si
          cambia dal proprio profilo: è uno solo, quello che leggi in home e quello con la
          chiocciola. Anche i progressi restano qui: ogni profilo ha i suoi.
        </p>
      </section>
    </div>
  );
}
