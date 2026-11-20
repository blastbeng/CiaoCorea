import { describe, expect, it } from 'vitest';
import {
  isHangulSyllable,
  romanizeSyllable,
  romanizeText,
  romanizeWord,
  romanizationMatches,
} from './romanize';

/**
 * Le mappe di `romanize.ts` sono indicizzate per indice Unicode, non per
 * carattere jamo: questi test sono l'argomento che gli indici sono quelli
 * giusti. Ogni iniziale, ogni vocale e le finali comuni sono scritte come
 * sillabe vere, quindi se un indice fosse spostato il test si rompe.
 */
describe('indici della sillaba', () => {
  it('romanizza ogni iniziale alla sua sillaba', () => {
    const cases: [string, string][] = [
      ['가', 'ga'], ['까', 'kka'], ['나', 'na'], ['다', 'da'], ['라', 'ra'], ['마', 'ma'],
      ['따', 'tta'], ['바', 'ba'], ['빠', 'ppa'], ['사', 'sa'], ['짜', 'jja'],
      ['바', 'ba'], ['사', 'sa'], ['싸', 'ssa'], ['아', 'a'], ['자', 'ja'], ['차', 'cha'],
      ['카', 'ka'], ['타', 'ta'], ['파', 'pa'], ['하', 'ha'],
    ];
    for (const [syllable, expected] of cases) {
      expect(romanizeSyllable(syllable), syllable).toBe(expected);
    }
  });

  it('romanizza ogni vocale alla sua sillaba', () => {
    const cases: [string, string][] = [
      ['아', 'a'], ['애', 'ae'], ['야', 'ya'], ['얘', 'yae'], ['어', 'eo'], ['에', 'e'],
      ['여', 'yeo'], ['예', 'ye'], ['오', 'o'], ['와', 'wa'], ['왜', 'wae'], ['외', 'oe'],
      ['요', 'yo'], ['우', 'u'], ['워', 'wo'], ['웨', 'we'], ['위', 'wi'], ['유', 'yu'],
      ['으', 'eu'], ['의', 'ui'], ['이', 'i'],
    ];
    for (const [syllable, expected] of cases) {
      expect(romanizeSyllable(syllable), syllable).toBe(expected);
    }
  });

  it('romanizza le finali, anche quelle composte', () => {
    const cases: [string, string][] = [
      ['국', 'guk'], ['간', 'gan'], ['왅', 'wan'], ['갇', 'gat'], ['갈', 'gal'],
      ['닭', 'dalk'], ['김', 'gim'], ['입', 'ip'], ['없', 'eop'], ['앗', 'at'],
      ['잇', 'it'], ['광', 'gwang'],
    ];
    for (const [syllable, expected] of cases) {
      expect(romanizeSyllable(syllable), syllable).toBe(expected);
    }
  });
});

describe('parole reali', () => {
  it('rende la forma letterale, quella della scrittura', () => {
    const cases: [string, string][] = [
      ['한국', 'hanguk'], ['한국어', 'hangukeo'], ['감사합니다', 'gamsahapnida'],
      ['수업', 'sueop'], ['아침', 'achim'], ['어제', 'eoje'], ['영화', 'yeonghwa'],
      ['말씀', 'malsseum'], ['연락처', 'yeonrakcheo'], ['메뉴', 'menyu'],
      ['일인분', 'ilinbun'], ['요청', 'yocheong'], ['늦추다', 'neutchuda'],
      ['할머니', 'halmeoni'], ['할아버지', 'halabeoji'], ['꽃잎', 'kkotip'],
      ['옷이', 'oti'], ['읽어요', 'ilkeoyo'], ['쾌차', 'kwaecha'], ['댁', 'daek'],
      ['어려울', 'eoryeoul'], ['원', 'won'], ['학생', 'haksaeng'], ['국민', 'gukmin'],
    ];
    for (const [word, expected] of cases) {
      expect(romanizeWord(word), word).toBe(expected);
    }
  });

  it('lascia in pace ciò che Hangul non è', () => {
    expect(romanizeWord('3층')).toBe('3cheung');
    expect(romanizeWord('café')).toBe('café');
    expect(isHangulSyllable('a')).toBe(false);
    expect(isHangulSyllable('한')).toBe(true);
  });

  it('mantiene gli spazi di un testo', () => {
    expect(romanizeText('할머니가 보고 싶어요')).toBe('halmeoniga bogo sipeoyo');
  });
});

describe('confronto tollerante', () => {
  it('accetta maiuscole e il trattino della RR', () => {
    expect(romanizationMatches('수업', 'su-eop')).toBe(true);
    expect(romanizationMatches('수업', 'Sueop')).toBe(true);
    expect(romanizationMatches('사오', 'sa-o')).toBe(true);
    expect(romanizationMatches('수업', 'sugeom')).toBe(false);
    expect(romanizationMatches('국민', 'gumin')).toBe(false);
  });

  it('accetta la y dopo una consonante e la sua assenza', () => {
    expect(romanizationMatches('메뉴', 'menu')).toBe(true);
    expect(romanizationMatches('메뉴', 'menyu')).toBe(true);
    expect(romanizationMatches('류', 'ryu')).toBe(true);
    expect(romanizationMatches('류', 'ru')).toBe(true);
    expect(romanizationMatches('유', 'yu')).toBe(true);
    // Con l'iniziale muta la y non si può togliere: 유 è yu, non u.
    expect(romanizationMatches('유', 'u')).toBe(false);
  });
});
