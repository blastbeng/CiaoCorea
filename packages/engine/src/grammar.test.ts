import { describe, expect, it } from 'vitest';
import type { GrammarEntry } from '@ciaocorea/shared';
import { grammarFacets, searchGrammar } from './grammar';

const entry = (over: Partial<GrammarEntry>): GrammarEntry => ({
  id: 'x#1',
  point: '',
  courseSlug: 'a2',
  courseTitle: 'A2',
  level: 'A2',
  lessonId: 'a2-04',
  lessonTitle: 'Collegare le frasi',
  lessonTitleKo: '연결',
  keywords: [],
  ...over,
});

const ENTRIES: GrammarEntry[] = [
  entry({
    id: 'a2-04#2',
    point: '-지만 introduce un contrasto: 비싸지만 맛있어요 «è caro ma buono».',
    keywords: ['-지만', '비싸지만', '맛있어요'],
  }),
  entry({
    id: 'a3-06#1',
    point: 'Con i verbi al presente si usa -는 것 같다: 비가 오는 것 같아요.',
    courseSlug: 'capacita',
    courseTitle: '능력과 경험',
    lessonId: 'a3-06',
    lessonTitle: 'Sembra che',
    lessonTitleKo: '비가 올 것 같아요',
    keywords: ['-는 것 같다', '비가 오는 것 같아요'],
  }),
  entry({
    id: 'hangul-03#1',
    point: 'Il 받침 è la consonante finale di una sillaba: 국 si legge [국].',
    courseSlug: 'hangul',
    courseTitle: 'Hangul',
    level: 'A0',
    lessonId: 'hangul-03',
    lessonTitle: 'I blocchi',
    lessonTitleKo: '받침',
    keywords: ['받침', '국'],
  }),
];

describe('searchGrammar', () => {
  it('trova una forma coreana citata nel punto', () => {
    const found = searchGrammar(ENTRIES, { query: '것 같다' });
    expect(found.total).toBe(1);
    expect(found.entries[0].id).toBe('a3-06#1');
  });

  it('cerca anche nelle parole del titolo della lezione', () => {
    const found = searchGrammar(ENTRIES, { query: '받침' });
    expect(found.total).toBe(1);
    expect(found.entries[0].lessonId).toBe('hangul-03');
  });

  it('richiede tutte le parole cercate', () => {
    expect(searchGrammar(ENTRIES, { query: 'caro contrasto' }).total).toBe(1);
    expect(searchGrammar(ENTRIES, { query: 'caro 받침' }).total).toBe(0);
  });

  it('filtra per corso', () => {
    const found = searchGrammar(ENTRIES, { courseSlug: 'capacita' });
    expect(found.total).toBe(1);
    expect(found.entries[0].courseSlug).toBe('capacita');
  });

  it('non distingue maiuscole né trattini ai bordi', () => {
    expect(searchGrammar(ENTRIES, { query: '—지만' }).total).toBe(1);
    expect(searchGrammar(ENTRIES, { query: 'CARO' }).total).toBe(1);
  });

  it('pagina i risultati e riporta il totale vero', () => {
    const all = searchGrammar(ENTRIES, { limit: 2 });
    expect(all.total).toBe(3);
    expect(all.entries).toHaveLength(2);

    const rest = searchGrammar(ENTRIES, { limit: 2, offset: 2 });
    expect(rest.total).toBe(3);
    expect(rest.entries).toHaveLength(1);
  });

  it('con una ricerca vuota restituisce tutto', () => {
    expect(searchGrammar(ENTRIES, {}).entries).toHaveLength(3);
  });
});

describe('grammarFacets', () => {
  it('conta le voci per corso, senza duplicare i corsi', () => {
    const facets = grammarFacets([...ENTRIES, entry({ id: 'a2-04#3' })]);
    const a2 = facets.find((facet) => facet.slug === 'a2');
    expect(a2?.count).toBe(2);
    expect(facets).toHaveLength(3);
  });
});
