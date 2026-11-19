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
 *
 * Non è una pagina di servizio: è la spiegazione del perché il sito esiste,
 * scritta con le stesse parole che userebbe chi lo ha fatto. Chi studia qui
 * deve poter capire, senza sapere niente di programmazione, dove finiscono i
 * suoi progressi.
 */
export function AboutPage() {
  return (
    <div className="stack">
      <header>
        <h1>Chi sono</h1>
        <p className="muted">
          CiaoCorea è scritto e curato da una persona sola. Ecco chi è, che cosa gli piace fare e
          perché questo posto esiste.
        </p>
      </header>

      <section className="card">
        <h2>Fabio Valentino</h2>
        <p>Sviluppatore e data engineer, Torino.</p>
        <p className="muted">
          {new Date().getFullYear() - FIRST_YEAR} anni di software nel settore bancario e
          industriale, dal {FIRST_YEAR}: analisi dei requisiti, documentazione, backend, frontend,
          integrazione continua. Il ciclo intero, non un pezzo solo. Oggi in Intesa Sanpaolo,
          fra microservizi e procedure batch che trattano grandi volumi di dati, con Google Cloud,
          BigQuery, PostgreSQL e Teradata.
        </p>
        <p className="muted">
          Ho cominciato nel {FIRST_YEAR} e non ho mai smesso di studiare: Python, Rust, Node.js e
          Bash me li sono imparati da solo, sui problemi veri. La stessa curiosità mi ha portato a
          Linux e alle reti — un homelab da amministrare, reverse proxy, DNS, VPN, servizi
          self-hosted — e alla sicurezza informatica, che più che un mestiere è un modo di guardare
          le cose: come possono rompersi, e chi potrebbe volerlo fare.
        </p>
      </section>

      <section className="card">
        <h2>Che cosa mi piace fare</h2>
        <p className="muted">
          Costruire cose e capire come funzionano sotto. Un server da sistemare, una pipeline da
          aggiustare, una lingua da decifrare: è sempre lo stesso piacere, quello di smontare un
          problema e rimetterlo insieme meglio di prima.
        </p>
        <p className="muted">
          Le lingue sono l'altra metà. Studio il coreano: leggo l'hangul, ho un buon vocabolario, e
          la grammatica è ancora in cantiere — come si vede, sono uno studente, non un insegnante.
          In ogni lingua cerco le stesse due cose: capire come funziona e non fermarmi alla
          superficie. Scrivere, poi, è il modo che conosco meglio per capire: se riesco a
          spiegarlo, allora l'ho imparato.
        </p>
      </section>

      <section className="card">
        <h2>Perché CiaoCorea</h2>
        <p className="muted">
          È nato da un problema concreto: studiare coreano in italiano. Chi ci prova trova materiale
          pensato per chi parla inglese, e finisce per imparare due cose difficili insieme — la
          lingua e la lingua delle spiegazioni. CiaoCorea è il posto che avrei voluto trovare:
          spiegazioni in italiano, dal primo carattere, con esercizi che correggono subito.
        </p>
        <p className="muted">
          È anche un esperimento, perché mi piace capire come funziona il software che uso: un'app
          completa che vive interamente nel browser. Niente server, niente account, niente
          pubblicità. I progressi restano sul tuo dispositivo, e questo è un limite dichiarato, non
          un difetto nascosto — più sotto è spiegato per bene.
        </p>
        <p className="muted">
          Non ci sono lezioni da guardare passivamente: si legge, si scrive, si sbaglia e si
          riprova. È il modo lento, ed è l'unico che lascia qualcosa.
        </p>
      </section>

      <section className="card" id="dati">
        <h2>Dove finiscono i tuoi dati</h2>
        <p className="muted">
          CiaoCorea non ha un server. È un sito statico: un insieme di file pubblicato su GitHub
          Pages, il servizio gratuito con cui GitHub serve le pagine web. Quando apri il sito, il
          tuo browser scarica quei file e fa tutto da solo: lezioni, correzioni, ripassi, tutto
          dentro il computer o il telefono che stai usando.
        </p>
        <p className="muted">
          I progressi non viaggiano. Restano in una piccola banca dati che vive dentro il browser
          (si chiama SQLite compilato in WebAssembly: un programma che il browser esegue come una
          pagina). In pratica: se apri CiaoCorea da un altro computer o da un telefono, trovi il
          percorso dall'inizio, perché nessuno ha copiato i tuoi progressi da nessuna parte. Non c'è
          un login e non c'è una password da ricordare: non c'è niente, su un server, a cui
          accedere. Per la stessa ragione i progressi non si sincronizzano fra due dispositivi.
        </p>
        <p className="muted">
          Sul computer possono studiare più persone: ogni profilo ha il suo nome e i suoi progressi,
          e si passa dall'uno all'altro con un clic, senza password. Chiudendo il browser non si
          perde niente; i progressi spariscono solo se si svuotano i dati del sito, o se si usa la
          navigazione in incognito, che li dimentica alla chiusura. È l'unico «salvataggio» che
          esiste: vale la pena saperlo.
        </p>
        <p className="muted">
          <strong>Cookie.</strong> CiaoCorea non usa cookie di tracciamento, di pubblicità o di
          profilazione, e nessun dato esce dal tuo dispositivo. Il browser conserva solo le
          informazioni tecniche che servono al sito per funzionare: il profilo attivo, i progressi
          e le preferenze come il tema chiaro o scuro. Non c'è niente da accettare perché non c'è
          niente da cedere — ma il riquadro te lo chiede lo stesso, per dirti che è così.
        </p>
        <div className="row">
          <Link className="btn btn--sm" to="/">
            Torna al percorso
          </Link>
          <Link className="btn btn--sm btn--ghost" to="/profili">
            Chi studia qui
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Contatti</h2>
        <p className="muted">
          Il sito personale, il codice di CiaoCorea e una casella di posta: per un errore, una
          parola che non torna o un'idea che manca.
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
            href="https://github.com/blastbeng/CiaoCorea"
            target="_blank"
            rel="noreferrer noopener"
          >
            Il codice su GitHub
          </a>
          <a className="btn btn--sm btn--ghost" href="mailto:fabiovalentino87@gmail.com">
            Scrivimi
          </a>
        </div>
      </section>
    </div>
  );
}
