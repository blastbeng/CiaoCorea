import { describe, expect, it } from 'vitest';
import {
  CONSONANTS,
  FINALS,
  VOWELS,
  composeSyllable,
  decomposeSyllable,
} from '@ciaocorea/engine';
import {
  DOUBLE_TAILS,
  KEY_TO_JAMO,
  LAYOUT_ROWS,
  SHIFT_TO_JAMO,
  TYPING_LEVELS,
  TYPING_PHRASES,
  TYPED_VOWELS,
  jamoOf,
  keysText,
  keysToJamo,
  keystrokesFor,
  typedText,
} from './dubeolsik';

/** Una sillaba aperta, senza Shift: la file più facile. */
function isPlainOpen(word: string): boolean {
  for (const char of word) {
    const parts = decomposeSyllable(char);
    if (!parts) return false;
    if (parts.tail) return false;
    if (keystrokesFor(char)?.some((key) => key === key.toUpperCase())) return false;
  }
  return true;
}

/** La parola usa almeno un tasto di Shift. */
function usesShift(word: string): boolean {
  const keys = keystrokesFor(word);
  return keys !== null && keys.some((key) => key !== ' ' && key === key.toUpperCase());
}

/** La parola ha una vocale che si digitano in due. */
function hasFusedVowel(word: string): boolean {
  const fused = new Set(TYPED_VOWELS.map((entry) => entry.vowel));
  return [...word].some((char) => {
    const parts = decomposeSyllable(char);
    return parts ? fused.has(parts.vowel) : false;
  });
}

/** La parola ha un ricevitivo doppio. */
function hasDoubleTail(word: string): boolean {
  return [...word].some((char) => {
    const parts = decomposeSyllable(char);
    return parts ? parts.tail in DOUBLE_TAILS : false;
  });
}

describe('la mappa dei tasti', () => {
  it('ventisei tasti, nessuno doppio', () => {
    const keys = LAYOUT_ROWS.flat().map((cap) => cap.key);
    expect(keys).toHaveLength(26);
    expect(new Set(keys).size).toBe(26);
  });

  it('Shift fa le cinque tese e le due vocali ㅒ ㅖ', () => {
    expect(Object.values(SHIFT_TO_JAMO).sort()).toEqual(
      ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ', 'ㅒ', 'ㅖ'].sort(),
    );
  });

  it('tutte le consonanti e le vocali dell’alfabeto hanno una strada', () => {
    const letters = [...CONSONANTS.map((entry) => entry.char), ...VOWELS.map((entry) => entry.char)];
    const missing = letters.filter((letter) => keystrokesFor(letter) === null);
    expect(missing).toEqual([]);
  });

  it('ogni ricevitivo, doppi compresi, si digita e torna indietro', () => {
    const tails = FINALS.flatMap((entry) => entry.letters);

    for (const tail of tails) {
      const syllable = composeSyllable('ㅇ', 'ㅏ', tail);
      expect(syllable, tail).not.toBeNull();
      const keys = keystrokesFor(syllable ?? '');
      expect(keys, tail).not.toBeNull();
      expect(typedText(keysText(keys ?? [])), tail).toBe(syllable);
    }
  });

  it('un ricevitivo doppio sono due tasti, nell’ordine in cui si vede', () => {
    // 닭: ㄷ ㅏ ㄹ ㄱ, e il ㄺ si scrive ㄹ poi ㄱ.
    expect(keystrokesFor('닭')).toEqual(['e', 'k', 'f', 'r']);
    expect(jamoOf('닭')).toEqual(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']);
  });
});

describe('le sequenze di tasti', () => {
  it('le sequenze dei corsi coreani tornano', () => {
    const cases: [string, string][] = [
      ['한국', 'gksrnr'],
      ['서울', 'tjdnf'],
      ['사람', 'tkfka'],
      ['고마워', 'rhakdnj'],
      ['감사합니다', 'rkatkgkqslek'],
      ['꿈', 'Rna'],
      ['물', 'anf'],
      ['의자', 'dmlwk'],
    ];

    for (const [word, keys] of cases) {
      expect(keysText(keystrokesFor(word) ?? [])).toBe(keys);
    }
  });

  it('i tasti premuti ridanno la parola, sillaba per sillaba', () => {
    const words = [...TYPING_PHRASES, ...TYPING_LEVELS.flatMap((level) => level.words)];

    for (const word of words) {
      const keys = keystrokesFor(word.ko);
      expect(keys, `${word.ko} non si può digitare`).not.toBeNull();
      expect(typedText(keysText(keys ?? [])), `${word.ko} da ${keysText(keys ?? [])}`).toBe(word.ko);
    }
  });

  it('una maiuscola è Shift, il coreano già composto passa', () => {
    expect(keysToJamo('R')).toEqual(['ㄲ']);
    expect(keysToJamo('r')).toEqual(['ㄱ']);
    expect(keysToJamo('gks')).toEqual(['ㅎ', 'ㅏ', 'ㄴ']);
    // Chi ha la tastiera coreana installata scrive direttamente le sillabe.
    expect(typedText('감사합니다')).toBe('감사합니다');
  });

  it('lo spazio resta uno spazio', () => {
    expect(keystrokesFor('나 나')).toContain(' ');
    expect(typedText('sk sk')).toBe('나 나');
  });
});

describe('le file di digitazione', () => {
  it('«Sillabe aperte» sono due tasti per sillaba, senza Shift', () => {
    const level = TYPING_LEVELS.find((entry) => entry.id === 'aperte');
    expect(level).toBeDefined();
    for (const word of level?.words ?? []) {
      expect(isPlainOpen(word.ko), word.ko).toBe(true);
      expect(keystrokesFor(word.ko)).toHaveLength([...word.ko].length * 2);
    }
  });

  it('«Con ricevitivo» chiudono ogni sillaba', () => {
    const level = TYPING_LEVELS.find((entry) => entry.id === 'ricevitivi');
    for (const word of level?.words ?? []) {
      const tails = [...word.ko].map((char) => decomposeSyllable(char)?.tail ?? '');
      expect(tails.some((tail) => tail !== ''), word.ko).toBe(true);
    }
  });

  it('la file di Shift usa per davvero lo Shift', () => {
    const level = TYPING_LEVELS.find((entry) => entry.id === 'tesi');
    for (const word of level?.words ?? []) {
      expect(usesShift(word.ko), word.ko).toBe(true);
    }
  });

  it('«Vocali composte» hanno una vocale da due tasti', () => {
    const level = TYPING_LEVELS.find((entry) => entry.id === 'composte');
    for (const word of level?.words ?? []) {
      expect(hasFusedVowel(word.ko), word.ko).toBe(true);
    }
  });

  it('«Ricevitivi doppi» hanno un ricevitivo doppio', () => {
    const level = TYPING_LEVELS.find((entry) => entry.id === 'doppie');
    for (const word of level?.words ?? []) {
      expect(hasDoubleTail(word.ko), word.ko).toBe(true);
    }
  });

  it('le parole non si ripetono dentro la stessa file', () => {
    for (const level of TYPING_LEVELS) {
      const words = level.words.map((word) => word.ko);
      expect(new Set(words).size, level.id).toBe(words.length);
    }
  });

  it('la mappa dei tasti copre le lettere della mappa a schermo', () => {
    const caps = LAYOUT_ROWS.flat();
    expect(KEY_TO_JAMO['K']).toBe('ㅏ');
    expect(caps.every((cap) => keystrokesFor(cap.jamo) !== null)).toBe(true);
  });
});
