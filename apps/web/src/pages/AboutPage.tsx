import { Link } from 'react-router-dom';

/**
 * Il primo anno di lavoro nel software. Gli anni di esperienza si contano da
 * qui, invece di essere scritti a mano: un numero fermo invecchia da solo, e
 * questa pagina non deve raccontare l'anno scorso.
 */
const FIRST_YEAR = 2011;


/**
 * La pagina che dice chi c'è dietro il portale. Sta fuori dal percorso di
 * studio — non si studia qui — ma sta dentro l'app perché è il posto dove una
 * persona che si fida dei propri progressi vuole sapere di chi sono i dati che
 * ha in mano.
 */
export function AboutPage() {
  return (
    <div className="stack">
      <header>
        <h1>Chi siamo</h1>
        <p className="muted">
          CiaoCorea è un progetto indipendente, senza pubblicità e senza account: un modo per
          imparare il coreano in italiano, partendo dall'alfabeto.
        </p>
      </header>

      <section className="card">
        <h2>Chi lo fa</h2>
        <p>
          <strong>Fabio Valentino</strong> — sviluppatore e data engineer, Torino.
        </p>
        <p className="muted">
          {new Date().getFullYear() - FIRST_YEAR} anni di software per il settore bancario e
          industriale, dal {FIRST_YEAR}: analisi, backend, frontend, integrazione continua. Oggi in
          Intesa Sanpaolo, fra microservizi e procedure batch che trattano grandi volumi di dati.
          Java, Python, Angular, Google Cloud e BigQuery; Linux e self-hosting come casa, non come
          curiosità.
        </p>
        <p className="muted">
          CiaoCorea nasce da lì: l'idea di mettere insieme le due cose che so fare meglio —
          costruire applicazioni e studiare le lingue — per un problema concreto. Chi studia
          coreano in italiano trova materiale sparso, pensato per chi parla inglese, e finisce
          per imparare due cose difficili insieme: la lingua e la lingua delle spiegazioni.
        </p>
        <div className="row">
          <a
            className="btn btn--sm"
            href="https://fabiovalentino.it"
            target="_blank"
            rel="noreferrer noopener"
          >
            fabiovalentino.it
          </a>
          <a
            className="btn btn--sm btn--ghost"
            href="https://github.com/blastbeng"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          <a className="btn btn--sm btn--ghost" href="mailto:fabiovalentino87@gmail.com">
            Scrivimi
          </a>
        </div>
      </section>

      <section className="card">
        <h2>Cos'è CiaoCorea</h2>
        <p className="muted">
          Un percorso che parte dalle lettere dell'hangul e arriva a leggere, scrivere e capire
          frasi vere. Lezioni brevi, esercizi che correggono subito, testi da leggere, dialoghi da
          seguire e un quaderno per scrivere. Gli errori non si nascondono: finiscono in una banca
          che torna a chiederteli finché non li hai rifatti.
        </p>
        <p className="muted">
          Non ci sono lezioni da guardare passivamente: si legge, si scrive, si sbaglia e si
          riprova. È il modo lento, ed è l'unico che lascia qualcosa.
        </p>
      </section>

      <section className="card">
        <h2>Dove finiscono i tuoi dati</h2>
        <p className="muted">
          Qui non c'è un server: l'applicazione è un sito statico e il database è un SQLite
          compilato in WebAssembly che vive dentro il tuo browser. I progressi restano su questo
          dispositivo, in questo browser, e si cancellano svuotando i dati del sito.
        </p>
        <p className="muted">
          Più persone possono studiare sullo stesso computer: ogni profilo ha il suo nome e i suoi
          progressi, e si passa dall'uno all'altro con un clic. Nessuna password, perché non c'è
          niente a cui accedere da fuori.
        </p>
        <div className="row">
          <Link className="btn btn--sm btn--ghost" to="/profilo">
            Il tuo profilo
          </Link>
          <Link className="btn btn--sm btn--ghost" to="/profili">
            Chi studia qui
          </Link>
        </div>
      </section>
    </div>
  );
}
