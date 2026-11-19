import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from '@ciaocorea/shared';
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

/**
 * L'unico nome del profilo: nome e nome utente sono la stessa cosa, quindi c'è
 * un solo campo da riempire e una sola scelta da ricordare. Nasce generato
 * (`VeloceTigre42`), e qui si sostituisce con un nome scelto.
 */
function UsernameForm({ initial: start }: { initial: string }) {
  const { changeUsername } = useAuth();
  const [username, setUsername] = useState(start);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // Dopo un salvataggio il nome cambia: il campo deve mostrare quello nuovo,
  // non quello generato di prima.
  useEffect(() => {
    setUsername(start);
  }, [start]);

  const trimmed = username.trim();
  const looksValid =
    trimmed.length >= USERNAME_MIN &&
    trimmed.length <= USERNAME_MAX &&
    USERNAME_PATTERN.test(trimmed);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const user = await changeUsername(trimmed);
      setUsername(user.username);
      setMessage({ kind: 'ok', text: `Ciao ${user.username}: nome salvato.` });
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack stack--tight" onSubmit={submit}>
      <label className="field">
        <span className="stat-label">Nome</span>
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
        underscore, senza spazi. È l'unico nome che hai: quello che leggi nella home, quello in
        alto e quello con la chiocciola fra i profili, e deve restare unico su questo computer.
      </p>

      <div className="row">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={busy || !looksValid || trimmed === start}
        >
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
 * La pagina del proprio profilo: ci si arriva cliccando il proprio nome in alto.
 * Un nome solo, per tutto: con quello il portale ti saluta, ti elenca fra i
 * profili del computer e ti scrive con la chiocciola. Nessun nome è una
 * credenziale: non c'è niente da proteggere.
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
          Il nome con cui studi: uno solo, e ti distingue dagli altri profili di questo browser.
        </p>
      </header>

      <section className="card profile-hero">
        <span className="avatar" aria-hidden="true">
          {initial(user.username)}
        </span>
        <div className="profile-hero__text">
          <strong className="profile-hero__name">{user.username}</strong>
          <span className="faint small">
            {created ? `dal ${formatDay(created)}` : 'profilo di questo browser'}
          </span>
        </div>
        <Link className="btn btn--sm btn--ghost" to="/profili">
          Cambia profilo
        </Link>
      </section>

      {fromGenerated ? (
        <p className="alert alert--warn">
          Al primo avvio il portale ti ha dato un nome generato. Scegliti il tuo qui sotto:
          comparirà in alto, nella home e nell'elenco dei profili.
        </p>
      ) : null}

      <section className="card">
        <h2>Il tuo nome</h2>
        <p className="muted small">
          È l'unico nome del profilo: quello che il portale usa per parlarti, e lo stesso che
          compare con la chiocciola accanto agli altri profili.
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
