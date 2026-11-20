/**
 * Le lettere dell'hangul, con il nome con cui si chiamano e il suono che hanno.
 * Servono alla pagina dell'alfabeto e alle schede di pronuncia.
 *
 * I nomi sono quelli ufficiali sudcoreani: 기역, 디귿, 시옷 (non 디읃, 시읏).
 * I suoni sono descritti per un lettore italiano, senza fingere che l'italiano
 * abbia tutti i suoni del coreano: quando un suono non esiste, si dice a quale
 * si avvicina e che cosa fa la bocca.
 */

import { compose, decompose, type Syllable } from './hangul';

export type ConsonantKind = 'base' | 'aspirated' | 'tense';

export interface ConsonantLetter {
  char: string;
  name: string;
  /** Romanizzazione del nome: 기역 → giyeok. */
  rr: string;
  ipa: string;
  /** Come si pronuncia, in italiano. */
  sound: string;
  kind: ConsonantKind;
  /** Esempio di sillaba con la vocale ㅏ, quando esiste. */
  example: string;
}

export interface VowelLetter {
  char: string;
  name: string;
  rr: string;
  ipa: string;
  sound: string;
  /** Le due vocali da cui nasce, per le composte: ㅘ = ㅗ + ㅏ. */
  from?: [string, string];
}

/**
 * Le diciannove consonanti, nell'ordine dei dizionari coreani: prima le cinque
 * di base di ogni serie, poi le doppie, poi le aspirate.
 */
export const CONSONANTS: ConsonantLetter[] = [
  {
    char: 'ㄱ',
    name: '기역',
    rr: 'giyeok',
    ipa: 'k / ɡ',
    sound:
      'Una k senza soffio. All\'inizio di parola somiglia alla c di «casa»; fra due vocali diventa sonora, come la g di «gatto».',
    kind: 'base',
    example: '가',
  },
  {
    char: 'ㄲ',
    name: '쌍기역',
    rr: 'ssanggiyeok',
    ipa: 'k͈',
    sound:
      'La stessa k, ma tesa: la gola si stringe e l\'aria non esce. Non è una k più forte con il soffio, è una k «trattenuta».',
    kind: 'tense',
    example: '까',
  },
  {
    char: 'ㄴ',
    name: '니은',
    rr: 'nieun',
    ipa: 'n',
    sound: 'Come la n di «naso». Davanti a ㄹ può diventare una l (신라 → silla).',
    kind: 'base',
    example: '나',
  },
  {
    char: 'ㄷ',
    name: '디귿',
    rr: 'digeut',
    ipa: 't / d',
    sound:
      'Una t senza soffio, con la lingua sui denti. Fra due vocali si sente la d di «dado».',
    kind: 'base',
    example: '다',
  },
  {
    char: 'ㄸ',
    name: '쌍디귿',
    rr: 'ssangdigeut',
    ipa: 't͈',
    sound: 'La t tesa: come 디귿, ma con la gola chiusa e senza aria.',
    kind: 'tense',
    example: '따',
  },
  {
    char: 'ㄹ',
    name: '리을',
    rr: 'rieul',
    ipa: 'ɾ / l',
    sound:
      'Una r leggera, con la punta della lingua che tocca una volta il palato, come in «arare». In fine di sillaba è una l di «luna».',
    kind: 'base',
    example: '라',
  },
  {
    char: 'ㅁ',
    name: '미음',
    rr: 'mieum',
    ipa: 'm',
    sound: 'Come la m di «mano», con le labbra chiuse.',
    kind: 'base',
    example: '마',
  },
  {
    char: 'ㅂ',
    name: '비읍',
    rr: 'bieup',
    ipa: 'p / b',
    sound:
      'Una p senza soffio. Fra due vocali diventa la b di «bene», con le labbra morbide.',
    kind: 'base',
    example: '바',
  },
  {
    char: 'ㅃ',
    name: '쌍비읍',
    rr: 'ssangbieup',
    ipa: 'p͈',
    sound: 'La p tesa: labbra chiuse e nessun soffio.',
    kind: 'tense',
    example: '빠',
  },
  {
    char: 'ㅅ',
    name: '시옷',
    rr: 'siot',
    ipa: 's / ɕ',
    sound:
      'La s di «sole». Davanti a i o a una vocale con la i (시, 샤) diventa più dolce, come la sc di «sci».',
    kind: 'base',
    example: '사',
  },
  {
    char: 'ㅆ',
    name: '쌍시옷',
    rr: 'ssangsiot',
    ipa: 's͈',
    sound: 'La s tesa e un po\' più lunga, senza diventare una z.',
    kind: 'tense',
    example: '싸',
  },
  {
    char: 'ㅇ',
    name: '이응',
    rr: 'ieung',
    ipa: '∅ / ŋ',
    sound:
      'All\'inizio di sillaba è muta: serve solo a reggere la vocale (아 si legge «a»). In fine di sillaba suona ng, come la n di «sangue».',
    kind: 'base',
    example: '아',
  },
  {
    char: 'ㅈ',
    name: '지읒',
    rr: 'jieut',
    ipa: 'tɕ / dʑ',
    sound:
      'Come la c di «cielo», ma con la lingua più piatta. Fra due vocali si sente una g dolce di «giro».',
    kind: 'base',
    example: '자',
  },
  {
    char: 'ㅉ',
    name: '쌍지읒',
    rr: 'ssangjieut',
    ipa: 'tɕ͈',
    sound: 'La c tesa: come 지읒, con la gola chiusa e senza soffio.',
    kind: 'tense',
    example: '짜',
  },
  {
    char: 'ㅊ',
    name: '치읓',
    rr: 'chieut',
    ipa: 'tɕʰ',
    sound: 'Come la c di «cielo», ma con un soffio d\'aria dopo: «ch» aspirata.',
    kind: 'aspirated',
    example: '차',
  },
  {
    char: 'ㅋ',
    name: '키읔',
    rr: 'kieuk',
    ipa: 'kʰ',
    sound: 'La k con il soffio: come la c di «casa» soffiando su una candela.',
    kind: 'aspirated',
    example: '카',
  },
  {
    char: 'ㅌ',
    name: '티읕',
    rr: 'tieut',
    ipa: 'tʰ',
    sound: 'La t con il soffio, come nell\'inglese «top».',
    kind: 'aspirated',
    example: '타',
  },
  {
    char: 'ㅍ',
    name: '피읖',
    rr: 'pieup',
    ipa: 'pʰ',
    sound: 'La p con il soffio, come nell\'inglese «pen».',
    kind: 'aspirated',
    example: '파',
  },
  {
    char: 'ㅎ',
    name: '히읗',
    rr: 'hieut',
    ipa: 'h',
    sound:
      'Un\'aspirazione, come l\'h inglese di «house». In fine di sillaba è quasi muta: 좋다 si sente «jota».',
    kind: 'base',
    example: '하',
  },
];

/** Le ventuno vocali: dieci semplici, undici composte. */
export const VOWELS: VowelLetter[] = [
  {
    char: 'ㅏ',
    name: '아',
    rr: 'a',
    ipa: 'a',
    sound: 'La a di «casa», aperta e breve.',
  },
  {
    char: 'ㅐ',
    name: '애',
    rr: 'ae',
    ipa: 'ɛ ~ e',
    sound:
      'La e aperta di «bene». Oggi quasi tutti i coreani la pronunciano come ㅔ: la differenza scritta resta, quella parlata spesso no.',
    from: ['ㅏ', 'ㅣ'],
  },
  {
    char: 'ㅑ',
    name: '야',
    rr: 'ya',
    ipa: 'ja',
    sound: 'La a preceduta da una i rapida: «ia» di «iato».',
  },
  {
    char: 'ㅒ',
    name: '얘',
    rr: 'yae',
    ipa: 'jɛ',
    sound: 'Come ㅑ, ma con la e aperta: «ie» di «ieri».',
    from: ['ㅑ', 'ㅣ'],
  },
  {
    char: 'ㅓ',
    name: '어',
    rr: 'eo',
    ipa: 'ʌ',
    sound:
      'Un suono fra la a e la o, con la bocca rilassata e le labbra non arrotondate. Non è la o italiana: si avvicina alla o di «porta» senza la bocca a cerchio.',
  },
  {
    char: 'ㅔ',
    name: '에',
    rr: 'e',
    ipa: 'e',
    sound: 'La e chiusa di «sera». Per molti parlanti è identica a ㅐ.',
    from: ['ㅓ', 'ㅣ'],
  },
  {
    char: 'ㅕ',
    name: '여',
    rr: 'yeo',
    ipa: 'jʌ',
    sound: 'Come ㅓ, preceduto da una i rapida.',
  },
  {
    char: 'ㅖ',
    name: '예',
    rr: 'ye',
    ipa: 'je',
    sound: 'Il suono di «ie» in «ieri», con la e chiusa.',
    from: ['ㅕ', 'ㅣ'],
  },
  {
    char: 'ㅗ',
    name: '오',
    rr: 'o',
    ipa: 'o',
    sound: 'La o chiusa di «sole», con le labbra arrotondate.',
  },
  {
    char: 'ㅘ',
    name: '와',
    rr: 'wa',
    ipa: 'wa',
    sound: 'Una u molto rapida seguita da a: «ua» di «quattro».',
    from: ['ㅗ', 'ㅏ'],
  },
  {
    char: 'ㅙ',
    name: '왜',
    rr: 'wae',
    ipa: 'wɛ',
    sound: 'Come ㅘ, ma con la e aperta: «ue» di «quercia».',
    from: ['ㅗ', 'ㅐ'],
  },
  {
    char: 'ㅚ',
    name: '외',
    rr: 'oe',
    ipa: 'we',
    sound:
      'Oggi si pronuncia come ㅞ, «ue» di «quercia». La vecchia o con la i è rimasta solo nella scrittura.',
    from: ['ㅗ', 'ㅣ'],
  },
  {
    char: 'ㅛ',
    name: '요',
    rr: 'yo',
    ipa: 'jo',
    sound: 'Una i rapida seguita da o: «io» di «iodio».',
  },
  {
    char: 'ㅜ',
    name: '우',
    rr: 'u',
    ipa: 'u',
    sound: 'La u di «luna», con le labbra molto arrotondate.',
  },
  {
    char: 'ㅝ',
    name: '워',
    rr: 'wo',
    ipa: 'wʌ',
    sound: 'Una u rapida seguita da ㅓ: «uo» di «cuore», con la bocca rilassata.',
    from: ['ㅜ', 'ㅓ'],
  },
  {
    char: 'ㅞ',
    name: '웨',
    rr: 'we',
    ipa: 'we',
    sound: '«ue» di «quercia»: è il suono di ㅚ e ㅙ nella lingua di oggi.',
    from: ['ㅜ', 'ㅔ'],
  },
  {
    char: 'ㅟ',
    name: '위',
    rr: 'wi',
    ipa: 'wi',
    sound: 'Una u rapidissima seguita da i, come in «qui».',
    from: ['ㅜ', 'ㅣ'],
  },
  {
    char: 'ㅠ',
    name: '유',
    rr: 'yu',
    ipa: 'ju',
    sound: 'Una i rapida seguita da u: «iu» di «più» senza la p.',
  },
  {
    char: 'ㅡ',
    name: '으',
    rr: 'eu',
    ipa: 'ɯ',
    sound:
      'Non esiste in italiano: la lingua sta come per la u, ma le labbra restano distese, come per un sorriso. È un «u» senza cerchio.',
  },
  {
    char: 'ㅢ',
    name: '의',
    rr: 'ui',
    ipa: 'ɰi ~ i',
    sound:
      'Un ㅡ seguito da i. Dopo una consonante si sente solo i (희망 → himang); come particella possessiva si sente spesso e.',
    from: ['ㅡ', 'ㅣ'],
  },
  {
    char: 'ㅣ',
    name: '이',
    rr: 'i',
    ipa: 'i',
    sound: 'La i di «vino», breve e tesa.',
  },
];

/**
 * In fine di sillaba si scrivono ventisette lettere, ma i suoni sono sette: le
 * altre si riducono a uno di questi. È la regola che rende leggibile 밖 e 밥
 * senza dover ricordare ogni consonante doppia.
 */
export interface FinalSound {
  ipa: string;
  sound: string;
  /** Le lettere che, in fine di sillaba, suonano così. */
  letters: string[];
  examples: { ko: string; rr: string; it: string }[];
}

export const FINALS: FinalSound[] = [
  {
    ipa: 'k̚',
    sound:
      'Si chiude la gola come per dire k e ci si ferma: nessuna vocale dopo, nessun soffio.',
    letters: ['ㄱ', 'ㄲ', 'ㅋ', 'ㄳ', 'ㄺ'],
    examples: [
      { ko: '국', rr: 'guk', it: 'zuppa' },
      { ko: '밖', rr: 'bak', it: 'fuori' },
    ],
  },
  {
    ipa: 'n',
    sound: 'Come la n di «naso».',
    letters: ['ㄴ', 'ㄵ', 'ㄶ'],
    examples: [
      { ko: '눈', rr: 'nun', it: 'occhio, neve' },
      { ko: '앉다', rr: 'anda', it: 'sedersi' },
    ],
  },
  {
    ipa: 't̚',
    sound:
      'Si chiude la lingua sui denti come per dire t e ci si ferma. È il suono più frequente in fine di parola.',
    letters: ['ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅎ'],
    examples: [
      { ko: '옷', rr: 'ot', it: 'vestito' },
      { ko: '낮', rr: 'nat', it: 'giorno' },
    ],
  },
  {
    ipa: 'l',
    sound: 'La l di «luna»: la punta della lingua tocca gli incisivi superiori e resta lì.',
    letters: ['ㄹ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㅀ'],
    examples: [
      { ko: '물', rr: 'mul', it: 'acqua' },
      { ko: '여덟', rr: 'yeodeol', it: 'otto' },
    ],
  },
  {
    ipa: 'm',
    sound: 'Come la m di «mano», a labbra chiuse.',
    letters: ['ㅁ', 'ㄻ'],
    examples: [
      { ko: '밤', rr: 'bam', it: 'notte, castagna' },
      { ko: '삶', rr: 'sam', it: 'vita' },
    ],
  },
  {
    ipa: 'p̚',
    sound: 'Si chiudono le labbra come per dire p e ci si ferma.',
    letters: ['ㅂ', 'ㅍ', 'ㄿ', 'ㅄ'],
    examples: [
      { ko: '밥', rr: 'bap', it: 'riso, pasto' },
      { ko: '앞', rr: 'ap', it: 'davanti' },
    ],
  },
  {
    ipa: 'ŋ',
    sound: 'La ng di «sangue»: il suono resta in gola, la lingua non tocca nulla.',
    letters: ['ㅇ'],
    examples: [
      { ko: '강', rr: 'gang', it: 'fiume' },
      { ko: '한국', rr: 'hanguk', it: 'Corea' },
    ],
  },
];

/** Le consonanti iniziali che si usano nella tabella delle sillabe. */
export const TABLE_LEADS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** Le vocali della tabella: dodici, quelle che si incontrano tutti i giorni. */
export const TABLE_VOWELS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'];

/** Le consonanti finali che si possono scegliere nel compositore. */
export const TABLE_TAILS = ['', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'];

const BY_CHAR = new Map<string, ConsonantLetter | VowelLetter>();
for (const letter of CONSONANTS) BY_CHAR.set(letter.char, letter);
for (const letter of VOWELS) BY_CHAR.set(letter.char, letter);

/** Il nome e il suono di una lettera, se è una lettera dell'alfabeto. */
export function jamoInfo(char: string): ConsonantLetter | VowelLetter | null {
  return BY_CHAR.get(char) ?? null;
}

/** Un blocco hangul scomposto nelle sue tre parti, vuoto se non è un blocco. */
export function decomposeSyllable(char: string): Syllable | null {
  return decompose(char);
}

/** Il blocco composto da una consonante, una vocale e una finale facoltativa. */
export function composeSyllable(lead: string, vowel: string, tail = ''): string | null {
  return compose(lead, vowel, tail);
}
