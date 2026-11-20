import { describe, expect, it } from 'vitest';
import {
  CONSONANTS,
  FINALS,
  TABLE_LEADS,
  TABLE_TAILS,
  TABLE_VOWELS,
  VOWELS,
  composeSyllable,
  decomposeSyllable,
  jamoInfo,
} from './jamo';
import { romanizeSyllable } from './romanize';

describe('le lettere dell\'hangul', () => {
  it('ha diciannove consonanti e ventuno vocali, senza doppioni', () => {
    expect(CONSONANTS).toHaveLength(19);
    expect(VOWELS).toHaveLength(21);
    expect(new Set(CONSONANTS.map((letter) => letter.char)).size).toBe(19);
    expect(new Set(VOWELS.map((letter) => letter.char)).size).toBe(21);
  });

  it('chiama ogni consonante con il nome che comincia da lei', () => {
    // 기역 comincia per ㄱ, 디귿 per ㄷ, 시옷 per ㅅ: se il nome non torna, la
    // scheda mostrerebbe una lettera e ne pronuncerebbe un'altra.
    for (const letter of CONSONANTS) {
      const first = decomposeSyllable(letter.name.charAt(0));
      expect(first, letter.name).not.toBeNull();
      const expected = letter.kind === 'tense' ? 'ㅆ' : letter.char;
      expect(first?.lead, `${letter.char} → ${letter.name}`).toBe(expected);
      expect(letter.name.length).toBeGreaterThanOrEqual(2);
      expect(letter.name.length).toBeLessThanOrEqual(3);
    }
  });

  it('costruisce il nome delle vocali con la ㅇ muta e la vocale stessa', () => {
    for (const letter of VOWELS) {
      const parts = decomposeSyllable(letter.name.charAt(0));
      expect(parts, letter.name).not.toBeNull();
      expect(parts?.lead).toBe('ㅇ');
      expect(parts?.vowel).toBe(letter.char);
      expect(parts?.tail).toBe('');
    }
  });

  it('dice da quali vocali nascono le composte', () => {
    for (const letter of VOWELS) {
      if (!letter.from) continue;
      const [first, second] = letter.from;
      expect(VOWELS.map((vowel) => vowel.char)).toContain(first);
      expect(VOWELS.map((vowel) => vowel.char)).toContain(second);
    }
    // ㅘ = ㅗ + ㅏ, ㅝ = ㅜ + ㅓ, ㅢ = ㅡ + ㅣ.
    const byChar = new Map(VOWELS.map((vowel) => [vowel.char, vowel]));
    expect(byChar.get('ㅘ')?.from).toEqual(['ㅗ', 'ㅏ']);
    expect(byChar.get('ㅝ')?.from).toEqual(['ㅜ', 'ㅓ']);
    expect(byChar.get('ㅢ')?.from).toEqual(['ㅡ', 'ㅣ']);
  });

  it('conosce tutte le lettere che compongono le sillabe', () => {
    for (const char of [...TABLE_LEADS, ...TABLE_VOWELS, ...TABLE_TAILS]) {
      if (!char) continue;
      expect(jamoInfo(char), char).not.toBeNull();
    }
  });

  it('dà una sillaba leggibile per ogni incrocio della tabella', () => {
    for (const lead of TABLE_LEADS) {
      for (const vowel of TABLE_VOWELS) {
        const syllable = composeSyllable(lead, vowel);
        expect(syllable, `${lead} + ${vowel}`).not.toBeNull();
        expect(decomposeSyllable(syllable ?? '')).toEqual({ lead, vowel, tail: '' });
        expect(romanizeSyllable(syllable ?? '')).not.toBe('');
      }
    }
  });

  it('legge gli esempi come li legge un dizionario', () => {
    const examples: Record<string, string> = {
      가: 'ga',
      까: 'kka',
      나: 'na',
      다: 'da',
      라: 'ra',
      마: 'ma',
      바: 'ba',
      사: 'sa',
      아: 'a',
      자: 'ja',
      차: 'cha',
      카: 'ka',
      타: 'ta',
      파: 'pa',
      하: 'ha',
      따: 'tta',
      빠: 'ppa',
      싸: 'ssa',
      짜: 'jja',
    };
    for (const letter of CONSONANTS) {
      expect(romanizeSyllable(letter.example), letter.example).toBe(examples[letter.example]);
    }
  });

  it('tiene sette suoni finali, tutti con almeno un esempio', () => {
    expect(FINALS).toHaveLength(7);
    for (const final of FINALS) {
      expect(final.letters.length).toBeGreaterThan(0);
      expect(final.examples.length).toBeGreaterThan(0);
      for (const example of final.examples) {
        expect(decomposeSyllable(example.ko.charAt(example.ko.length - 1))).not.toBeNull();
      }
    }
  });

  it('compone anche una sillaba con la finale', () => {
    const syllable = composeSyllable('ㅎ', 'ㅏ', 'ㄴ');
    expect(syllable).toBe('한');
    expect(decomposeSyllable('한')).toEqual({ lead: 'ㅎ', vowel: 'ㅏ', tail: 'ㄴ' });
    // 밥 e 값 finiscono con due lettere diverse ma un solo suono: [p̚].
    expect(decomposeSyllable('밥')?.tail).toBe('ㅂ');
    expect(decomposeSyllable('값')?.tail).toBe('ㅄ');
  });
});
