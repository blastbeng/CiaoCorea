import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@ciaocorea/shared';
import { analyzeText } from './analyze';

const entries: VocabEntry[] = [
  {
    ko: '커피',
    it: 'caffè',
    rr: 'keopi',
    courseSlug: 'lessico',
    courseTitle: 'Parole di ogni giorno',
    lessonId: 'less-03',
    lessonTitle: 'Cibo e bevande',
  },
  {
    ko: '마시다',
    it: 'bere',
    rr: 'masida',
    courseSlug: 'lessico',
    courseTitle: 'Parole di ogni giorno',
    lessonId: 'less-03',
    lessonTitle: 'Cibo e bevande',
  },
  {
    ko: '학교',
    it: 'scuola',
    rr: 'hakgyo',
    courseSlug: 'lessico',
    courseTitle: 'Parole di ogni giorno',
    lessonId: 'less-02',
    lessonTitle: 'A scuola',
  },
];

describe('analisi di un testo', () => {
  it('conserva spazi e punteggiatura per ridisegnare il testo', () => {
    const analysis = analyzeText(entries, '커피를 마셔요.');
    expect(analysis.tokens.map((token) => token.text)).toEqual(['커피를', ' ', '마셔요', '.']);
    expect(analysis.tokens[0].hangul).toBe(true);
    expect(analysis.tokens[1].hangul).toBe(false);
  });

  it('riconosce una parola con la particella e una con la desinenza', () => {
    const analysis = analyzeText(entries, '커피를 마셔요');
    const [coffee, , drink] = analysis.tokens;

    expect(coffee.match?.ko).toBe('커피');
    expect(coffee.match?.via).toBe('particle');
    expect(coffee.match?.particle).toBe('를');

    expect(drink.match?.ko).toBe('마시다');
    expect(drink.match?.via).toBe('stem');
  });

  it('dice come si legge anche le parole che il corso non conosce', () => {
    const analysis = analyzeText(entries, '학교에 갔어요');
    expect(analysis.tokens[0].reading).toBe('hakgyoe');
    expect(analysis.tokens[2].match).toBeNull();
    expect(analysis.tokens[2].reading).toBe('gasseoyo');
  });

  it('conta le parole e le distinte che restano da imparare', () => {
    const analysis = analyzeText(entries, '학교에 가요. 학교가 좋아요.');
    expect(analysis.words).toBe(4);
    expect(analysis.known).toBe(2);
    expect(analysis.unknown).toEqual(['가요', '좋아요']);
  });

  it('tiene la cifra attaccata alla parola e salta il latino', () => {
    const analysis = analyzeText(entries, '5층, OK');
    expect(analysis.tokens.map((token) => token.text)).toEqual(['5층', ',', ' ', 'OK']);
    expect(analysis.tokens[0].hangul).toBe(true);
    expect(analysis.tokens[3].hangul).toBe(false);
    expect(analysis.words).toBe(1);
  });
});
