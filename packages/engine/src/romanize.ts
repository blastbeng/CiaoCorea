/**
 * Romanizzazione coreana secondo la Revised Romanization (RR), quella usata
 * dal governo coreano e quindi quella che gli studenti trovano sui dizionari,
 * sui cartelli e nelle translitterazioni dei nomi.
 *
 * Si lavora sugli indici della sillaba, non sui caratteri jamo: un blocco
 * Hangul (가-힣) è per definizione L·V·28 + V·28 + T, con 19 iniziali, 21
 * vocali e 28 finali. Gli indici qui sotto sono verificati sulla
 * decomposizione Unicode (vedi `romanize.test.ts`), perché il blocco dei jamo
 * intercala tre lettere legacy e i loro buchi non cadono dove ci si aspetta.
 *
 * La RR trascrive la *scrittura*, non la pronuncia: 국민 è `gukmin` anche se
 * si legge [궁민]. La pronuncia è un'altra cosa, e l'app la dà a parte: audio e
 * scheda della parola.
 */

/** Iniziale per indice: le cinque consonanti tensive (ㄲ ㄸ ㅃ ㅆ ㅉ) hanno il
 * loro indice, e non sono le lettere legacy — quelle stanno altrove e non
 * compaiono in nessuna sillaba reale. */
const LEAD: (string | undefined)[] = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj',
  'ch', 'k', 't', 'p', 'h',
];

/** Vocale per indice, nell'ordine Unicode. */
const MEDIAL: string[] = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo',
  'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];

/** Finale per indice (0 = nessuna finale), nell'ordine Unicode. */
const FINAL: string[] = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'lk', 'lm', 'lp', 'lt', 'lt',
  'lp', 'lp', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't',
];

const CHO = 588; // 21 vocali × 28 finali: il blocco di ogni iniziale
const BASE = 0xac00;
const LAST = 0xd7a3;

/** True se il carattere è una sillaba Hangul precomposta. */
export function isHangulSyllable(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= BASE && code <= LAST;
}

/** I tre indici di una sillaba, o null se non è una sillaba Hangul. */
function syllableIndex(char: string): { lead: number; medial: number; final: number } | null {
  const code = char.charCodeAt(0);
  if (code < BASE || code > LAST) return null;
  const index = code - BASE;
  return {
    lead: Math.floor(index / CHO),
    medial: Math.floor((index % CHO) / 28),
    final: index % 28,
  };
}

/**
 * Romanizza una sola sillaba. Ciò che non è Hangul torna com'è: cifre,
 * punteggiatura, prestiti in lettere latine restano come stanno nel testo.
 */
export function romanizeSyllable(char: string): string {
  const parts = syllableIndex(char);
  if (!parts) return char;

  const lead = LEAD[parts.lead];
  const medial = MEDIAL[parts.medial];
  // Un indice legacy non è una sillaba reale: meglio restituirla com'è che
  // inventare una romanizzazione che nessun dizionario mostra.
  if (lead === undefined || medial === undefined) return char;

  return lead + medial + FINAL[parts.final];
}

/** Romanizza una sequenza di sillabe (una parola, senza spazi). */
export function romanizeWord(word: string): string {
  return Array.from(word).map(romanizeSyllable).join('');
}

/**
 * Le forme che si accettano per una parola: quella canonica e, dopo una
 * consonante scritta, quella senza la `y` delle vocali che cominciano per y
 * (류 → `ryu` o `nu`, 결 → `gyeol` o `geol`). La RR scrive la `y`, ma molti
 * dizionari la lasciano cadere dopo una consonante: chiamarne una delle due
 * un errore vorrebbe dire correggere romanizzazioni corrette.
 */
export function romanizationVariants(word: string): Set<string> {
  const senzaY = Array.from(word)
    .map((char) => {
      const parts = syllableIndex(char);
      if (!parts) return romanizeSyllable(char);
      const lead = LEAD[parts.lead];
      const medial = MEDIAL[parts.medial];
      if (lead === undefined || medial === undefined) return romanizeSyllable(char);
      // Solo dopo una consonante: con l'iniziale muta la y serve (유 = yu).
      const vowel = lead !== '' && medial.startsWith('y') ? medial.slice(1) : medial;
      return lead + vowel + FINAL[parts.final];
    })
    .join('');

  const normalize = (value: string) => value.toLowerCase().replace(/[-·]/g, '');
  return new Set([romanizeWord(word), senzaY].map(normalize));
}

/**
 * Romanizza un testo tenendo gli spazi dove erano: una riga di dizionario
 * («할머니가 보고 싶어요») esce separata («halmeoniga bogo sipeoyo»), non come
 * una parola sola.
 */
export function romanizeText(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => (token.trim() === '' ? token : romanizeWord(token)))
    .join('');
}

/**
 * Confronta una romanizzazione con quelle ammissibili, tollerando ciò che non
 * è un errore: maiuscole, il trattino che la RR mette fra due sillabe quando la
 * seconda comincia per ㅏ o ㅓ dopo una vocale («sa-o»), e la `y` dopo una
 * consonante. La tolleranza sta nel confronto, non nella generazione: la forma
 * canonica resta quella che l'app dovrebbe scrivere.
 */
export function romanizationMatches(ko: string, rr: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[-·]/g, '');
  return romanizationVariants(ko).has(normalize(rr));
}
