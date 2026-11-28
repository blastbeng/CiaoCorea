/**
 * La mappa del sito in un posto solo: la barra in alto, il menu del telefono e
 * la pagina d'ingresso leggono tutti da qui. Diciannove voci in fila non
 * dicono niente a chi arriva; cinque gruppi con un nome e una riga di
 * spiegazione sì. Se una pagina nuova non trova posto in un gruppo, il posto
 * non c'è: prima si decide dove sta, poi si aggiunge.
 */

export interface NavItem {
  to: string;
  label: string;
  /** Una riga che dice cosa ci si fa: è quella che salva chi non sa da dove partire. */
  hint: string;
  /** Il conto da mostrare accanto alla voce: ripassi in scadenza o errori da rifare. */
  badge?: 'due' | 'mistakes';
}

export type NavEntry =
  | { kind: 'link'; id: string; label: string; hint: string; to: string }
  | { kind: 'group'; id: string; label: string; hint: string; items: NavItem[] };

export const NAV: NavEntry[] = [
  {
    kind: 'link',
    id: 'percorso',
    label: 'Percorso',
    to: '/',
    hint: 'Il piano di oggi e i corsi',
  },
  {
    kind: 'group',
    id: 'imparare',
    label: 'Imparare',
    hint: 'Le lettere, i dialoghi, i testi da leggere',
    items: [
      {
        to: '/alfabeto',
        label: 'Alfabeto',
        hint: 'Le lettere coreane, una per una',
      },
      {
        to: '/dialoghi',
        label: 'Conversazione',
        hint: 'Dialoghi a copione: rispondi tu',
      },
      {
        to: '/letture',
        label: 'Letture',
        hint: 'Brani del percorso, da leggere con calma',
      },
      {
        to: '/numeri',
        label: 'Numeri',
        hint: 'Le due serie e come si usano',
      },
      {
        to: '/repertorio',
        label: 'Grammatica',
        hint: 'Tutte le regole spiegate, in indice',
      },
      {
        to: '/quaderno',
        label: 'Quaderno',
        hint: 'Scrivi tu: consegne e modello da confrontare',
      },
    ],
  },
  {
    kind: 'group',
    id: 'esercizi',
    label: 'Esercizi',
    hint: 'Ripetere, mettersi alla prova, rifare gli errori',
    items: [
      {
        to: '/palestra',
        label: 'Palestra',
        hint: 'Esercizi infiniti su una regola',
      },
      {
        to: '/sfida',
        label: 'Sfida del giorno',
        hint: 'Dodici domande miste dalle lezioni chiuse',
      },
      {
        to: '/traguardo',
        label: 'Traguardo',
        hint: 'La prova di fine livello',
      },
      {
        to: '/ripassi',
        label: 'Ripassi',
        hint: 'Le parole che tornano al momento giusto',
        badge: 'due',
      },
      {
        to: '/errori',
        label: 'Errori',
        hint: 'Quello che hai sbagliato, da rifare',
        badge: 'mistakes',
      },
    ],
  },
  {
    kind: 'group',
    id: 'strumenti',
    label: 'Strumenti',
    hint: 'Per quando una parola o una forma non torna',
    items: [
      {
        to: '/dizionario',
        label: 'Dizionario',
        hint: 'Le parole del percorso, cercabili',
      },
      {
        to: '/coniuga',
        label: 'Coniuga',
        hint: 'Un verbo, tutte le sue forme',
      },
      {
        to: '/analisi',
        label: 'Analisi',
        hint: 'Incolla un testo e tocca le parole',
      },
      {
        to: '/pronuncia',
        label: 'Pronuncia',
        hint: 'Come una parola si legge davvero',
      },
      {
        to: '/scrittura',
        label: 'Scrivere a mano',
        hint: 'Traccia le lettere con dito o mouse',
      },
      {
        to: '/tastiera',
        label: 'Tastiera coreana',
        hint: 'La tastiera dei coreani, tasto per tasto',
      },
    ],
  },
  {
    kind: 'link',
    id: 'progressi',
    label: 'Progressi',
    to: '/progressi',
    hint: 'Dove sei, cosa hai fatto',
  },
];

/** Le pagine che non stanno nella barra: sono del profilo, non dello studio. */
export const ACCOUNT_LINKS: NavItem[] = [
  { to: '/profilo', label: 'Il tuo profilo', hint: 'Il nome con cui ti chiamiamo' },
  { to: '/profili', label: 'Cambia profilo', hint: 'Un altro studente su questo browser' },
  {
    to: '/sincronizza',
    label: 'Sincronizza',
    hint: 'Salva una copia o portala su un altro dispositivo',
  },
];
