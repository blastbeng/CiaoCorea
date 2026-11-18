/**
 * Confronto di risposte scritte. Il coreano ha due trappole ricorrenti:
 * - macOS produce Unicode NFD, Windows/Linux NFC: 밥 deve essere uguale a 밥;
 * - i jamo esistono in due blocchi (compatibility U+3131… e conjoining U+1100…)
 *   e gli utenti/le tastiere possono produrre l'uno o l'altro.
 * Se non si normalizza qui, i bug compaiono come "risposta sbagliata" su
 * risposte giuste, che è il modo più rapido per perdere uno studente.
 */

const COMPATIBILITY_TO_CONJOINING: Record<string, string> = {
  'ㄱ': 'ᄀ', 'ㄲ': 'ᄁ', 'ㄳ': 'ᄀ', 'ㄴ': 'ᄂ', 'ㄵ': 'ᄂ', 'ㄶ': 'ᄂ',
  'ㄷ': 'ᄃ', 'ㄸ': 'ᄄ', 'ㄹ': 'ᄅ', 'ㄺ': 'ᄅ', 'ㄻ': 'ᄅ', 'ㄼ': 'ᄅ',
  'ㄽ': 'ᄅ', 'ㄾ': 'ᄅ', 'ㄿ': 'ᄅ', 'ㅀ': 'ᄅ', 'ㅁ': 'ᄆ', 'ㅂ': 'ᄇ',
  'ㅄ': 'ᄇ', 'ㅅ': 'ᄉ', 'ㅆ': 'ᄊ', 'ㅇ': 'ᄋ', 'ㅈ': 'ᄌ', 'ㅉ': 'ᄍ',
  'ㅊ': 'ᄎ', 'ㅋ': 'ᄏ', 'ㅌ': 'ᄐ', 'ㅍ': 'ᄑ', 'ㅎ': 'ᄒ',
  'ㅏ': 'ᅡ', 'ㅐ': 'ᅢ', 'ㅑ': 'ᅣ', 'ㅒ': 'ᅤ', 'ㅓ': 'ᅥ', 'ㅔ': 'ᅦ',
  'ㅕ': 'ᅧ', 'ㅖ': 'ᅨ', 'ㅗ': 'ᅩ', 'ㅘ': 'ᅪ', 'ㅙ': 'ᅫ', 'ㅚ': 'ᅬ',
  'ㅛ': 'ᅭ', 'ㅜ': 'ᅮ', 'ㅝ': 'ᅯ', 'ㅞ': 'ᅰ', 'ㅟ': 'ᅱ', 'ㅠ': 'ᅲ',
  'ㅡ': 'ᅳ', 'ㅢ': 'ᅴ', 'ㅣ': 'ᅵ',
};

/** NFC + jamo unificati: due scritture della stessa sillaba diventano uguali. */
export function normalizeHangul(value: string): string {
  const unified = Array.from(value.normalize('NFC'))
    .map((char) => COMPATIBILITY_TO_CONJOINING[char] ?? char)
    .join('');
  return unified.normalize('NFC');
}

/** Normalizza una risposta scritta: spazi, punteggiatura finale, maiuscole. */
export function normalizeAnswer(value: string): string {
  // Il trim viene prima della punteggiatura: con "  안녕하세요!  " il punto
  // esclamativo non è a fine stringa finché restano gli spazi finali.
  return normalizeHangul(value)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:。、！？]+$/u, '')
    .trim();
}

/** Versione senza spazi: "밥 이" e "밥이" contano come la stessa risposta. */
export function compact(value: string): string {
  return normalizeAnswer(value).replace(/\s+/g, '');
}

/**
 * L'italiano scritto a mano libera: accenti, apostrofi e maiuscole non devono
 * decidere se una traduzione è giusta.
 */
export function foldItalian(value: string): string {
  return normalizeAnswer(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Romanizzazione riveduta: ŏ/ŭ, apostrofi e maiuscole sono varianti grafiche
 * accettabili. Restituisce una forma compatta confrontabile.
 */
export function foldRomanization(value: string): string {
  return value
    .toLowerCase()
    // McCune-Reischauer scrive ㅓ e ㅡ come ŏ e ŭ, la romanizzazione riveduta
    // come eo ed eu: chi copia da un libro vecchio deve ottenere lo stesso
    // confronto di chi usa la forma ufficiale.
    .replace(/ŏ/g, 'eo')
    .replace(/ŭ/g, 'eu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`^]/g, '')
    .replace(/[-\s]+/g, '')
    .trim();
}

export interface MatchResult {
  matched: boolean;
  /** La variante accettata che ha fatto match, utile per il feedback. */
  via?: string;
}

/** True se la risposta coincide con almeno una delle varianti attese. */
export function matchesAny(
  answer: string,
  accepted: readonly string[],
  compare: (value: string) => string = compact,
): MatchResult {
  const candidate = compare(answer);
  if (candidate.length === 0) return { matched: false };
  for (const variant of accepted) {
    if (compare(variant) === candidate) return { matched: true, via: variant };
  }
  return { matched: false };
}
