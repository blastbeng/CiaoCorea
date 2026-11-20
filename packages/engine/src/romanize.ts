/**
 * Romanizzazione coreana secondo la Revised Romanization (RR), quella usata dal
 * governo coreano e quindi quella che gli studenti trovano sui dizionari, sui
 * cartelli e nelle translitterazioni dei nomi.
 *
 * Si lavora sugli indici della sillaba, non sui caratteri jamo: un blocco
 * Hangul (가-힣) è per definizione L·V·28 + V·28 + T, con 19 iniziali, 21
 * vocali e 28 finali. Gli indici qui sotto sono verificati sulla
 * decomposizione Unicode (vedi `romanize.test.ts`), perché il blocco dei jamo
 * intercala tre lettere legacy e i loro buchi non cadono dove ci si aspetta.
 *
 * Qui ci sono due forme, e conviene tenerle separate perché gli studenti le
 * confondono:
 *
 * - `romanizeWord` è la **trascrizione** meccanica sillaba per sillaba: finale
 *   dopo finale, senza spostare nulla. 국민 → `gukmin`, 없는 → `eopsneun`.
 * - la **RR della pronuncia standard** (국어의 로마자 표기법 제1항) è quella che
 *   il curricolo scrive nel campo `rr` e che lo studente legge: 국민 → `gungmin`,
 *   학교 → `hakgyo`, 없는 → `eomneun`. È stata verificata parola per parola e
 *   congelata in `data/reference/romanization.json`, che `npm run content:check`
 *   rimette a confronto.
 *
 * `pronunciationRomanize` ricostruisce la seconda in modo approssimato, con le
 * regole più solide (연음, 비음화, 유음화). Serve a *riconoscere* quello che lo
 * studente digita nella ricerca, non a insegnare come si legge: dove il
 * curricolo ha una voce, la sua `rr` è la forma autoritaria.
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
/** I tre indici di una sillaba: iniziale, vocale, finale. */
export interface SyllableParts {
  lead: number;
  medial: number;
  final: number;
}

function syllableIndex(char: string): SyllableParts | null {
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

/** Indici delle finali per famiglia: velari, labiali, nasali, laterali. */
const VELAR = new Set([1, 2, 9, 24]); // ㄱ ㄲ ㄺ ㅋ
const LABIAL = new Set([10, 11, 14, 15, 16, 17, 18, 26]); // ㄻ ㄼ ㄿ ㅀ ㅁ ㅂ ㅄ ㅍ
const ALVEOLAR_N = new Set([4, 5, 6]); // ㄴ ㄵ ㄶ

/**
 * Cosa diventa una finale quando la sillaba seguente inizia per vocale muta
 * (연음): passa lì e fra due vocali si addolcisce. Le finali che non passano
 * (ㅅ ㅆ ㅈ ㅊ ㅎ e i loro gruppi) restano come la scrittura le scrive.
 */
const CARRIED: Record<number, string> = {
  1: 'g', 2: 'g', 9: 'g', 24: 'g',
  7: 'd', 25: 'd',
  14: 'p', 15: 'p', 17: 'b', 18: 'b', 26: 'b',
  10: 'm', 16: 'm',
  4: 'n', 5: 'n', 6: 'n',
  8: 'r', 11: 'r', 12: 'l', 13: 'r',
  21: 'ng',
};

interface Junction {
  /** La finale della sillaba precedente, nella forma che prende qui. */
  coda: string;
  /** L'iniziale della sillaba seguente, quando quella scritta si sostituisce. */
  onset: string | null;
}

const SIL = {
  /** Iniziale muta: la sillaba comincia per vocale. */
  silent: 11,
  /** ㄴ. */
  n: 2,
  /** ㄹ. */
  r: 5,
  /** ㅁ. */
  m: 6,
} as const;

/** ㅟ: la ㅟ non si lascia trasportare (학위 resta `hagwi`, non `hagwi` con 연음). */
const WI = 16;

function junction(prev: SyllableParts, next: SyllableParts): Junction {
  const final = prev.final;
  if (final === 0) return { coda: '', onset: null };

  // 연음: la finale passa alla sillaba vuota e diventa l'iniziale di quella.
  if (next.lead === SIL.silent && next.medial !== WI) {
    // ㄷ e ㅌ davanti a 이, ㅣ e ㅟ diventano ㅊ (구개음화): 같이 [가치].
    if ((next.medial === WI || next.medial === 20) && (final === 7 || final === 25)) {
      return { coda: '', onset: 'ch' };
    }
    const carried = CARRIED[final];
    if (carried !== undefined) return { coda: '', onset: carried };
  }

  // 유음화: ㄴ davanti a ㄹ, e ㄹ davanti a ㄹ, diventano entrambe ㄹ.
  if (next.lead === SIL.r && (ALVEOLAR_N.has(final) || final === 8)) {
    return { coda: 'l', onset: 'l' };
  }

  // 비음화: davanti a ㄴ e a ㅁ le finali non nasali diventano nasale.
  if (next.lead === SIL.n || next.lead === SIL.m) {
    if (VELAR.has(final) || final === 21) return { coda: 'ng', onset: null };
    if (LABIAL.has(final)) return { coda: 'm', onset: null };
    if (ALVEOLAR_N.has(final)) return { coda: 'n', onset: null };
    return { coda: next.lead === SIL.n ? 'n' : 'm', onset: null };
  }

  return { coda: FINAL[final], onset: null };
}

/**
 * La romanizzazione *della pronuncia*: 연음, 비음화, 유음화 e 구개음화 delle
 * regole più stabili. 신라 → `silla`, 국민 → `gungmin`, 없는 → `eomneun`,
 * 발음 → `bareum`, 몰라 → `molla`.
 *
 * Serve a riconoscere, non a insegnare: è il confronto della ricerca, non un
 * dizionario. Le regole eccezionali (두음 법칙, 탈락 delle vocali, gruppi come ㅀ
 * in 싫다) non sono applicate: dove il curricolo ha una voce, la sua `rr`
 * verificata è la forma giusta.
 */
export function pronunciationRomanize(word: string): string {
  const chars = Array.from(word);
  const parts: (SyllableParts | null)[] = chars.map(syllableIndex);
  let out = '';

  for (let i = 0; i < parts.length; i += 1) {
    const current = parts[i];
    if (!current) {
      out += chars[i];
      continue;
    }
    const lead = LEAD[current.lead];
    const medial = MEDIAL[current.medial];
    if (lead === undefined || medial === undefined) {
      out += chars[i];
      continue;
    }

    const previous = parts[i - 1] ?? null;
    const next = parts[i + 1] ?? null;
    let onset = lead;
    let coda = current.final === 0 ? '' : FINAL[current.final];

    if (previous && previous.final !== 0) {
      const before = junction(previous, current);
      if (before.onset !== null) onset = before.onset;
    }
    if (next) coda = current.final === 0 ? '' : junction(current, next).coda;

    out += onset + medial + coda;
  }

  return out;
}

/**
 * La forma McCune–Reischauer, quella di molti manuali e di Wikipedia: cambia
 * solo le iniziali non aspirate (g→k, d→t, b→p, j→ch) e segna le aspirate con
 * un apostrofo, che `foldRomanization` elimina. 학교 → `hak.kyo` → `hakkyo`,
 * 김치 → `kimch'i` → `kimchi`. Non è la forma che l'app mostra: è quella che lo
 * studente porta con sé da un libro, e il confronto deve capirla.
 */
export function mccuneReischauerVariant(word: string): string {
  // ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ: le aspirate perdono
  // l'apostrofo nel confronto, quindi ㅊ e ㅋ diventano ch e k.
  const LEAD_MR = ['k', 'kk', 'n', 't', 'tt', 'r', 'm', 'p', 'pp', 's', 'ss', '', 'ch', 'ch', 'ch', 'k', 't', 'p', 'h'];
  return Array.from(word)
    .map((char) => {
      const parts = syllableIndex(char);
      if (!parts) return char;
      const lead = LEAD_MR[parts.lead];
      const medial = MEDIAL[parts.medial];
      if (lead === undefined || medial === undefined) return char;
      return lead + medial + FINAL[parts.final];
    })
    .join('');
}

/**
 * Le forme che si accettano per una parola: la trascrizione, la forma della
 * pronuncia (`pronunciationRomanize`), quella McCune–Reischauer e, dopo una
 * consonante scritta, quella senza la `y` delle vocali che cominciano per y
 * (류 → `ryu` o `nu`, 결 → `gyeol` o `geol`). La RR scrive la `y`, ma molti
 * dizionari la lasciano cadere dopo una consonante: chiamarne una delle due un
 * errore vorrebbe dire correggere romanizzazioni corrette.
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
  return new Set([
    romanizeWord(word),
    pronunciationRomanize(word),
    mccuneReischauerVariant(word),
    senzaY,
  ].map(normalize));
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
