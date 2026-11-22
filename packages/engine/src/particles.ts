/**
 * Il controllo delle particelle che cambiano forma.
 *
 * In coreano cinque particelle hanno due facce, e la scelta non è libera:
 * dipende dall'ultima lettera della parola a cui si attaccano. Sbagliarla è
 * l'errore più frequente di chi scrive, e un corso che la insegna male insegna
 * male mezza lingua.
 *
 * Le regole sono quelle dell'ortografia e della grammatica coreane:
 *   이/가, 은/는, 을/를, 과/와 — la prima dopo una consonante finale, la
 *     seconda dopo una sillaba che ne chiude nessuna. La ㅁ finale conta,
 *     perché è la nasale che si sente: «가방이», «강이». «학교» invece non
 *     chiude nulla e prende 가: «학교가», non «학교이».
 *   으로/로 — 으로 dopo una consonante finale («사람으로», «층으로»), 로 dopo
 *     una sillaba senza chiusura («학교로»), e dopo la ㄹ sempre 로: «말로».
 *   La 을 dopo la ㄹ resta 을 nella grafia anche se si pronuncia [를]: è
 *     l'esempio ufficiale dell'ortografia («팔을»), quindi non è un errore.
 *
 * Il controllo non indovina le parole: usa la lookup del vocabolario, che sa
 * dove finisce il nome e dove comincia la particella. Una forma che non è nel
 * vocabolario non viene giudicata — meglio non dire niente che dire una cosa
 * sbagliata: 어는 di «읽는» è una desinenza di verbo, non una particella, e un
 * controllo fatto a caso la marcherebbe come errore.
 */
import { decomposeSyllable } from './jamo';
import { lookupWord } from './lookup';
import type { VocabEntry } from '@ciaocorea/shared';

/**
 * Le due facce di ogni particella variabile: `consonant` è quella che va dopo
 * una consonante finale che si sente, `vowel` quella dopo una vocale.
 */
const FACES: Record<string, { consonant: string; vowel: string }> = {
  이: { consonant: '이', vowel: '가' },
  가: { consonant: '이', vowel: '가' },
  은: { consonant: '은', vowel: '는' },
  는: { consonant: '은', vowel: '는' },
  을: { consonant: '을', vowel: '를' },
  를: { consonant: '을', vowel: '를' },
  과: { consonant: '과', vowel: '와' },
  와: { consonant: '과', vowel: '와' },
  으로: { consonant: '으로', vowel: '로' },
  로: { consonant: '으로', vowel: '로' },
};

/**
 * Se l'ultima sillaba chiude su una consonante. La ㅁ finale conta: è la
 * nasale di «강», e dopo di essa la particella è quella delle consonanti —
 * «가방이», non «가방가». Solo una sillaba senza alcuna consonante finale è
 * come una vocale: «학교가».
 */
function lastTail(word: string): string {
  const last = [...word].at(-1);
  return last ? (decomposeSyllable(last)?.tail ?? '') : '';
}

function endsOnConsonant(word: string): boolean {
  return lastTail(word) !== '';
}

/** Se l'ultima sillaba chiude sulla ㄹ, che per 으로/로 fa eccezione. */
function endsOnL(word: string): boolean {
  return lastTail(word) === 'ㄹ';
}

export interface ParticleIssue {
  /** La parola così come compare nel testo. */
  token: string;
  /** La base riconosciuta nel vocabolario. */
  base: string;
  /** La particella così com'è scritta. */
  particle: string;
  /** La particella che l'ortografia chiede. */
  expected: string;
  /** Com'è finita la base: consonante o vocale. */
  baseEnds: 'consonant' | 'vowel';
}

/**
 * La forma che una particella variabile deve avere dopo una data base.
 * `null` se quella particella non è variabile.
 */
export function particleFace(base: string, particle: string): string | null {
  const face = FACES[particle];
  if (!face) return null;
  if (particle === '으로' || particle === '로') return endsOnL(base) ? '로' : endsOnConsonant(base) ? '으로' : '로';
  return endsOnConsonant(base) ? face.consonant : face.vowel;
}

/**
 * Le particelle scritte male in un testo. Solo le parole che la lookup
 * riconosce vengono giudicate: tutto il resto resta non giudicato.
 *
 * Il giudizio su ogni parola è messo in cache per il vocabolario usato, perché
 * il controllo scorre molti testi e le stesse parole ricompaiono di continuo.
 */
const judged = new WeakMap<readonly VocabEntry[], Map<string, ParticleIssue | null>>();

export function particleIssues(entries: readonly VocabEntry[], text: string): ParticleIssue[] {
  let byToken = judged.get(entries);
  if (!byToken) {
    byToken = new Map();
    judged.set(entries, byToken);
  }
  const issues: ParticleIssue[] = [];
  for (const token of text.match(/[가-힣]+/g) ?? []) {
    const cached = byToken.get(token);
    const issue = cached === undefined ? judge(entries, token) : cached;
    byToken.set(token, issue);
    if (issue) issues.push(issue);
  }
  return issues;
}

/** Che cosa non va nella particella di una parola, o `null` se va bene. */
function judge(entries: readonly VocabEntry[], token: string): ParticleIssue | null {
  const found = lookupWord(entries, token);
  const particle = found?.particle;
  if (!found || !particle) return null;
  const base = found.entry.ko;
  const expected = particleFace(base, particle);
  if (!expected || expected === particle) return null;
  return {
    token,
    base,
    particle,
    expected,
    baseEnds: endsOnConsonant(base) ? 'consonant' : 'vowel',
  };
}

/** Le sillabe coreane di un testo, senza punteggiatura né spazi. */
export function koreanTokens(text: string): string[] {
  return text.match(/[가-힣]+/g) ?? [];
}
