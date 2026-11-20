# CiaoCorea – Impara il Coreano

Portale web per imparare il coreano da autodidatta, pensato per chi parla
italiano. Si lavora su lettura e scrittura: jamo, sillabe, 받침, lessico,
comprensione. Il percorso è a tappe, con esercizi corretti nel browser e la
possibilità di saltare una lezione già conosciuta superando un test.

L'app è **completamente statica**: nessun server, nessun account remoto. Gira su
GitHub Pages e salva tutto nel browser dello studente (un database SQLite
compilato in WebAssembly, tenuto in IndexedDB). Il computer che apre il sito
tiene i propri dati: niente registrazione, niente email, niente password — né da
creare, né da ricordare, né da recuperare.

Oltre al percorso ci sono cinque stanze: il **dizionario** di tutte le parole
del curricolo, la **coda di ripasso** (SRS) che dopo due passaggi chiede di
scrivere la parola, il **quaderno** dove si scrivono
frasi proprie confrontandole con un modello, la **banca degli errori** con gli
esercizi sbagliati da rifare, e la pagina dei **progressi**, con le statistiche
complessive e il nome con cui essere chiamati. In cima alla home c'è il **piano
di oggi**: le poche cose da fare, in ordine, sopra all'obiettivo della settimana
che si sceglie lo studente.

Il portale è **multi-profilo sullo stesso browser, senza login**: al primo
avvio nasce da solo un profilo con un nome generato (stile Reddit,
`VeloceTigre42`) e si entra subito dentro; alla visite successive il sito
riprende l'ultimo profilo usato. La pagina dei profili (`/profili`) elenca chi
studia su questo dispositivo, permette di passare da uno all'altro con un clic e
di aggiungerne di nuovi. Nome e nome utente sono la stessa cosa: quello che leggi
in home è anche quello con la chiocciola nell'elenco dei profili. Finché il nome è
quello generato, accanto ad esso in alto resta il promemoria *cambia qui il tuo
username*: cliccando il nome si apre il proprio profilo (`/profilo`), dove un
unico campo permette di sceglierne uno proprio. Non c'è invito da
chiedere e non c'è nulla da confermare: il profilo esiste dal suo primo respiro,
e resta finché non cancelli i dati del sito. Chi aveva già un profilo della vecchia versione (quella
con email e password) se lo ritrova intatto, con il nome ricavato dall'indirizzo:
progressi, ripassi e tentativi non si perdono nel passaggio.

## Cosa si incontra

| Pagina | Cosa c'è |
| --- | --- |
| `/` Percorso | il piano di oggi (lezione, ripassi, quaderno, dialogo), la parola del giorno, corsi, avanzamento |
| `/corso/:slug` | unità e lezioni con lo stato di ciascuna, e la prova per saltare il corso |
| `/corso/:slug/salta` | la prova che chiude un corso intero, per chi lo conosce già |
| `/corso/:slug/lezione/:lessonId` | teoria, brani di lettura, lessico, esercizi, test di salto |
| `/dialoghi` e `/dialoghi/:slug` | conversazione scritta a copione |
| `/dizionario` | ricerca nelle parole del curricolo, con filtri per corso |
| `/quaderno` | dodici consegne di scrittura: si scrive la frase, poi si confronta con il modello |
| `/ripassi` | carte in scadenza, giudizio `ho saputo / quasi / non ricordo`; sotto, le parole fragili da riprovare subito |
| `/errori` | gli esercizi che hai sbagliato, uno alla volta: azzeccarli li toglie dalla banca |
| `/progressi` | totali, per corso, parole SRS, obiettivo della settimana, ritmo dei giorni |
| `/profilo` | il proprio profilo: l'unico nome dello studente, con la sezione per cambiarlo |
| `/profili` | i profili di questo browser: si sceglie chi sta studiando con un clic, o se ne aggiunge uno nuovo |
| `/about` | chi ha fatto il portale (`Fabio Valentino`), perché esiste e dove restano i dati |

## Come è fatto

Monorepo npm workspaces, nessun servizio esterno e nessuna dipendenza da AI.

| Percorso | Contenuto |
| --- | --- |
| `apps/web` | React 18 + Vite, router (`HashRouter`), pagine, tema |
| `packages/store` | il «server» dentro il browser: SQLite via `sql.js`, repo, rotte, sessioni |
| `packages/shared` | Tipi condivisi fra store e UI |
| `packages/curriculum` | Schema zod e contenuti dei corsi (JSON) |
| `packages/engine` | Correzione esercizi, sblocco lezioni, ripasso SRS, piano |

Scelte che vale la pena ricordare:

- **Le soluzioni non arrivano all'interfaccia prima del tempo.** Le rotte
  interne restituiscono esercizi senza `answer`, e consegnano la traduzione dei
  brani solo quando la lezione è superata o saltata: la correzione è un passaggio
  separato, quindi il testo si affronta da soli. (Chi apre i DevTools ha in mano
  il proprio database: il patto è didattico, non crittografico.)
- **Database SQLite nel browser** (`sql.js`, il motore compilato in WebAssembly)
  serializzato in IndexedDB, con salvataggio ritardato di 400 ms e immediato
  quando la pagina si nasconde. Nessun dato esce dal dispositivo: il backup è
  scaricare i byte, la migrazione è copiarli su un altro browser.
- **Un solo codice per due mondi.** `packages/store` riproduce la superficie di
  Fastify che le rotte usavano (`request`, `reply`, `setCookie`, `preHandler`) e
  le rotte sono le stesse di prima: la logica non è stata riscritta per il
  browser, è stata spostata.
- **Sessioni in `localStorage`.** Il token di sessione vive lì
  (`ciaocorea.sessions.v1`), non in un cookie; è quello che rende possibile
  passare da un profilo all'altro con un clic e senza un server che ricordi
  chi sei. Se il token è scaduto o `localStorage` è stato svuotato, il profilo
  si riapre lo stesso (`/api/auth/reactivate`): i progressi nel database sono
  tutta l'autorità che serve, non c'è una password da mostrare.
- **Niente password, per scelta.** In un database locale una password non
  protegge nulla: chi ha il browser ha già i dati. Il portale quindi non la
  chiede: il primo avvio genera un nome stile Reddit (`VeloceTigre42`, aggettivo
  + animale + numero, in italiano) e da lì si studia.
- **Il piano della giornata lo calcola `packages/engine/src/plan.ts`** dentro il
  browser: prima la lezione che apre il percorso, poi le parole in scadenza, poi
  il quaderno, e la conversazione prende il posto che resta quando la giornata è
  leggera. La settimana parte di lunedì e un giorno di studio conta anche solo per
  i ripassi.
- **Contenuti in JSON tipizzato**, validati da `npm run content:check`: un
  errore di scrittura (risposta non fra le opzioni, id duplicato) blocca la
  build del contenuto, non lo studente.

## Sviluppo

Serve Node 22.5 o successivo. **Nessun file `.env`, nessun servizio da avviare.**

```bash
NODE_ENV=development npm install  # senza, NODE_ENV=production omette le devDeps
npm run dev                       # Vite su http://localhost:5173/
```

Comandi utili:

```bash
npm test              # unit + integrazione dello store, in memoria
npm run typecheck     # tutti i pacchetti, client compreso
npm run content:check # validazione dei corsi
npm run build         # sito statico in apps/web/dist
npm run preview       # anteprima del build, su http://localhost:4173/
```

I test di `packages/store` aprono il database in memoria: girano senza browser e
senza IndexedDB, e coprono l'apertura del sito (primo profilo generato,
riprese, rinomina, riapertura di sessioni scadute), il multi-profilo, lo
sblocco lezioni, i ripassi, il quaderno, i dialoghi, gli errori e il giro
completo di salvataggio/riapertura.

### Cosa c'è nel browser

- `IndexedDB` contiene i byte del database (database `ciaocorea`, archivio
  `database`, chiave `sqlite`), riscritti in modo ritardato mentre si studia
  (400 ms) e subito quando la scheda si nasconde.
- `localStorage` contiene le sessioni (`ciaocorea.sessions.v1`): un token per
  profilo più quello attivo. È per questo che il cambio profilo è istantaneo.
- Svuotare i dati del sito cancella profili e progressi. Non c'è copia altrove:
  è il prezzo (e il vantaggio) di un'app senza server.

## Sincronizzare i dispositivi

Il database vive nel browser, quindi un profilo non segue lo studente da solo.
Ci sono due strade, e nessuna passa da un server:

- **Il file** (`/sincronizza`): un JSON con il profilo aperto o con tutti quelli
  del browser. Contiene tutto — lezioni, tentativi, ripassi, quaderno, errori.
- **Il codice veloce**: lezioni, ripassi e giorni di studio compressi in una
  riga (`CC1z…`) e in un QR statico. Tentativi, quaderno ed errori restano a
  casa: per quelli c'è il file.

L'importazione fonde, non sovrascrive. Una lezione promossa non torna indietro,
il punteggio più alto vince, i tentativi non si sommano (sarebbero contati due
volte) e i contatori giornalieri prendono il massimo. Chi vuole il profilo
identico al file sceglie «sostituisci». Prima di ogni importazione i byte di
prima finiscono in uno snapshot in IndexedDB, e «torna com'era prima» li rimette
al loro posto.

La banca degli errori ha una tabella di segnaposto (`sync_tombstones`): un
errore corretto dopo la data del backup non rientra in banca all'importazione.
Lo stesso orologio serve al nome del profilo (`users.updated_at`).

Limite del QR: un QR statico tiene circa 1.800 caratteri di codice compresso.
Oltre, la pagina lo dice: resta il codice da copiare, oppure il file.

## Deploy

Il sito è pubblicato da GitHub Pages con
`.github/workflows/deploy-pages.yml`: ogni push su `main` installa le
dipendenze, esegue `typecheck` e test, compila `apps/web/dist` e lo pubblica.

- URL: <https://ciaocorea.fabiovalentino.it/> (custom domain delle Pages);
  <https://blastbeng.github.io/CiaoCorea/> risponde con un redirect lì.
- Sorgente Pages: **GitHub Actions** (non il branch `gh-pages`).
- La base di Vite è `./` e il router è `HashRouter`: gli asset si risolvono
  rispetto al documento, quindi la stessa build vive sia sulla radice del
  dominio sia sotto `/CiaoCorea/`, e nessun rewrite lato server è necessario.
  Con una base assoluta una delle due copie resta senza CSS, cioè pagina vuota.
- Nessun analytics, nessun cookie, nessuna chiamata di rete dopo il caricamento
  degli asset: l'unica cosa che si salva è nel browser.

## Rotte interne

Non c'è più un'API di rete: `packages/store` espone le stesse rotte di prima a
un mini-router che le chiama in processo. Restano utili come mappa di cosa fa lo
store dentro la scheda. Richiedono la sessione tutte tranne `bootstrap`,
`profiles`, `reactivate`, `session` e `accounts`.

| Metodo | Rotta | Uso |
| --- | --- | --- |
| POST | `/api/auth/bootstrap` | apre il sito: riprende il profilo attivo o ne genera uno nuovo |
| POST | `/api/auth/profiles` | un profilo in più su questo browser, e diventa quello aperto |
| POST | `/api/auth/reactivate` | riapre un profilo la cui sessione è scaduta |
| GET | `/api/auth/session` | utente corrente o `null` |
| GET | `/api/auth/accounts` | i profili presenti in questo browser, per la schermata di scelta |
| GET | `/api/courses` | corsi, progressi, riepilogo, ripassi dovuti, piano di oggi (`plan`) |
| GET | `/api/vocabulary` | dizionario: `q` (coreano/romanizzazione/italiano), `course`, `limit`, `offset` |
| GET | `/api/profile` | progressi, totali, giorni attivi (con i ripassi), SRS, dialoghi, `weeklyGoal` |
| POST | `/api/profile/goal` | obiettivo settimanale: da 1 a 7 giorni di studio |
| POST | `/api/auth/username` | l'unico nome del profilo (nome e `@nome` insieme): unico su questo browser, 400 se non valido, 409 se è già di un altro profilo |
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
| GET | `/api/sync/export` | il profilo aperto (`scope=profile`) o tutti i profili (`scope=all`) in un file JSON |
| GET | `/api/sync/code` | il codice veloce: lezioni, ripassi e giorni di studio, compressi in una riga |
| POST | `/api/sync/preview` | cosa cambierebbe un file: esegue davvero il merge e torna indietro |
| POST | `/api/sync/import` | applica un file (`strategy: merge \| replace`) e apre il profilo se è uno solo |

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
l'italiano, compone il coreano con la tastiera di jamo e la correzione usa la
stessa `compact` + unificazione dei jamo, quindi NFD e NFC valgono uguale.
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
insieme. È lì che si impara quando dare del tu e quando no. Il corso `lessico` si
è aperto con una unità nuova, *Muoversi in città*: mezzo con 로/으로 (버스로,
지하철로), tragitto con 에서 …까지, fermate e linee (정거장, 호선) e il pagamento
con 교통카드.

Il quinto, `a2`, alza il livello: passato in -았어요/-었어요, futuro in -(으)ㄹ
거예요, forma di rispetto 높임말 (-(으)시-, 께서, 드시다/계시다) e frasi legate con
-고, -지만 e -아서/어서. Il sesto, `b1`, è fatto solo di testi da leggere:
l'annuncio di una stanza, il menu con le note in fondo, il messaggio di servizio
in ufficio, una notizia breve. Ogni lezione porta il brano in coreano con il
glossario delle parole difficili, e sotto gli esercizi di comprensione; la
traduzione italiana del brano arriva solo quando la lezione risulta chiusa.

La prima lezione di ogni corso è sempre aperta, così chi ha già basi può entrare
da lì; le successive seguono l'ordine del corso.

In tutto: sei corsi, 42 lezioni, 508 voci di lessico, 18 brani di lettura, 12
dialoghi e 18 consegne di scrittura. Il dizionario consultabile arriva a 552
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
  sceglie lo studente nella pagina dei progressi, da 1 a 7; l'app non lo
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
Hangul con la tastiera su schermo: la stessa `gradeExercise` degli esercizi
accetta le varianti previste.

- Il coreano delle battute ancora da recitare non arriva alla pagina: si vede
  la consegna in italiano, e la battuta compare solo dopo la risposta.
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
  come in lezione: la correzione passa dalla stessa `gradeExercise`.
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
