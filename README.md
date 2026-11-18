# CiaoCorea – Impara il Coreano

Portale web per imparare il coreano da autodidatta, pensato per chi parla
italiano. Si lavora su lettura e scrittura: jamo, sillabe, 받침, lessico,
comprensione. Il percorso è a tappe, con esercizi corretti dal server e la
possibilità di saltare una lezione già conosciuta superando un test.

Oltre al percorso ci sono cinque stanze: il **dizionario** di tutte le parole
del curricolo, la **coda di ripasso** (SRS) che dopo due passaggi chiede di
scrivere la parola, il **quaderno** dove si scrivono
frasi proprie confrontandole con un modello, la **banca degli errori** con gli
esercizi sbagliati da rifare, e la pagina dei **progressi**, con le statistiche
complessive e il cambio della password. In cima alla home c'è il **piano di
oggi**: le poche cose da fare, in ordine, sopra all'obiettivo della settimana che
si sceglie lo studente.

Il portale è multi-utente: le iscrizioni si aprono con i codici invito
(`REGISTRATION_MODE=invite`), si lasciano aperte (`open`) o si tengono chiuse
(`closed`, default), e gli account si creano anche dalla riga di comando.

## Cosa si incontra

| Pagina | Cosa c'è |
| --- | --- |
| `/` Percorso | il piano di oggi (lezione, ripassi, quaderno, dialogo), corsi, avanzamento |
| `/corso/:slug` | unità e lezioni con lo stato di ciascuna |
| `/corso/:slug/lezione/:lessonId` | teoria, brani di lettura, lessico, esercizi, test di salto |
| `/dialoghi` e `/dialoghi/:slug` | conversazione scritta a copione |
| `/dizionario` | ricerca nelle parole del curricolo, con filtri per corso |
| `/quaderno` | dodici consegne di scrittura: si scrive la frase, poi si confronta con il modello |
| `/ripassi` | carte in scadenza, giudizio `ho saputo / quasi / non ricordo`; sotto, le parole fragili da riprovare subito |
| `/errori` | gli esercizi che hai sbagliato, uno alla volta: azzeccarli li toglie dalla banca |
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
  prima la lezione che apre il percorso, poi le parole in scadenza, poi il
  quaderno, e la conversazione prende il posto che resta quando la giornata è
  leggera. La settimana parte di lunedì e un giorno di studio conta anche solo per
  i ripassi.
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
| GET | `/api/progress/due` | solo i due numeri dei badge della barra in alto: `dueCards` e `mistakes` |
| GET | `/api/review` | carte in scadenza: direzione `read`/`write`, senza la risposta delle carte da scrivere |
| POST | `/api/review/:cardId` | chiude la carta: `{ grade }` per leggere, `{ response }` per scrivere, con l'esito della correzione |
| GET | `/api/review/fragile` | parole sbagliate due volte o più, dalla più fragile, con `total` |
| POST | `/api/review/fragile/:cardId` | «riprova oggi»: riporta la carta in coda senza toccare il calendario |
| GET | `/api/dialogues` | elenco dei dialoghi con lo stato di avanzamento |
| GET | `/api/dialogues/:slug` | copione pubblico, senza le battute non ancora recitate |
| POST | `/api/dialogues/:slug/answer` | risposta alla battuta corrente |
| POST | `/api/dialogues/:slug/restart` | riparte da capo, azzerando il progresso del dialogo |
| GET | `/api/writing` | consegne del quaderno, con lo stato di sblocco e l'ultima prova: senza modello |
| POST | `/api/writing/:promptId` | confronta il testo con il modello: `verdict`, parole mancanti, modello e nota |
| GET | `/api/mistakes` | banca degli errori: esercizi sbagliati (senza soluzione), lezione di origine, `wrongCount` |
| POST | `/api/mistakes/:exerciseId` | rifà un esercizio della banca: correzione, `wrongCount` (`null` = uscito), conteggi |

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
tardi, e il giudizio dato decide di quanto. Dopo due ripassi andati bene la
parola smette di farsi solo leggere e chiede di essere scritta: lo studente vede
l'italiano, compone il coreano con la tastiera di jamo e la correzione è del
server (`compact` + unificazione dei jamo, quindi NFD e NFC valgono uguale).
Scriverla bene vale un "facile"; sbagliarla azzera i ripassi e la parola torna
da leggere, che è il passo giusto da cui ricominciare. Jamo sciolti e frasi
restano sempre da leggere: una frase non si scrive a memoria.

Il primo corso, `hangul`, copre l'alfabeto in otto lezioni: vocali e consonanti
di base, consonanti aspirate e tese, vocali composte, 받침, regole di lettura e
lettura di insegne e menu.

Il secondo, `grammatica`, porta dalle lettere alle prime frasi: copula
이에요/예요, particelle 은/는 e 이/가, presente cortese -아요/-어요, poi 을/를, 에
ed 에서. Il terzo, `lessico`, mette le parole dentro frasi usabili: famiglia,
presentazioni (nome, età, provenienza), cibo e bevande, numeri sino-coreani e
prezzi in won. Il quarto, `messaggi`, è il corso della scrittura di ogni giorno:
saluti in chat, i due registri (해요체 e 반말), una conversazione completa da
leggere, appuntamenti con 오늘/내일/몇 시 e una lezione finale che rimette tutto
insieme. È lì che si impara quando dare del tu e quando no.

Il quinto, `a2`, alza il livello: passato in -았어요/-었어요, futuro in -(으)ㄹ
거예요, forma di rispetto 높임말 (-(으)시-, 께서, 드시다/계시다) e frasi legate con
-고, -지만 e -아서/어서. Il sesto, `b1`, è fatto solo di testi da leggere:
l'annuncio di una stanza, il menu con le note in fondo, il messaggio di servizio
in ufficio, una notizia breve. Ogni lezione porta il brano in coreano con il
glossario delle parole difficili, e sotto gli esercizi di comprensione; la
traduzione italiana del brano arriva solo quando la lezione risulta chiusa.

La prima lezione di ogni corso è sempre aperta, così chi ha già basi può entrare
da lì; le successive seguono l'ordine del corso.

In tutto: sei corsi, 29 lezioni, 228 voci di lessico, otto brani di lettura, otto
dialoghi e dodici consegne di scrittura. Il dizionario consultabile arriva a 255
voci perché comprende anche le parole dei gloss, che sono quelle che si
incontrano leggendo.

## Il piano della settimana

Sopra ai corsi, la home mostra il piano di oggi: tre cose al massimo, ordinate
per urgenza. Prima la lezione che apre il percorso, poi le parole in scadenza,
poi il quaderno; la conversazione prende il posto che resta quando la giornata è
leggera, cioè quando c'è al massimo un altro compito. Sotto, una riga dice come
sta andando la settimana.

- Il **quaderno** compare quando c'è almeno una consegna aperta e non ancora
  scritta, e sparisce appena si scrive un testo: una consegna al giorno basta, e
  non ha senso chiedere due volte la stessa cosa nella stessa giornata. La
  consegna si apre quando la lezione che insegna quelle parole è passata o
  saltata, quindi anche un corso saltato la fa entrare nel piano.
- L'**obiettivo** sono i giorni di studio da chiudere fra lunedì e domenica. Lo
  sceglie lo studente nella pagina dei progressi, da 1 a 7; il server non lo
  impone e non lo cambia da sé.
- Un giorno conta quando si fa almeno un esercizio, un ripasso **o** un testo nel
  quaderno: chi passa la giornata solo sulle parole in scadenza, o solo a
  scrivere, ha studiato, e lo streak non si rompe.
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
- Con il corso `messaggi` sono arrivati due dialoghi nuovi: una chat per
  organizzare lo studio (`chat-serale`) e un invito a cena in 반말
  (`invito-cena`), entrambi legati alle lezioni di quel corso.
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

## Quaderno

Gli esercizi chiedono di riconoscere; il quaderno chiede di produrre. Ogni
consegna è un compito breve in italiano («Scrivi "Sono uno studente."») e la
risposta è una frase in coreano che scrivi tu, con la tastiera o incollando.

Una frase libera non si corregge con una regola, e qui non c'è nessuna AI: il
patto è un altro, ed è dichiarato allo studente.

- **Il modello arriva dopo l'invio.** `GET /api/writing` non contiene `model`,
  `must` né `notes`: prima si scrive, poi si guarda. Diversamente sarebbe
  dettato.
- La risposta porta un verdetto, non un voto: `model` (la frase è quella),
  `close` (le parole ci sono, la forma no: somiglianza ≥ 0,6) e `far` (manca
  qualcosa o è un'altra frase). Con il verdetto arrivano le **parole mancanti**
  e una nota di grammatica sul punto che quella consegna insegna.
- Il confronto è mostrato affiancato — il tuo testo e il modello — perché la
  differenza è il materiale di studio.
- Le consegne sono dodici, due per corso, in
  `packages/curriculum/data/writing.json`. Ognuna cita la lezione che insegna
  quelle parole e si apre quando quella lezione è superata o saltata.
- Il contenuto è validato da `npm run content:check`: il modello deve contenere
  Hangul, ogni parola obbligatoria deve comparire nel modello, e le varianti non
  possono ripetersi a meno di spazi e punteggiatura. Una consegna impossibile
  non arriva in produzione.
- Ogni invio si salva in `writing_entries` e conta come giornata di studio
  (`daily_stats.writing`), perché una serata passata a scrivere è studio come
  una serie di ripassi.

## Errori

Il ripasso SRS lavora sulle parole; nessuna delle altre pagine guarda a quello
che **questo** studente ha sbagliato. La banca degli errori lo fa: ogni risposta
sbagliata in una lezione entra in `exercise_mistakes`, e resta lì finché non la
si azzecca.

- Si popola da sola: `recordAttempt` aggiorna la banca dentro la stessa
  transazione che registra il tentativo, quindi una lezione promossa e la sua
  banca non possono raccontare cose diverse.
- Il conto per esercizio (`wrong_count`) distingue la distrazione dall' errore
  vero: la pagina scrive «sbagliato tre volte» e non finge che sia la prima.
- Azzeccarlo lo toglie dalla banca; sbagliarlo di nuovo alza il conto. Non c'è
  voto e non si sblocca nulla: è manutenzione, non un esame.
- Il **test di salto** non entra in banca, né quello della lezione né quello del
  corso: è una prova di posizionamento, e chi salta di proposito non deve
  ritrovarsi dodici esercizi da rifare come punizione.
- Gli esercizi si ricostruiscono dal curricolo con `findExercise(id)` — gli id
  sono unici in tutto il curricolo — e tornano al client **senza soluzione**,
  come in lezione: la correzione avviene sul server con la stessa
  `gradeExercise`.
- Rifare un errore conta fra gli esercizi del giorno (`daily_stats.exercises`),
  così la banca non è tempo sottratto all'abitudine.
- La barra in alto mostra quanti esercizi aspettano, e la home lo dice con un
  link: una banca piena che nessuno vede è una banca che non serve.

## Parole fragili

Il calendario SRS ha un difetto che si vede solo dopo qualche settimana: una
parola sbagliata due volte torna il giorno dopo, ma se la si sbaglia ancora il
passo successivo può essere di una settimana. La pagina dei ripassi tiene quindi
un elenco a parte, delle parole che **hanno già ceduto almeno due volte**
(`lapses >= 2`), e permette di riprenderle oggi.

- L'elenco è ordinato dalla più fragile (più errori, poi scadenza più vicina) e
  mostra il coreano con il significato e la romanizzazione: qui non si indovina,
  si riconosce. La correzione, quando la carta torna in coda, è la solita.
- «Riprova oggi» sposta solo la scadenza a oggi (`due_at = today`): non tocca
  `ease`, `interval_days` né `lapses`. Se la parola si sa, il ripasso la rimanda
  come qualsiasi altra; se non si sa, il lapse sale e resta nell'elenco.
- Ripassarla bene non cancella gli errori passati, perché il conto dice quanto
  quella parola è costata, non se l'ultima volta è andata bene.
- Compare sotto la coda quando non c'è più niente in scadenza (o quando la coda
  è finita): è lì che lo studente ha tempo per una parola che non è ancora
  scaduta.
