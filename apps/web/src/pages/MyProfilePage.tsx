import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from '@ciaocorea/shared';
import { errorMessage, hasGeneratedUsername, useAuth } from '../auth';

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function initial(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** Il nome con cui lo studente vuole essere chiamato: quello della home. */
function DisplayNameForm({ initial: start }: { initial: string }) {
  const { rename } = useAuth();
  const [name, setName] = useState(start);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // Il nome salvato può cambiare anche dall'altro modulo (chi sceglie il nome
  // utente si porta dietro il nome con cui è chiamato): il campo lo segue.
  useEffect(() => {
    setName(start);
  }, [start]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const user = await rename(name.trim());
      setName(user.displayName);
      setMessage({ kind: 'ok', text: `Ciao ${user.displayName}: nome salvato.` });
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack stack--tight" onSubmit={submit}>
      <label className="field">
        <span className="stat-label">Come vuoi essere chiamato</span>
        <input
          className="input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={60}
          required
        />
      </label>

      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={busy || name.trim() === start}>
          {busy ? 'Salvo…' : 'Salva il nome'}
        </button>
      </div>

      {message ? (
        <p className={message.kind === 'ok' ? 'alert alert--ok' : 'alert alert--error'}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Il nome utente con la chiocciola: quello che nasce generato (`VeloceTigre42`)
 * e che distingue i profili nell'elenco. Qui si sostituisce con un nome scelto.
 */
function UsernameForm({ initial: start }: { initial: string }) {
  const { changeUsername } = useAuth();
  const [username, setUsername] = useState(start);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // Dopo un salvataggio il nome cambia: il campo deve mostrare quello nuovo,
  // non il nome generato di prima.
  useEffect(() => {
    setUsername(start);
  }, [start]);

  const trimmed = username.trim();
  const looksValid =
    trimmed.length >= USERNAME_MIN && trimmed.length <= USERNAME_MAX && USERNAME_PATTERN.test(trimmed);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const user = await changeUsername(trimmed);
      setUsername(user.username);
      setMessage({ kind: 'ok', text: `Nome utente salvato: @${user.username}.` });
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack stack--tight" onSubmit={submit}>
      <label className="field">
        <span className="stat-label">Nome utente</span>
        <input
          className="input"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          required
        />
      </label>

      <p className="hint">
        Da {USERNAME_MIN} a {USERNAME_MAX} caratteri: lettere, numeri, punto, trattino e
        underscore, senza spazi. È il nome che vedi con la chiocciola, e deve restare unico fra i
        profili di questo computer.
      </p>

      <div className="row">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={busy || !looksValid || trimmed === start}
        >
          {busy ? 'Salvo…' : 'Salva il nome utente'}
        </button>
      </div>

      {message ? (
        <p className={message.kind === 'ok' ? 'alert alert--ok' : 'alert alert--error'}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

/**
 * La pagina del proprio profilo: ci si arriva cliccando il proprio nome in alto.
 * Due nomi, due mestieri: quello con cui si è chiamati (che si legge ovunque) e
 * il nome utente con la chiocciola (che distingue i profili sullo stesso
 * computer). Nessuno dei due è una credenziale: non c'è niente da proteggere.
 */
export function MyProfilePage() {
  const { user, accounts } = useAuth();

  if (!user) return null;

  const fromGenerated = hasGeneratedUsername(user);
  const created = accounts.find((account) => account.id === user.id)?.createdAt;

  return (
    <div className="stack">
      <header>
        <h1>Il tuo profilo</h1>
        <p className="muted">
          Il nome con cui studi, e quello che ti distingue dagli altri profili di questo browser.
        </p>
      </header>

      <section className="card profile-hero">
        <span className="avatar" aria-hidden="true">
          {initial(user.displayName)}
        </span>
        <div className="profile-hero__text">
          <strong className="profile-hero__name">{user.displayName}</strong>
          <span className="faint small">
            @{user.username}
            {created ? ` · dal ${formatDay(created)}` : ''}
          </span>
        </div>
        <Link className="btn btn--sm btn--ghost" to="/profili">
          Cambia profilo
        </Link>
      </section>

      {fromGenerated ? (
        <p className="alert alert--warn">
          Al primo avvio il portale ti ha dato un nome utente generato. Scegliti il tuo qui sotto:
          comparirà in alto, nella home e nell'elenco dei profili.
        </p>
      ) : null}

      <section className="card">
        <h2>Come vuoi essere chiamato</h2>
        <p className="muted small">
          È il nome che leggi nella home e nei progressi: quello che il portale usa per parlarti.
        </p>
        <DisplayNameForm initial={user.displayName} />
      </section>

      <section className="card">
        <h2>Nome utente</h2>
        <p className="muted small">
          Quello con la chiocciola, nato generato al primo avvio. Serve a riconoscere i profili
          quando sullo stesso computer studia più di una persona.
        </p>
        <UsernameForm initial={user.username} />
      </section>

      <section className="card">
        <h2>Chi altro studia qui</h2>
        <p className="muted small">
          I progressi restano in questo browser, uno per profilo. Nessuna password: si cambia
          studente con un clic.
        </p>
        <div className="row">
          <Link className="btn btn--sm" to="/profili">
            Vedi i profili ({accounts.length})
          </Link>
          <Link className="btn btn--sm btn--ghost" to="/progressi">
            I tuoi progressi
          </Link>
        </div>
      </section>
    </div>
  );
}
