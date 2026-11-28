/**
 * La mappa del sito in un posto solo: la barra in alto, il cassetto del
 * telefono e la pagina d'ingresso leggono tutti da qui.
 *
 * È un albero, non un elenco: ogni voce può portare a una pagina (`to`) o
 * aprirne altre (`children`), e i livelli sono quanti servono. La barra mostra
 * i primi cinque rami; il resto si apre sotto, un livello alla volta, così chi
 * arriva non vede diciannove nomi in fila ma cinque stanze con le loro porte.
 */

export interface NavEntry {
  /** Stabile: serve a ricordare quale ramo è aperto. */
  id: string;
  label: string;
  /** Una riga che dice a cosa serve: è quella che salva chi non sa da dove partire. */
  hint?: string;
  /** La pagina. Se manca, la voce apre soltanto il suo sottomenù. */
  to?: string;
  children?: NavEntry[];
  /** Il conto da mostrare accanto alla voce: ripassi in scadenza o errori da rifare. */
  badge?: 'due' | 'mistakes';
  /** Pannello appeso a destra: per i rami vicini al bordo dello schermo. */
  align?: 'right';
}

export const NAV: NavEntry[] = [
  {
    id: 'percorso',
    label: 'Percorso',
    to: '/',
    hint: 'Il piano di oggi e i tuoi corsi',
  },
  {
    id: 'studio',
    label: 'Studio',
    hint: 'Le lettere, i testi, la scrittura',
    children: [
      {
        id: 'fondamenti',
        label: 'Fondamenti',
        hint: 'Da dove si comincia',
        children: [
          { id: 'alfabeto', label: 'Alfabeto', to: '/alfabeto', hint: 'Le lettere coreane, una per una' },
          { id: 'pronuncia', label: 'Pronuncia', to: '/pronuncia', hint: 'Come una parola si legge davvero' },
          { id: 'numeri', label: 'Numeri', to: '/numeri', hint: 'Le due serie e come si usano' },
        ],
      },
      {
        id: 'testi',
        label: 'Letture e dialoghi',
        hint: 'Il coreano scritto e parlato',
        children: [
          { id: 'letture', label: 'Letture', to: '/letture', hint: 'Brani del percorso, da leggere con calma' },
          { id: 'conversazione', label: 'Conversazione', to: '/dialoghi', hint: 'Dialoghi a copione: rispondi tu' },
        ],
      },
      {
        id: 'scrittura',
        label: 'Scrivere',
        hint: 'Con la mano, con la tastiera, di testa tua',
        children: [
          { id: 'a-mano', label: 'Scrivere a mano', to: '/scrittura', hint: 'Traccia le lettere con dito o mouse' },
          { id: 'tastiera', label: 'Tastiera coreana', to: '/tastiera', hint: 'La tastiera dei coreani, tasto per tasto' },
          { id: 'quaderno', label: 'Quaderno', to: '/quaderno', hint: 'Scrivi tu: consegne e modello da confrontare' },
        ],
      },
    ],
  },
  {
    id: 'esercizi',
    label: 'Esercizi',
    hint: 'Ripetere, mettersi alla prova, rifare gli errori',
    children: [
      { id: 'palestra', label: 'Palestra', to: '/palestra', hint: 'Esercizi infiniti su una regola' },
      { id: 'sfida', label: 'Sfida del giorno', to: '/sfida', hint: 'Dodici domande miste dalle lezioni chiuse' },
      { id: 'traguardo', label: 'Traguardo', to: '/traguardo', hint: 'La prova di fine livello' },
      {
        id: 'ripasso',
        label: 'Ripasso',
        hint: 'Quello che torna indietro',
        children: [
          {
            id: 'ripassi',
            label: 'Ripassi',
            to: '/ripassi',
            hint: 'Le parole che tornano al momento giusto',
            badge: 'due',
          },
          { id: 'errori', label: 'Errori', to: '/errori', hint: 'Quello che hai sbagliato, da rifare', badge: 'mistakes' },
        ],
      },
    ],
  },
  {
    id: 'strumenti',
    label: 'Strumenti',
    align: 'right',
    hint: 'Per quando una parola o una forma non torna',
    children: [
      { id: 'dizionario', label: 'Dizionario', to: '/dizionario', hint: 'Le parole del percorso, cercabili' },
      { id: 'grammatica', label: 'Grammatica', to: '/repertorio', hint: 'Tutte le regole spiegate, in indice' },
      { id: 'coniuga', label: 'Coniuga', to: '/coniuga', hint: 'Un verbo, tutte le sue forme' },
      { id: 'analisi', label: 'Analisi', to: '/analisi', hint: 'Incolla un testo e tocca le parole' },
    ],
  },
  {
    id: 'profilo',
    label: 'Profilo',
    align: 'right',
    hint: 'Chi sei qui dentro, e dove sei arrivato',
    children: [
      { id: 'il-profilo', label: 'Il tuo profilo', to: '/profilo', hint: 'Il nome con cui ti chiamiamo' },
      { id: 'progressi', label: 'I tuoi progressi', to: '/progressi', hint: 'Dove sei, cosa hai fatto' },
      { id: 'profili', label: 'Cambia profilo', to: '/profili', hint: 'Un altro studente su questo browser' },
      {
        id: 'sincronizza',
        label: 'Sincronizza',
        to: '/sincronizza',
        hint: 'Salva una copia o portala su un altro dispositivo',
      },
      { id: 'chi-sono', label: 'Chi sono', to: '/about', hint: 'Il progetto e chi lo scrive' },
    ],
  },
];

/** Tutte le foglie, in ordine di lettura: serve alla mappa della home. */
export function navLeaves(entry: NavEntry): NavEntry[] {
  if (!entry.children) return entry.to ? [entry] : [];
  return entry.children.flatMap(navLeaves);
}
