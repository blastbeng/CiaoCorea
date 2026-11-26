/**
 * La tastiera coreana standard: 두벌식 (dubeolsik), «a due gruppi».
 *
 * È la tastiera di un computer coreano, e la sola che uno studente incontra
 * fuori dall'Italia: le consonanti stanno sulla mano sinistra, le vocali sulla
 * destra, e ogni sillaba si digita nell'ordine in cui si scrive — consonante,
 * vocale, ricevitivo. Le lettere che non hanno un tasto proprio si ottengono
 * così: i cinque consonanti tese e ㅒ/ㅖ con Shift, le vocali composte premendo
 * in fila le due vocali che le formano, i ricevitivi doppi premendo in fila le
 * due consonanti che si vedono.
 *
 * Qui la mappa serve a una cosa sola: far esercitare le dita su una tastiera
 * che non c'è. Lo studente preme i tasti latino del suo computer, questi
 * moduli li traducono in jamo, e il compositore di `hangul.ts` fa le sillabe
 * come fa un IME coreano. La memoria che si forma è quella vera: le stesse
 * dita, gli stessi posti, su una tastiera coreana.
 */

import { decomposeSyllable } from '@ciaocorea/engine';
import { composeHangul } from './hangul';

/** Un tasto: la lettera stampata sul computer, il jamo che scrive, il jamo di Shift. */
export interface KeyCap {
  key: string;
  jamo: string;
  /** Il jamo che esce tenendo Shift; null quando il tasto non ne ha uno. */
  shift: string | null;
}

/**
 * Le tre file della tastiera coreana, nell'ordine fisico dei tasti.
 *
 * La file di mezzo è quella da imparare per prima: ㅁ ㄴ ㅇ ㄹ ㅎ a sinistra,
 * ㅗ ㅓ ㅏ ㅣ a destra, e da sola copre una buona parte del coreano quotidiano.
 */
export const LAYOUT_ROWS: KeyCap[][] = [
  [
    { key: 'Q', jamo: 'ㅂ', shift: 'ㅃ' },
    { key: 'W', jamo: 'ㅈ', shift: 'ㅉ' },
    { key: 'E', jamo: 'ㄷ', shift: 'ㄸ' },
    { key: 'R', jamo: 'ㄱ', shift: 'ㄲ' },
    { key: 'T', jamo: 'ㅅ', shift: 'ㅆ' },
    { key: 'Y', jamo: 'ㅛ', shift: null },
    { key: 'U', jamo: 'ㅕ', shift: null },
    { key: 'I', jamo: 'ㅑ', shift: null },
    { key: 'O', jamo: 'ㅐ', shift: 'ㅒ' },
    { key: 'P', jamo: 'ㅔ', shift: 'ㅖ' },
  ],
  [
    { key: 'A', jamo: 'ㅁ', shift: null },
    { key: 'S', jamo: 'ㄴ', shift: null },
    { key: 'D', jamo: 'ㅇ', shift: null },
    { key: 'F', jamo: 'ㄹ', shift: null },
    { key: 'G', jamo: 'ㅎ', shift: null },
    { key: 'H', jamo: 'ㅗ', shift: null },
    { key: 'J', jamo: 'ㅓ', shift: null },
    { key: 'K', jamo: 'ㅏ', shift: null },
    { key: 'L', jamo: 'ㅣ', shift: null },
  ],
  [
    { key: 'Z', jamo: 'ㅋ', shift: null },
    { key: 'X', jamo: 'ㅌ', shift: null },
    { key: 'C', jamo: 'ㅊ', shift: null },
    { key: 'V', jamo: 'ㅍ', shift: null },
    { key: 'B', jamo: 'ㅠ', shift: null },
    { key: 'N', jamo: 'ㅜ', shift: null },
    { key: 'M', jamo: 'ㅡ', shift: null },
  ],
];

/**
 * Le vocali che un tasto non ce l'hanno: si digitano in due, e il compositore
 * le fonde. ㅐ e ㅔ stanno qui solo per dirlo: il loro tasto ce l'hanno (O e P),
 * quindi nella mappa non compaiono.
 */
export const TYPED_VOWELS: readonly { vowel: string; keys: [string, string] }[] = [
  { vowel: 'ㅘ', keys: ['ㅗ', 'ㅏ'] },
  { vowel: 'ㅙ', keys: ['ㅗ', 'ㅐ'] },
  { vowel: 'ㅚ', keys: ['ㅗ', 'ㅣ'] },
  { vowel: 'ㅝ', keys: ['ㅜ', 'ㅓ'] },
  { vowel: 'ㅞ', keys: ['ㅜ', 'ㅔ'] },
  { vowel: 'ㅟ', keys: ['ㅜ', 'ㅣ'] },
  { vowel: 'ㅢ', keys: ['ㅡ', 'ㅣ'] },
];

/** I ricevitivi doppi: due consonanti in fila, nell'ordine in cui si vedono. */
export const DOUBLE_TAILS: Record<string, [string, string]> = {
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
};

const LAYOUT: KeyCap[] = LAYOUT_ROWS.flat();

/** Tasto (lettera maiuscola) → jamo. */
export const KEY_TO_JAMO: Record<string, string> = Object.fromEntries(
  LAYOUT.map((cap) => [cap.key, cap.jamo]),
);

/** Tasto + Shift → jamo teso. */
export const SHIFT_TO_JAMO: Record<string, string> = Object.fromEntries(
  LAYOUT.filter((cap) => cap.shift !== null).map((cap) => [cap.key, cap.shift as string]),
);

/** jamo → tasto. `shift` dice se tenere premuto Shift. */
export const JAMO_TO_KEY: Record<string, { key: string; shift: boolean }> = (() => {
  const map: Record<string, { key: string; shift: boolean }> = {};
  for (const cap of LAYOUT) {
    map[cap.jamo] = { key: cap.key, shift: false };
    if (cap.shift) map[cap.shift] = { key: cap.key, shift: true };
  }
  for (const pair of TYPED_VOWELS) map[pair.vowel] = { key: '', shift: false };
  return map;
})();

/**
 * Una pressione: la lettera del tasto. Minuscola = senza Shift, MAIUSCOLA = con
 * Shift. È il modo in cui si scrivono le sequenze di tasti nei corsi coreani.
 */
export type Keystroke = string;

/** I jamo di una parola, in ordine di digitazione: sillaba per sillaba. */
export function jamoOf(text: string): string[] {
  const jamo: string[] = [];

  for (const char of text) {
    if (char === ' ') {
      jamo.push(' ');
      continue;
    }

    const parts = decomposeSyllable(char);
    if (!parts) {
      // Non è una sillaba: un jamo sciolto o un segno, si digita com'è.
      jamo.push(char);
      continue;
    }

    const syllable = [parts.lead, parts.vowel, ...(parts.tail ? [parts.tail] : [])];
    for (const letter of syllable) {
      const pair = DOUBLE_TAILS[letter];
      if (pair) jamo.push(...pair);
      else jamo.push(letter);
    }
  }

  return jamo;
}

/**
 * I tasti da premere per scrivere una parola.
 *
 * `null` quando una lettera non ha un tasto e non si compone: non succede con
 * il coreano presente nel corso, ma il tipo lo dice, così un testo con un jamo
 * raro non diventa silenziosamente una sequenza sbagliata.
 */
export function keystrokesFor(text: string): Keystroke[] | null {
  const keys: Keystroke[] = [];

  for (const jamo of jamoOf(text)) {
    if (jamo === ' ') {
      keys.push(' ');
      continue;
    }

    const pair = TYPED_VOWELS.find((entry) => entry.vowel === jamo);
    if (pair) {
      // Vocale composta: le sue due vocali, in fila.
      for (const half of pair.keys) {
        const cap = JAMO_TO_KEY[half];
        if (!cap || !cap.key) return null;
        keys.push(cap.shift ? cap.key : cap.key.toLowerCase());
      }
      continue;
    }

    const cap = JAMO_TO_KEY[jamo];
    if (!cap || !cap.key) return null;
    keys.push(cap.shift ? cap.key : cap.key.toLowerCase());
  }

  return keys;
}

/**
 * I tasti premuti → jamo. Una lettera maiuscola è uno Shift; i jamo e ciò che
 * jamo non è passano intatti, così chi ha la tastiera coreana installata può
 * usare la pagina così com'è.
 */
export function keysToJamo(pressed: string): string[] {
  const jamo: string[] = [];

  for (const char of pressed) {
    if (char === ' ') {
      jamo.push(' ');
      continue;
    }

    const upper = char.toUpperCase();
    if (char === upper && SHIFT_TO_JAMO[upper]) {
      jamo.push(SHIFT_TO_JAMO[upper]);
      continue;
    }
    if (char !== upper && KEY_TO_JAMO[upper]) {
      jamo.push(KEY_TO_JAMO[upper]);
      continue;
    }

    jamo.push(char);
  }

  return jamo;
}

/** Che cosa esce dalla sequenza di tasti: sillabe composte, come da un IME. */
export function typedText(pressed: string): string {
  return composeHangul(keysToJamo(pressed).join(''));
}

/** Una sequenza scritta in riga: «rkatkgkqslek», la forma che si legge nei corsi. */
export function keysText(keys: readonly Keystroke[]): string {
  return keys.join('');
}

/* -------------------------------------------------------------------------- */
/* Le parole da digitare                                                      */
/* -------------------------------------------------------------------------- */

export interface TypingWord {
  ko: string;
  it: string;
}

export interface TypingLevel {
  id: string;
  label: string;
  /** Che cosa la file insegna, in una riga. */
  blurb: string;
  words: TypingWord[];
}

/**
 * Le file sono in ordine di difficoltà delle dita, non del lessico: prima i
 * tasti senza Shift e senza ricevitivo, poi il ricevitivo, poi lo Shift dei
 * tesi, poi le vocali composte e i ricevitivi doppi, che sono le due regole
 * «in due tasti» della tastiera.
 */
export const TYPING_LEVELS: TypingLevel[] = [
  {
    id: 'aperte',
    label: 'Sillabe aperte',
    blurb:
      'Consonante e vocale, niente ricevitivo e niente Shift: il ritmo mano sinistra–mano destra. Ogni sillaba sono due tasti.',
    words: [
      { ko: '나', it: 'io' },
      { ko: '코', it: 'naso' },
      { ko: '이', it: 'dente' },
      { ko: '저', it: 'io (modesto)' },
      { ko: '누나', it: 'sorella maggiore (di un maschio)' },
      { ko: '이모', it: 'zia (sorella della madre)' },
      { ko: '모자', it: 'cappello' },
      { ko: '소파', it: 'divano' },
      { ko: '오이', it: 'cetriolo' },
      { ko: '고기', it: 'carne' },
      { ko: '사자', it: 'leone' },
      { ko: '요리', it: 'cucina' },
      { ko: '노래', it: 'canzone' },
      { ko: '모레', it: 'domani' },
    ],
  },
  {
    id: 'ricevitivi',
    label: 'Con ricevitivo',
    blurb:
      'Tre tasti per sillaba: consonante, vocale, e la consonante che chiude. La mano sinistra torna due volte, la destra resta al centro.',
    words: [
      { ko: '물', it: 'acqua' },
      { ko: '눈', it: 'occhio, neve' },
      { ko: '문', it: 'porta' },
      { ko: '손', it: 'mano' },
      { ko: '밥', it: 'riso, pasto' },
      { ko: '방', it: 'stanza' },
      { ko: '맛', it: 'sapore' },
      { ko: '옷', it: 'vestito' },
      { ko: '책', it: 'libro' },
      { ko: '아침', it: 'mattina' },
      { ko: '사람', it: 'persona' },
      { ko: '신발', it: 'scarpe' },
      { ko: '전화', it: 'telefono' },
      { ko: '눈물', it: 'lacrime' },
      { ko: '학생', it: 'studente' },
      { ko: '한국', it: 'Corea' },
    ],
  },
  {
    id: 'tesi',
    label: 'Shift: tesi e ㅒ ㅖ',
    blurb:
      'Sette tasti hanno una seconda lettera sotto Shift, e sono sempre le doppie: ㄲ R, ㄸ E, ㅃ Q, ㅆ T, ㅉ W, ㅒ O, ㅖ P. La mano sinistra impara a colpire il tasto e lo Shift nello stesso movimento.',
    words: [
      { ko: '씨', it: 'signore, -essa' },
      { ko: '쓰다', it: 'scrivere' },
      { ko: '빵', it: 'pane' },
      { ko: '가짜', it: 'falso' },
      { ko: '딸기', it: 'fragole' },
      { ko: '아저씨', it: 'signore, zio' },
      { ko: '있다', it: 'esserci' },
      { ko: '짜장면', it: 'jjajangmyeon' },
      { ko: '끼다', it: 'mettere, indossare' },
      { ko: '깨끗하다', it: 'essere pulito' },
      { ko: '예의', it: 'educazione' },
      { ko: '지혜', it: 'saggezza' },
      { ko: '계획', it: 'programma' },
    ],
  },
  {
    id: 'composte',
    label: 'Vocali composte',
    blurb:
      'Sette vocali non hanno un tasto: si premono in fila le due che le formano. ㅘ = ㅗ+ㅏ, ㅝ = ㅜ+ㅓ, ㅟ = ㅜ+ㅣ, ㅢ = ㅡ+ㅣ. Restano nella stessa sillaba: ㄱ ㅗ ㅏ fa 과, non 고아.',
    words: [
      { ko: '의자', it: 'sedia' },
      { ko: '의사', it: 'medico' },
      { ko: '뒤', it: 'dietro' },
      { ko: '쉬다', it: 'riposare' },
      { ko: '귀', it: 'orecchio' },
      { ko: '과일', it: 'frutta' },
      { ko: '과학', it: 'scienza' },
      { ko: '화요일', it: 'martedì' },
      { ko: '왕관', it: 'corona' },
      { ko: '외국', it: 'paese straniero' },
      { ko: '돼지', it: 'maiale' },
    ],
  },
  {
    id: 'doppi',
    label: 'Ricevitivi doppi',
    blurb:
      'Un ricevitivo doppio sono due consonanti in fila, nell\'ordine in cui si vedono: 닭 = ㄷ ㅏ ㄹ ㄱ. La mano sinistra fa il lavoro, la destra non si muove.',
    words: [
      { ko: '끝', it: 'fine' },
      { ko: '없다', it: 'non esserci' },
      { ko: '닭', it: 'gallina' },
      { ko: '읽기', it: 'lettura' },
      { ko: '여덟', it: 'otto' },
      { ko: '앉아', it: 'siediti' },
      { ko: '젊다', it: 'essere giovane' },
      { ko: '좁다', it: 'essere stretto' },
      { ko: '밝다', it: 'essere chiaro' },
      { ko: '맑다', it: '(cielo) sereno' },
      { ko: '늙다', it: 'essere vecchio' },
    ],
  },
];

/** Frasi da digitare tutte d'un fiato: sono i blocchi che si imparano a memoria. */
export const TYPING_PHRASES: TypingWord[] = [
  { ko: '감사합니다', it: 'grazie' },
  { ko: '안녕하세요', it: 'buongiorno' },
  { ko: '고마워요', it: 'grazie (fra amici)' },
  { ko: '미안합니다', it: 'mi scusi' },
  { ko: '사랑합니다', it: 'ti amo' },
];
