# CiaoCorea – Impara il Coreano

Portale web per imparare il coreano da autodidatta, pensato per chi parla
italiano. Si lavora su lettura e scrittura: jamo, sillabe, 받침, lessico,
comprensione. Il percorso è a tappe, con esercizi corretti dal server e la
possibilità di saltare una lezione già conosciuta superando un test.

Oltre al percorso ci sono tre stanze di servizio: il **dizionario** di tutte le
parole del curricolo, la **coda di ripasso** (SRS) e la pagina dei **progressi**,
con le statistiche complessive e il cambio della password. In cima alla home c'è
il **piano di oggi**: le poche cose da fare, in ordine, sopra all'obiettivo della
settimana che si sceglie lo studente.

Il portale è multi-utente: le iscrizioni si aprono con i codici invito
(`REGISTRATION_MODE=invite`), si lasciano aperte (`open`) o si tengono chiuse
(`closed`, default), e gli account si creano anche dalla riga di comando.

## Cosa si incontra

| Pagina | Cosa c'è |
| --- | --- |
| `/` Percorso | il piano di oggi, corsi, avanzamento, ripassi dovuti |
| `/corso/:slug` | unità e lezioni con lo stato di ciascuna |
| `/corso/:slug/lezione/:lessonId` | teoria, brani di lettura, lessico, esercizi, test di salto |
| `/dialoghi` e `/dialoghi/:slug` | conversazione scritta a copione |
| `/dizionario` | ricerca nelle parole del curricolo, con filtri per corso |
| `/ripassi` | carte in scadenza, giudizio `ho saputo / quasi / non ricordo` |
| `/progressi` | totali, per corso, parole SRS, obiettivo della settimana, ritmo dei giorni, password |
| `/registrazione` | nuovo account: nome, email, password, ed eventuale codice invito |

## Come è fatto

Monorepo npm workspaces, nessun servizio esterno e nessuna dipendenza da AI.

| Percorso | Contenuto |
| --- | --- |
| `apps/web` | React 18 + Vite, router, pagine |
| `apps/server` | Fastify 5, API, sessioni, SQLite |
| `packages/shared` | Tipi condivisi fra client e server |
| `packages/curriculum` | Schema zod e contenuti dei corsi (JSON) |
| `packages/engine` | Correzione esercizi, sblocco lezioni, ripasso SRS |

Scelte che vale la pena ricordare:

- **Le soluzioni non lasciano il server.** Il client riceve esercizi senza
  `answer`; la correzione avviene nel server, che ignora il punteggio del client.
  Lo stesso vale per la traduzione dei brani di lettura: arriva solo quando la
  lezione risulta superata o saltata, così il testo si affronta da soli.
- **Database SQLite** (`node:sqlite`, WAL) in `./data/ciaocorea.db`. Nessun
  database da amministrare, backup = copiare un file.
- **Il piano della giornata lo calcola il server** (`packages/engine/src/plan.ts`):
  prima la lezione che apre il percorso, poi le parole in scadenza, e la
  conversazione prende il posto dei ripassi quando non c'è nulla da ripassare. La
  settimana parte di lunedì e un giorno di studio conta anche solo per i ripassi.
- **Sessione con cookie httpOnly** `cc_session`, token salvato in DB solo come
  hash SHA-256, scadenza scorrevole. Login limitato per IP + identificativo.
- **Contenuti in JSON tipizzato**, validati da `npm run content:check`: un
  errore di scrittura (risposta non fra le opzioni, id duplicato) blocca la
  build del contenuto, non lo studente.

## Sviluppo

```bash
cp .env.example .env          # e compila SEED_USER_PASSWORD
npm install --include=dev     # attenzione: NODE_ENV=production omette le devDeps
npm run dev                   # API su :8080 + Vite su :5173 con proxy /api
```

Comandi utili:

```bash
npm test              # unit + integrazione (server con DB temporaneo)
npm run typecheck     # tutti i pacchetti, incluso il client
npm run content:check # validazione dei corsi
npm run build         # client in apps/web/dist + server in un solo file CJS

# account e codici invito (il server deve avere il DB già migrato)
npm run accounts -- user:list                 # studenti registrati
npm run accounts -- user:new anna@example.com --name=Anna
npm run accounts -- invite:new --note="corso del martedì"
npm run accounts -- invite:list               # chi è ancora valido
```

La password si passa con `--password` o con la variabile `ACCOUNT_PASSWORD`,
così non finisce nella cronologia dei comandi.

## Deploy

Tutto passa da Docker; l'avvio è il template systemd già presente sulla
macchina, che esegue `docker compose up` nella cartella del progetto.

```bash
# una volta sola
sudo systemctl enable docker-compose@ciaocorea

# avvio / stop / stato
sudo systemctl start docker-compose@ciaocorea
sudo systemctl stop docker-compose@ciaocorea
systemctl status docker-compose@ciaocorea
journalctl -u docker-compose@ciaocorea -f
```

L'app risponde su `http://<host>:18091` (porta modificabile con `WEB_PORT`).

Credenziali: `/opt/docker/compose/.secrets/ciaocorea.env`, fuori dal repository
e con permessi `600`.

```dotenv
SEED_USER_EMAIL=blast
SEED_USER_PASSWORD=...
SEED_USER_NAME=Blast

# closed | invite | open
REGISTRATION_MODE=invite
# codice "madre" d'emergenza, per il primo account quando di inviti non ce n'è
# ancora nessuno in database
REGISTRATION_CODE=...
```

Una variabile presente ma vuota (`KEY=`) vale come non settata, quindi il
default resta quello del codice.

Il volume `./data` contiene il database: è l'unica cosa da salvare. L'utente del
container ha uid 1000, lo stesso dell'utente che avvia il servizio, così il bind
mount resta scrivibile senza passare da root.

Se un giorno l'app finisce dietro HTTPS, metti `COOKIE_SECURE=1`: il cookie di
sessione diventa `Secure` e non viaggia più in chiaro.

## API

Tutte le rotte sotto `/api` richiedono la sessione, tranne `health`, `login` e
le due della registrazione.

| Metodo | Rotta | Uso |
| --- | --- | --- |
| GET | `/api/health` | stato del servizio |
| GET | `/api/auth/registration` | com'è configurata l'iscrizione: `mode`, `closed`, `needsCode` |
| POST | `/api/auth/register` | nuovo account (con `code` se serve) e accesso immediato |
| POST | `/api/auth/login` | accesso |
| POST | `/api/auth/logout` | uscita |
| GET | `/api/auth/session` | utente corrente o `null` |
| GET | `/api/dashboard` | corsi, progressi, riepilogo, ripassi dovuti, piano di oggi (`plan`) |
| GET | `/api/vocabulary` | dizionario: `q` (coreano/romanizzazione/italiano), `course`, `limit`, `offset` |
| GET | `/api/profile` | progressi, totali, giorni attivi (con i ripassi), SRS, dialoghi, `weeklyGoal` |
| POST | `/api/profile/goal` | obiettivo settimanale: da 1 a 7 giorni di studio |
| POST | `/api/auth/password` | cambia password chiudendo le altre sessioni |
| GET | `/api/courses/:slug` | dettaglio corso con stati delle lezioni |
| GET | `/api/courses/:slug/lessons/:id` | teoria, brani, esercizi pubblici, test di salto |
| POST | `/api/courses/:slug/lessons/:id/attempts` | consegna (`mode: lesson \| skip`) |
| GET | `/api/courses/:slug/skip-test` | prova per saltare il corso (domande fisse, una per lezione) |
| POST | `/api/courses/:slug/skip` | consegna la prova del corso: superata chiude tutte le lezioni |
| GET | `/api/review` | carte in scadenza |
| POST | `/api/review/:cardId` | giudizio `0 \| 1 \| 2` |
| GET | `/api/dialogues` | elenco dei dialoghi con lo stato di avanzamento |
| GET | `/api/dialogues/:slug` | copione pubblico, senza le battute non ancora recitate |
| POST | `/api/dialogues/:slug/answer` | risposta alla battuta corrente |
| POST | `/api/dialogues/:slug/restart` | riparte da capo, azzerando il progresso del dialogo |

## Come è organizzato il percorso

Ogni corso è una lista di unità, ogni unità una lista di lezioni. Una lezione
contiene punti di teoria, lessico ed esercizi di sette tipi:

- `jamo_choice` – riconoscere la lettera o la sillaba giusta;
- `block_build` – comporre una sillaba dai jamo;
- `type_hangul` – scrivere in coreano (tastiera su schermo inclusa);
- `reading_mcq` – leggere una parola e sceglierne il significato;
- `type_meaning` – tradurre in italiano;
- `order_words` – rimettere in ordine una frase, toccando le tessere;
- `fill_blank` – completare un buco in una frase, a scelta fra le opzioni o
  scrivendo la parola.

Gli ultimi due fanno *produrre* frasi, non solo riconoscere: sono quelli che
costano di più e sono anche gli unici due ammessi nel test di salto, dove
riconoscere una parola non basta.

Si supera con l'80% di risposte corrette. Il test di salto usa un sottoinsieme
fisso di cinque esercizi: chi lo passa marca la lezione come *saltata* e apre la
successiva, chi non lo passa torna agli esercizi completi. C'è anche il salto del
**corso** intero: dodici domande pescate una per lezione, sempre le stesse, e se
si superano tutte le lezioni del corso risultano chiuse. Ogni parola incontrata
entra nel ripasso a intervalli (SRS): le carte tornano dopo 1, 3, poi sempre più
tardi, e il giudizio dato decide di quanto.

Il primo corso, `hangul`, copre l'alfabeto in otto lezioni: vocali e consonanti
di base, consonanti aspirate e tese, vocali composte, 받침, regole di lettura e
lettura di insegne e menu.

Il secondo, `grammatica`, porta dalle lettere alle prime frasi: copula
이에요/예요, particelle 은/는 e 이/가, presente cortese -아요/-어요, poi 을/를, 에
ed 에서. Il terzo, `lessico`, mette le parole dentro frasi usabili: famiglia,
presentazioni (nome, età, provenienza), cibo e bevande, numeri sino-coreani e
prezzi in won. Il quarto, `a2`, alza il livello: passato in -았어요/-었어요, futuro
in -(으)ㄹ 거예요, forma di rispetto 높임말 (-(으)시-, 께서, 드시다/계시다) e frasi
legate con -고, -지만 e -아서/어서. La prima lezione di ogni corso è sempre aperta,
così chi ha già basi può entrare da lì; le successive seguono l'ordine del corso.

Il quinto, `b1`, è fatto solo di testi da leggere: l'annuncio di una stanza, il
menu con le note in fondo, il messaggio di servizio in ufficio, una notizia
breve. Ogni lezione porta il brano in coreano con il glossario delle parole
difficili, e sotto gli esercizi di comprensione; la traduzione italiana del
brano arriva solo quando la lezione risulta chiusa.

In tutto: cinque corsi, 24 lezioni, 194 voci di lessico, sette brani di lettura,
sei dialoghi. Il dizionario consultabile arriva a 222 voci perché comprende
anche le parole dei gloss, che sono quelle che si incontrano leggendo.

## Il piano della settimana

Sopra ai corsi, la home mostra il piano di oggi: tre cose al massimo, ordinate
per urgenza. Prima la lezione che apre il percorso, poi le parole in scadenza;
la conversazione prende il loro posto quando non c'è niente da ripassare. Sotto,
una riga dice come sta andando la settimana.

- L'**obiettivo** sono i giorni di studio da chiudere fra lunedì e domenica. Lo
  sceglie lo studente nella pagina dei progressi, da 1 a 7; il server non lo
  impone e non lo cambia da sé.
- Un giorno conta quando si fa almeno un esercizio **o** un ripasso: chi passa la
  giornata solo sulle parole in scadenza ha studiato, e lo streak non si rompe.
- Date in UTC, settimana da lunedì, `daysLeft` comprende oggi.
- Quando non c'è niente in scadenza il piano non inventa compiti: resta sulla
  riga della settimana, che è la cosa vera da sapere.

## Conversazione

I dialoghi non sono generati a runtime: sono copioni scritti a mano in
`packages/curriculum/data/dialogues.json`, con le battute dell'interlocutore e
quelle dello studente. Si risponde scegliendo fra le opzioni o scrivendo in
Hangul con la tastiera su schermo, e il server corregge con le varianti accettate
esattamente come per gli esercizi.

- Il coreano delle battute ancora da recitare non lascia il server: al client
  arriva la consegna in italiano, quindi la soluzione non è leggibile dalla rete.
- Alcuni dialoghi sono legati al percorso (`after: {courseSlug, lessonId}`): si
  aprono quando quella lezione è superata o saltata. Finché è chiusa, l'elenco
  mostra "in chiusura" con il link alla lezione da fare, la pagina del dialogo
  mostra la strada invece della prima battuta, e `/answer` risponde `409`.
- Dopo due errori sulla stessa battuta la forma viene rivelata e si prosegue con
  quella: nessuno resta bloccato in un dialogo.
- A dialogo finito le frasi entrano nella coda dei ripassi; `Ricomincia` azzera
  il progresso di quel dialogo, non le carte già raccolte.
- Il conteggio "al primo colpo" distingue una battuta saputa da una appena
  copiata: è il numero che compare a fine dialogo.
