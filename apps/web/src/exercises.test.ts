import { describe, expect, it } from 'vitest';
import { remainingTiles, splitCloze } from './exercises';

const MARKER = '___';

describe('tessere di una frase da rimettere in ordine', () => {
  const words = ['저는', '밥', '먹어요'];

  it('all’inizio le tessere sono tutte disponibili, nell’ordine del curricolo', () => {
    expect(remainingTiles(words, [])).toEqual([
      { word: '저는', index: 0 },
      { word: '밥', index: 1 },
      { word: '먹어요', index: 2 },
    ]);
  });

  it('toglie solo la tessera toccata', () => {
    expect(remainingTiles(words, ['밥'])).toEqual([
      { word: '저는', index: 0 },
      { word: '먹어요', index: 2 },
    ]);
  });

  it('le parole duplicate si consumano una alla volta', () => {
    const conDoppia = ['가', '가', '요'];
    expect(remainingTiles(conDoppia, ['가'])).toEqual([
      { word: '가', index: 1 },
      { word: '요', index: 2 },
    ]);
    expect(remainingTiles(conDoppia, ['가', '가'])).toEqual([{ word: '요', index: 2 }]);
  });

  it('una risposta più lunga delle tessere non fa sparire nulla', () => {
    expect(remainingTiles(words, ['x', 'y', 'z', 'w'])).toHaveLength(3);
  });
});

describe('buchi da completare', () => {
  it('spezza la frase sul marker', () => {
    expect(splitCloze('학교___ 가요.', MARKER)).toEqual({ before: '학교', after: ' 가요.' });
  });

  it('se il marker non c’è, tutta la frase sta prima del buco', () => {
    expect(splitCloze('학교에 가요.', MARKER)).toEqual({ before: '학교에 가요.', after: '' });
  });
});
