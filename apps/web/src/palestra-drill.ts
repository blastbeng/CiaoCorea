/**
 * Le domande della palestra.
 *
 * La palestra non ha un corso dietro: ha una regola. Le coniugazioni vengono
 * dal motore `conjugate`, le cui forme sono fissate dai test su paradigmi
 * verificati; le particelle vengono da `particleFace`, che applica la regola
 * dell'ortografia coreana. Qui non si inventa nessuna forma: si pescano voci e
 * le si coniuga, e a correggere sono le stesse funzioni che correggono i
 * contenuti.
 *
 * Sono due esercizi senza fine, e questo è il loro senso: la lezione spiega una
 * volta, la palestra la ripete quante volte serve, con una radice diversa ogni
 * volta. Le radici irregolari (ㄷ, ㄹ, ㅂ, ㅅ, ㅎ, 르, ㅡ) e le particelle che
 * cambiano forma sono i due punti dove l'italiano non ha appigli, e dove solo
 * la ripetizione lascia il segno.
 */
import {
  CONJUGATION_ENDINGS,
  conjugate,
  decomposeSyllable,
  particleFace,
  type ConjugationEndingKey,
} from '@ciaocorea/engine';

export type DrillId = 'verbi' | 'particelle';

export const DRILLS: readonly { id: DrillId; label: string; blurb: string }[] = [
  {
    id: 'verbi',
    label: 'Radici e desinenze',
    blurb: 'Coniuga una voce del dizionario: la radice irregolare fa la forma, non tu.',
  },
  {
    id: 'particelle',
    label: 'Particelle',
    blurb: 'La stessa particella ha due facce: decide l\'ultima lettera della parola.',
  },
];

/* -------------------------------------------------------------------------- */
/* Coniugazione                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Le desinenze messe nella palestra: tutte quelle che il motore sa dare per
 * ogni classe, verbi e aggettivi. Il connettivo (-고) e l\'avversativo (-지만)
 * restano fuori perché sono meccanici (radice + desinenza) e non allenano
 * niente; i due modificanti restano fuori perché sugli aggettivi mancano.
 */
export const VERB_ENDINGS: readonly ConjugationEndingKey[] = [
  'presente',
  'passato',
  'causale',
  'formale',
  'futuro',
];

/**
 * Le voci da coniugare: una schiera presa dai paradigmi verificati, così ogni
 * classe irregolare è coperta e nessuna forma chiesta è una forma che il
 * motore non sa spiegare.
 */
export const DRILL_LEMMAS: readonly string[] = [
  // regolari (verbi e aggettivi che non cambiano)
  '먹다',
  '읽다',
  '잡다',
  '입다',
  '믿다',
  '있다',
  '없다',
  // in contrazione di vocale
  '가다',
  '오다',
  '보다',
  '주다',
  '마시다',
  '사다',
  '기다리다',
  '되다',
  // in -하다
  '하다',
  '공부하다',
  '사랑하다',
  '이야기하다',
  // irregolare in ㄷ
  '듣다',
  '걷다',
  '싣다',
  // irregolare in ㄹ
  '살다',
  '알다',
  '만들다',
  '울다',
  // irregolare in ㅅ
  '붓다',
  '짓다',
  '낫다',
  // irregolare in ㅂ
  '춥다',
  '덥다',
  '쉽다',
  '어렵다',
  '가깝다',
  '고맙다',
  '돕다',
  // irregolare in ㅎ
  '빨갛다',
  '파랗다',
  '그렇다',
  '하얗다',
  // irregolare in 르
  '모르다',
  '빠르다',
  '다르다',
  '부르다',
  // radice in ㅡ
  '쓰다',
  '크다',
  '바쁘다',
  '아프다',
  '예쁘다',
];

export interface VerbQuestion {
  kind: 'verbo';
  lemma: string;
  stem: string;
  /** La classe della radice: «Irregolare in ㄷ». */
  classLabel: string;
  /** La regola della classe, mostrata come spiegazione. */
  classRule: string;
  ending: string;
  endingLabel: string;
  endingHint: string;
  /** La forma attesa, come la dà il motore. */
  answer: string;
  note: string;
}

/** Il confronto fra la risposta e la forma attesa: lo spazio non conta. */
export function normalizeKorean(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, '').trim();
}

export function isCorrectVerb(question: VerbQuestion, response: string): boolean {
  return normalizeKorean(response) === normalizeKorean(question.answer);
}

export function buildVerbQuestion(random: () => number = Math.random): VerbQuestion {
  // Si pesca voce + desinenza: se il motore non dà quella forma per quella
  // voce (non succede con l'elenco qui sopra, ma la forma può essere null) si
  // riprova, e non si mostra mai una domanda senza risposta.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const lemma = pick(DRILL_LEMMAS, random);
    const table = conjugate(lemma);
    if (!table) continue;

    const key = pick(VERB_ENDINGS, random);
    const definition = CONJUGATION_ENDINGS.find((entry) => entry.key === key);
    const form = table.forms.find((entry) => entry.key === key)?.form;
    if (!definition || !form) continue;

    const kindWord = table.class.kind === 'adjective' ? 'aggettivo' : 'verbo';
    return {
      kind: 'verbo',
      lemma,
      stem: table.stem,
      classLabel: table.class.label,
      classRule: table.class.info.rule,
      ending: definition.ending,
      endingLabel: definition.label,
      endingHint: definition.hint,
      answer: form,
      note: `${lemma} è un ${kindWord} a radice «${table.class.label.toLowerCase()}». ${table.class.info.rule}`,
    };
  }
  throw new Error('palestra: nessuna domanda di coniugazione generata');
}

/* -------------------------------------------------------------------------- */
/* Particelle                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Le cinque particelle che cambiano forma. `canonical` è una delle due facce:
 * `particleFace` decide quale delle due vuole la parola data. La direzione
 * (으로/로) vuole nomi di luogo, e infatti ha il suo elenco.
 */
export type ParticleFunction = 'subject' | 'topic' | 'object' | 'and' | 'direction';

export interface ParticleFunctionInfo {
  id: ParticleFunction;
  canonical: string;
  label: string;
  hint: string;
}

export const PARTICLE_FUNCTIONS: readonly ParticleFunctionInfo[] = [
  { id: 'subject', canonical: '이', label: 'il soggetto', hint: 'chi compie l’azione' },
  { id: 'topic', canonical: '은', label: 'il tema', hint: 'di chi o di che cosa si parla' },
  { id: 'object', canonical: '을', label: 'l’oggetto', hint: 'che cosa subisce l’azione' },
  { id: 'and', canonical: '과', label: '«e / con»', hint: 'unisce due nomi' },
  { id: 'direction', canonical: '으로', label: 'direzione o mezzo', hint: 'verso, per, con che cosa' },
];

/** Le due facce di ogni particella, per costruire il distrattore storto. */
const TWIN: Record<string, string> = {
  이: '가',
  가: '이',
  은: '는',
  는: '은',
  을: '를',
  를: '을',
  과: '와',
  와: '과',
  으로: '로',
  로: '으로',
};

export interface Noun {
  ko: string;
  it: string;
}

/** Nomi comuni: vanno bene con soggetto, tema, oggetto e «e/con». */
export const DRILL_NOUNS: readonly Noun[] = [
  { ko: '학교', it: 'scuola' },
  { ko: '친구', it: 'amico' },
  { ko: '커피', it: 'caffè' },
  { ko: '아이', it: 'bambino' },
  { ko: '의사', it: 'medico' },
  { ko: '회사', it: 'azienda' },
  { ko: '도시', it: 'città' },
  { ko: '사람', it: 'persona' },
  { ko: '책', it: 'libro' },
  { ko: '강', it: 'fiume' },
  { ko: '밥', it: 'riso, pasto' },
  { ko: '물', it: 'acqua' },
  { ko: '집', it: 'casa' },
  { ko: '가방', it: 'borsa' },
  { ko: '꽃', it: 'fiore' },
  { ko: '선생님', it: 'insegnante' },
];

/** Nomi di luogo: per la direzione (으로/로), dove conta anche la ㄹ finale. */
export const DRILL_PLACES: readonly Noun[] = [
  { ko: '학교', it: 'scuola' },
  { ko: '집', it: 'casa' },
  { ko: '서울', it: 'Seul' },
  { ko: '부산', it: 'Busan' },
  { ko: '도서관', it: 'biblioteca' },
  { ko: '시장', it: 'mercato' },
  { ko: '공원', it: 'parco' },
  { ko: '회사', it: 'azienda' },
];

export interface ParticleQuestion {
  kind: 'particella';
  noun: string;
  it: string;
  functionLabel: string;
  functionHint: string;
  /** La parola nuda, prima della particella. */
  base: string;
  /** La particella chiesta, nella forma giusta. */
  particle: string;
  /** La risposta: base + particella. */
  answer: string;
  options: string[];
  note: string;
}

/** L'ultima lettera della sillaba finale, '' se la sillaba è aperta. */
function lastTail(word: string): string {
  const chars = [...word];
  const last = chars[chars.length - 1];
  if (!last) return '';
  return decomposeSyllable(last)?.tail ?? '';
}

function endsOnConsonant(word: string): boolean {
  return lastTail(word) !== '';
}

function endsOnL(word: string): boolean {
  return lastTail(word) === 'ㄹ';
}

/** Base + faccia giusta della particella. */
function attach(noun: string, canonical: string): string {
  return noun + (particleFace(noun, canonical) ?? canonical);
}

/** Base + faccia storta della stessa particella (l'errore tipico). */
function attachStorto(noun: string, canonical: string): string | null {
  const face = particleFace(noun, canonical);
  if (!face) return null;
  const twin = TWIN[face];
  return twin ? noun + twin : null;
}

function describeEnding(noun: string): string {
  if (endsOnL(noun)) return 'finisce per ㄹ, e per la direzione vuole 로 senza ㅡ';
  if (endsOnConsonant(noun)) return `finisce con il 받침 ${lastTail(noun)}`;
  return 'finisce con una vocale (nessuna consonante finale)';
}

export function buildParticleQuestion(random: () => number = Math.random): ParticleQuestion {
  const info = pick(PARTICLE_FUNCTIONS, random);
  const pool = info.id === 'direction' ? DRILL_PLACES : DRILL_NOUNS;
  const noun = pick(pool, random);

  const particle = particleFace(noun.ko, info.canonical) ?? info.canonical;
  const answer = noun.ko + particle;

  const options = new Set<string>([answer]);
  // 1) la faccia storta della particella giusta: l'errore più comune
  const crooked = attachStorto(noun.ko, info.canonical);
  if (crooked && crooked !== answer) options.add(crooked);
  // 2) le altre particelle, nella forma giusta: cambiano il senso, non la forma
  for (const other of PARTICLE_FUNCTIONS) {
    if (other.id === info.id) continue;
    // la direzione vuole i luoghi, le altre vogliono i nomi comuni: non si
    // mescolano gli elenchi dentro la stessa domanda
    const candidate = attach(noun.ko, other.canonical);
    if (candidate && candidate !== answer) options.add(candidate);
    if (options.size >= 4) break;
  }
  // se l'elenco è ancora corto (raro) si completa con facce storte altrui
  for (const other of PARTICLE_FUNCTIONS) {
    if (options.size >= 4) break;
    const bent = attachStorto(noun.ko, other.canonical);
    if (bent && bent !== answer) options.add(bent);
  }

  const list = shuffle([...options], random);

  const reason =
    info.id === 'direction'
      ? `«${noun.ko}» ${describeEnding(noun.ko)}: la direzione vuole ${particle}, «${answer}».`
      : `«${noun.ko}» ${describeEnding(noun.ko)}, quindi ${info.label} prende ${particle}: «${answer}».`;

  return {
    kind: 'particella',
    noun: noun.ko,
    it: noun.it,
    functionLabel: info.label,
    functionHint: info.hint,
    base: noun.ko,
    particle,
    answer,
    options: list,
    note: reason,
  };
}

/* -------------------------------------------------------------------------- */
/* Piccoli attrezzi                                                           */
/* -------------------------------------------------------------------------- */

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Le opzioni escono già mescolate; `shuffle` è esposto per i test. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  return shuffled(items, random);
}
