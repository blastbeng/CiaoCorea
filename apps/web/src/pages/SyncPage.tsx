import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  COMPACT_QR_LIMIT,
  decodeCompact,
  fitsInQr,
  type CompactCode,
  type ProfileImportSummary,
  type SnapshotInfo,
  type SyncPreview,
} from '@ciaocorea/store';
import { api } from '../api';
import { errorMessage, useAuth } from '../auth';
import { BACKUP_REMINDER_DAYS, daysSince, loadBackupInfo, markBackupExported } from '../backup';
import { QrScanner } from '../components/QrScanner';

type Message = { kind: 'ok' | 'error' | 'info'; text: string } | null;

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fileStem(username: string): string {
  const clean = username
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'profilo';
}

function downloadJson(name: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Il browser ha già cominciato a scaricare: la URL si può liberare subito.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function plurale(count: number, singolare: string, plurale: string): string {
  return `${count} ${count === 1 ? singolare : plurale}`;
}

/** Il riepilogo in parole: solo le righe che dicono qualcosa. */
function describe(summary: ProfileImportSummary): string[] {
  const lines: string[] = [];

  const lessons: string[] = [];
  if (summary.lessons.added > 0) {
    lessons.push(`${summary.lessons.added} ${summary.lessons.added === 1 ? 'nuova' : 'nuove'}`);
  }
  if (summary.lessons.updated > 0) {
    lessons.push(
      `${summary.lessons.updated} ${summary.lessons.updated === 1 ? 'aggiornata' : 'aggiornate'}`,
    );
  }
  if (lessons.length > 0) lines.push(`Lezioni: ${lessons.join(', ')}`);

  const cards: string[] = [];
  if (summary.cards.added > 0) {
    cards.push(`${summary.cards.added} ${summary.cards.added === 1 ? 'nuova' : 'nuove'}`);
  }
  if (summary.cards.updated > 0) {
    cards.push(
      `${summary.cards.updated} ${summary.cards.updated === 1 ? 'aggiornata' : 'aggiornate'}`,
    );
  }
  if (cards.length > 0) lines.push(`Ripassi: ${cards.join(', ')}`);

  if (summary.attempts > 0) lines.push(`Tentativi: ${summary.attempts}`);
  if (summary.writing > 0) lines.push(`Testi del quaderno: ${summary.writing}`);
  if (summary.days > 0) lines.push(`Giorni di studio: ${summary.days}`);
  if (summary.dialogues > 0) lines.push(`Conversazioni: ${summary.dialogues}`);

  const mistakes: string[] = [];
  if (summary.mistakes.added > 0) mistakes.push(`${summary.mistakes.added} in banca`);
  if (summary.mistakes.cleared > 0) mistakes.push(`${summary.mistakes.cleared} già corretti`);
  if (mistakes.length > 0) lines.push(`Errori: ${mistakes.join(', ')}`);

  return lines;
}

/**
 * Il trasferimento fra dispositivi, senza un server in mezzo.
 *
 * Il database resta nel browser: qui si costruisce un file che contiene un
 * profilo — o tutti — e lo si riporta dentro su un altro dispositivo. Non è
 * una sincronizzazione continua: è un ponte, e si vede quando serve. Il merge
 * non cancella quello che c'è: aggiunge, e tiene il meglio dei due lati.
 */
export function SyncPage() {
  const { user, reload } = useAuth();

  const [scope, setScope] = useState<'profile' | 'all'>('profile');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const [picked, setPicked] = useState<{ name: string; bundle: unknown } | null>(null);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');
  const [result, setResult] = useState<SyncPreview['outcome'] | null>(null);

  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [backup, setBackup] = useState(() => loadBackupInfo());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Il codice veloce: quello mostrato, il suo QR, e quello incollato o letto
  // dalla fotocamera.
  const [code, setCode] = useState<CompactCode | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pasted, setPasted] = useState('');

  useEffect(() => {
    void api.snapshotInfo().then(setSnapshot);
  }, []);

  const exportedDays = useMemo(
    () => (backup ? daysSince(backup.exportedAt) : null),
    [backup],
  );

  const runExport = async () => {
    setBusy('Preparo il file…');
    setMessage(null);
    try {
      const bundle = await api.exportTransfer(scope);
      const date = new Date().toISOString().slice(0, 10);
      const stem =
        scope === 'all' ? 'tutti-i-profili' : fileStem(user?.username ?? 'profilo');
      downloadJson(`ciaocorea-${stem}-${date}.json`, bundle);

      markBackupExported(scope);
      setBackup(loadBackupInfo());
      setMessage({
        kind: 'ok',
        text:
          bundle.profiles.length === 1
            ? 'File pronto: contiene il profilo aperto. Tienilo dove puoi ritrovarlo.'
            : `File pronto: contiene ${plurale(bundle.profiles.length, 'profilo', 'profili')} di questo browser.`,
      });
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(null);
    }
  };

  /** File, codice o QR finiscono tutti qui: l'anteprima è una sola. */
  const previewBundle = async (bundle: unknown, name: string) => {
    const read = await api.previewTransfer(bundle);
    setPicked({ name, bundle });
    setPreview(read);
    setStrategy('merge');

    // Il file e il codice arrivano da punti diversi della pagina: l'anteprima
    // deve venire a galla da sola, altrimenti sembra che non sia successo nulla.
    requestAnimationFrame(() => {
      document.getElementById('anteprima-trasferimento')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const readFile = async (file: File) => {
    setBusy('Leggo il file…');
    setMessage(null);
    setPreview(null);
    setResult(null);
    setPicked(null);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error('Il file non è un JSON valido: forse è stato troncato.');
      }

      await previewBundle(parsed, file.name);
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(null);
    }
  };

  const makeCode = async () => {
    setBusy('Preparo il codice…');
    setMessage(null);
    setQr(null);
    try {
      const generated = await api.transferCode();
      setCode(generated);

      if (fitsInQr(generated.code)) {
        // Il generatore di QR arriva solo adesso: chi non usa il codice non
        // scarica il suo peso.
        const { default: QRCode } = await import('qrcode');
        const png = await QRCode.toDataURL(generated.code, {
          errorCorrectionLevel: 'L',
          margin: 1,
          width: 320,
        });
        setQr(png);
      }
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(null);
    }
  };

  const applyCode = async (raw: string) => {
    setScanning(false);
    setBusy('Leggo il codice…');
    setMessage(null);
    setResult(null);
    setPreview(null);
    setPicked(null);

    try {
      const bundle = await decodeCompact(raw);
      await previewBundle(bundle, 'codice di trasferimento');
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setMessage({ kind: 'ok', text: 'Codice copiato: incollalo sull’altro dispositivo.' });
    } catch {
      setMessage({
        kind: 'error',
        text: 'Il browser non permette di copiare da solo: seleziona il testo e copialo a mano.',
      });
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const apply = async () => {
    if (!picked) return;
    if (strategy === 'replace') {
      const confirmed = window.confirm(
        'Sostituire i progressi di questo profilo con quelli del file? Quello che c’è qui e non è nel file verrà tolto. Prima viene salvata una copia per annullare.',
      );
      if (!confirmed) return;
    }

    setBusy('Importo…');
    setMessage(null);
    try {
      const imported = await api.importTransfer(picked.bundle, strategy);
      setResult(imported.outcome);
      setPreview(null);
      setPicked(null);
      setMessage({
        kind: 'ok',
        text:
          imported.outcome.profiles.length === 1
            ? `Importato: adesso stai studiando come @${imported.user.username}.`
            : `Importati ${plurale(imported.outcome.profiles.length, 'profilo', 'profili')}: li trovi in “Profili”.`,
      });
      await reload();
      setSnapshot(await api.snapshotInfo());
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    const confirmed = window.confirm(
      'Tornare al database com’era prima dell’ultima importazione? La pagina si ricaricherà.',
    );
    if (!confirmed) return;

    setBusy('Rimetto com’era…');
    try {
      const restored = await api.restoreSnapshot();
      if (!restored) {
        setMessage({ kind: 'error', text: 'Non c’è nessuna copia da ripristinare.' });
        return;
      }
      window.location.reload();
    } catch (problem) {
      setMessage({ kind: 'error', text: errorMessage(problem) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <header>
        <h1>Sincronizza i dispositivi</h1>
        <p className="muted">
          I progressi restano in questo browser. Per portarli su un altro dispositivo si passa da
          un file: si scarica qui, si apre là. Nessun account, nessun server, nulla che parta da
          solo.
        </p>
      </header>

      {message ? (
        <p
          className={
            message.kind === 'ok'
              ? 'alert alert--ok'
              : message.kind === 'error'
                ? 'alert alert--error'
                : 'alert alert--info'
          }
        >
          {message.text}
        </p>
      ) : null}

      <section className="card">
        <h2>Porta via i progressi</h2>
        <p className="muted small">
          Il file è un JSON leggibile: contiene lezioni, ripassi, errori e quaderno del profilo.
          Serve a ritrovarli su un altro dispositivo, e anche come backup se il browser dovesse
          svuotare i dati.
        </p>

        <fieldset className="choices">
          <legend className="stat-label">Cosa mettere nel file</legend>
          <label className="choice">
            <input
              type="radio"
              name="scope"
              checked={scope === 'profile'}
              onChange={() => setScope('profile')}
            />
            <span>
              <strong>Questo profilo</strong>
              <span className="faint small"> — @{user?.username}</span>
            </span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="scope"
              checked={scope === 'all'}
              onChange={() => setScope('all')}
            />
            <span>
              <strong>Tutti i profili di questo browser</strong>
              <span className="faint small"> — il backup completo del dispositivo</span>
            </span>
          </label>
        </fieldset>

        <div className="row">
          <button type="button" className="btn btn--primary" onClick={() => void runExport()} disabled={busy !== null}>
            {busy === 'Preparo il file…' ? 'Preparo…' : 'Scarica il file'}
          </button>
          {exportedDays !== null ? (
            <span className="faint small">
              Ultimo backup: {formatDay(backup!.exportedAt)}
              {exportedDays >= BACKUP_REMINDER_DAYS ? ' — è passato un po’' : ''}
            </span>
          ) : (
            <span className="faint small">Nessun backup ancora</span>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Il codice veloce</h2>
        <p className="muted small">
          Un codice — e un QR — con lezioni, ripassi e giorni di studio del profilo aperto. È il
          passaggio da telefono a computer senza cavo. Tentativi, quaderno ed errori non ci stanno:
          per quelli c’è il file.
        </p>

        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => void makeCode()}
            disabled={busy !== null}
          >
            {busy === 'Preparo il codice…' ? 'Preparo…' : 'Mostra il codice'}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setScanning((open) => !open)}
            disabled={busy !== null}
          >
            {scanning ? 'Chiudi la fotocamera' : 'Leggi un QR'}
          </button>
        </div>

        {scanning ? (
          <QrScanner onResult={(value) => void applyCode(value)} onClose={() => setScanning(false)} />
        ) : null}

        {code ? (
          <div className="stack stack--tight" style={{ marginTop: '1rem' }}>
            <p className="muted small">
              Dentro: {plurale(code.lessons, 'lezione', 'lezioni')} e{' '}
              {plurale(code.cards, 'ripasso', 'ripassi')}.
            </p>

            {qr ? (
              <div className="qr-box">
                <img
                  src={qr}
                  alt="Codice QR con i progressi del profilo"
                  width={320}
                  height={320}
                />
                <p className="faint small">
                  Inquadralo dall’altro dispositivo, da questa stessa pagina.
                </p>
              </div>
            ) : (
              <p className="alert alert--warn">
                Il codice è troppo lungo per un QR ({code.chars} caratteri, il limite è{' '}
                {COMPACT_QR_LIMIT}): copialo come testo, oppure usa il file.
              </p>
            )}

            <label className="field">
              <span className="stat-label">Codice</span>
              <textarea
                className="input code-box"
                readOnly
                value={code.code}
                rows={4}
                spellCheck={false}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <div className="row">
              <button type="button" className="btn btn--sm" onClick={() => void copyCode()}>
                Copia il codice
              </button>
            </div>
          </div>
        ) : null}

        <div className="stack stack--tight" style={{ marginTop: '1.2rem' }}>
          <h3>Hai un codice da un altro dispositivo</h3>
          <label className="field">
            <span className="stat-label">Incolla qui il codice</span>
            <textarea
              className="input code-box"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={3}
              placeholder="CC1z…"
              spellCheck={false}
            />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => void applyCode(pasted)}
              disabled={busy !== null || pasted.trim().length === 0}
            >
              Applica il codice
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Porta qui i progressi</h2>
        <p className="muted small">
          Apri il file che hai scaricato sull’altro dispositivo. Prima di applicarlo vedrai cosa
          cambierebbe: nessun progresso viene toccato finché non confermi.
        </p>

        <div
          className={dragging ? 'dropzone dropzone--over' : 'dropzone'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className="muted small">
            Trascina qui il file <strong>.json</strong>, oppure scegli il file dal dispositivo.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              // Lo stesso file scelto due volte deve poter ripartire.
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            Scegli il file
          </button>
          {picked && picked.name.endsWith('.json') ? (
            <p className="faint small">Scelto: {picked.name}</p>
          ) : null}
        </div>

        {preview ? (
          <div
            id="anteprima-trasferimento"
            className="stack stack--tight"
            style={{ marginTop: '1rem', scrollMarginTop: '1rem' }}
          >
            <h3>Cosa arriva</h3>
            <p className="muted small">
              Esportato il {formatDay(preview.exportedAt)}.
            </p>

            <ul className="plain-list">
              {preview.profiles.map((profile) => (
                <li key={profile.id}>
                  <strong>@{profile.username}</strong>
                  {profile.isMe ? <span className="faint small"> — è il profilo aperto</span> : null}
                </li>
              ))}
            </ul>

            {preview.outcome.profiles.map((summary) => {
              const lines = describe(summary);
              return (
                <div key={summary.userId} className="transfer-summary">
                  <strong>
                    @{summary.username}
                    {summary.renamedFrom ? (
                      <span className="faint small">
                        {' '}
                        (nel file era @{summary.renamedFrom}: qui il nome è già di un altro
                        profilo)
                      </span>
                    ) : null}
                  </strong>
                  {lines.length > 0 ? (
                    <ul className="plain-list">
                      {lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">
                      Niente di nuovo: questo dispositivo è già aggiornato.
                    </p>
                  )}
                </div>
              );
            })}

            <fieldset className="choices">
              <legend className="stat-label">Come applicarlo</legend>
              <label className="choice">
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'merge'}
                  onChange={() => setStrategy('merge')}
                />
                <span>
                  <strong>Unisci ai progressi di qui</strong>
                  <span className="faint small">
                    {' '}
                    — aggiunge quello che manca, non toglie niente
                  </span>
                </span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'replace'}
                  onChange={() => setStrategy('replace')}
                />
                <span>
                  <strong>Sostituisci il profilo</strong>
                  <span className="faint small">
                    {' '}
                    — lascia esattamente com’è nel file, togliendo il resto
                  </span>
                </span>
              </label>
            </fieldset>

            {strategy === 'replace' ? (
              <p className="alert alert--warn">
                Con “sostituisci” i progressi di questi profili diventano quelli del file: quello
                che è stato fatto qui e non è nel file sparisce. Prima dell’importazione viene
                tenuta una copia, e potrai annullare.
              </p>
            ) : null}

            <div className="row">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void apply()}
                disabled={busy !== null}
              >
                {busy === 'Importo…' ? 'Importo…' : 'Importa'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setPreview(null);
                  setPicked(null);
                }}
                disabled={busy !== null}
              >
                Annulla
              </button>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="stack stack--tight" style={{ marginTop: '1rem' }}>
            <h3>Fatto</h3>
            {result.profiles.map((summary) => (
              <div key={summary.userId} className="transfer-summary">
                <strong>@{summary.username}</strong>
                <ul className="plain-list">
                  {describe(summary).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="row">
              <Link className="btn btn--sm" to="/">
                Torna al percorso
              </Link>
              <Link className="btn btn--sm btn--ghost" to="/profili">
                Vedi i profili
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {snapshot ? (
        <section className="card">
          <h2>Annullare un’importazione</h2>
          <p className="muted small">
            Prima di applicare un file è stata messa da parte una copia del database, del{' '}
            {formatDay(snapshot.takenAt)}. Se l’importazione non era quella giusta, si torna
            indietro.
          </p>
          <div className="row">
            <button type="button" className="btn btn--sm" onClick={() => void undo()} disabled={busy !== null}>
              {busy === 'Rimetto com’era…' ? 'Rimetto…' : 'Torna com’era prima'}
            </button>
            <Link className="btn btn--sm btn--ghost" to="/profilo">
              Il tuo profilo
            </Link>
          </div>
        </section>
      ) : null}

      <p className="faint small">
        Nessun dato lascia il dispositivo da solo: l’unico modo in cui un profilo si sposta è un
        file che scarichi e apri tu.
      </p>
    </div>
  );
}
