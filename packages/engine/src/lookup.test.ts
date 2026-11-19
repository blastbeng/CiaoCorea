import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@ciaocorea/shared';
import { lookupWord } from './lookup';

function entry(ko: string, it: string, rr: string): VocabEntry {
  return { ko, it, rr, courseSlug: 'a2', courseTitle: 'A2', lessonId: 'a2-05', lessonTitle: 'Lezione' };
}

const entries = [
  entry('학교', 'scuola', 'hakgyo'),
  entry('먹다', 'mangiare', 'meokda'),
  entry('만나다', 'incontrare', 'mannada'),
  entry('물', 'acqua', 'mul'),
  entry('좋다', 'essere buono', 'jota'),
];

describe('lookupWord', () => {
  it('trova la parola esatta', () => {
    expect(lookupWord(entries, '학교')?.entry.it).toBe('scuola');
  });

  it('toglie la particella', () => {
    expect(lookupWord(entries, '학교에')?.entry.ko).toBe('학교');
    expect(lookupWord(entries, '물을')?.entry.ko).toBe('물');
    expect(lookupWord(entries, '학교에서는')?.entry.ko).toBe('학교');
  });

  it('dice quale particella ha tolto e a che cosa serve', () => {
    const oggetto = lookupWord(entries, '물을');
    expect(oggetto?.particle).toBe('을');
    expect(oggetto?.particleHint).toContain('oggetto');

    const luogo = lookupWord(entries, '학교에서');
    expect(luogo?.particle).toBe('에서');
    expect(luogo?.particleHint).toContain('luogo');

    // 에서 non va letto come 에 seguito da una parola che finisce per 서.
    expect(lookupWord(entries, '학교에서는')?.particle).toBe('에서는');
    expect(lookupWord(entries, '학교')?.particle).toBeUndefined();
  });

  it('riconosce la forma coniugata dalla radice', () => {
    expect(lookupWord(entries, '먹었어요')?.entry.ko).toBe('먹다');
    expect(lookupWord(entries, '만나요')?.entry.ko).toBe('만나다');
    expect(lookupWord(entries, '좋아요')?.entry.ko).toBe('좋다');
  });

  it('dice quale desinenza ha riconosciuto', () => {
    expect(lookupWord(entries, '먹었어요')?.ending).toBe('었');
    expect(lookupWord(entries, '먹었어요')?.particle).toBeUndefined();
  });

  it('non inventa un match quando la parola non c’è', () => {
    expect(lookupWord(entries, '바다')).toBeNull();
    expect(lookupWord(entries, '먹이')).toBeNull();
  });

  it('non scambia un nome con una particella per un verbo', () => {
    expect(lookupWord(entries, '물이')?.entry.ko).toBe('물');
    expect(lookupWord(entries, '학교를')?.entry.ko).toBe('학교');
  });
});
