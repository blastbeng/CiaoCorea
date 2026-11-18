import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@ciaocorea/shared';
import { searchVocabulary, vocabFacets } from './vocabulary';

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
    ko: '카페',
    it: 'caffetteria',
    rr: 'kafe',
    courseSlug: 'lessico',
    courseTitle: 'Parole di ogni giorno',
    lessonId: 'less-03',
    lessonTitle: 'Cibo e bevande',
  },
  {
    ko: '기차',
    it: 'treno',
    rr: 'gicha',
    courseSlug: 'lessico',
    courseTitle: 'Parole di ogni giorno',
    lessonId: 'less-04',
    lessonTitle: 'Numeri e prezzi',
  },
  {
    ko: '가다',
    it: 'andare',
    rr: 'gada',
    courseSlug: 'grammatica',
    courseTitle: 'Frasi che stanno in piedi',
    lessonId: 'gram-03',
    lessonTitle: 'Presente cortese',
  },
  {
    ko: '가족',
    it: 'famiglia',
    rr: 'gajok',
    courseSlug: 'lessico',
    courseTitle: 'Parole di ogni giorno',
    lessonId: 'less-01',
    lessonTitle: 'La famiglia',
  },
];

function koOf(result: { entries: VocabEntry[] }): string[] {
  return result.entries.map((entry) => entry.ko);
}

describe('dizionario: ricerca', () => {
  it('trova per forma coreana', () => {
    const found = searchVocabulary(entries, { query: '커피' });
    expect(found.total).toBe(1);
    expect(koOf(found)).toEqual(['커피']);
  });

  it('trova per romanizzazione', () => {
    expect(koOf(searchVocabulary(entries, { query: 'kafe' }))).toEqual(['카페']);
  });

  it('trova per significato italiano, senza accenti e senza maiuscole', () => {
    expect(koOf(searchVocabulary(entries, { query: 'CAFFETTERIA' }))).toEqual(['카페']);
  });

  it('la romanizzazione non si confonde con il significato', () => {
    // keopi è la trascrizione di 커피:카페 è un'altra parola, non una variante.
    expect(koOf(searchVocabulary(entries, { query: 'keopi' }))).toEqual(['커피']);
  });

  it('antepone il match esatto e il match all\'inizio del coreano', () => {
    const found = searchVocabulary(entries, { query: '가다' });
    expect(koOf(found)[0]).toBe('가다');
    expect(found.entries[0]?.it).toBe('andare');
  });

  it('richiede che tutti i token matchino', () => {
    expect(searchVocabulary(entries, { query: 'caffè treno' }).total).toBe(0);
    expect(koOf(searchVocabulary(entries, { query: 'caffè keopi' }))).toEqual(['커피']);
  });

  it('ignora gli articoli italiani', () => {
    expect(searchVocabulary(entries, { query: 'il caffè' }).total).toBe(
      searchVocabulary(entries, { query: 'caffè' }).total,
    );
  });

  it('un campo vuoto restituisce tutto il dizionario', () => {
    const all = searchVocabulary(entries, {});
    expect(all.total).toBe(entries.length);
    expect(all.entries).toHaveLength(entries.length);
  });

  it('ordina in modo stabile a parità di punteggio', () => {
    const first = koOf(searchVocabulary(entries, {}));
    const second = koOf(searchVocabulary(entries, {}));
    expect(first).toEqual(second);
  });

  it('taglia la pagina senza cambiare il totale', () => {
    const page = searchVocabulary(entries, { limit: 2, offset: 2 });
    expect(page.entries).toHaveLength(2);
    expect(page.total).toBe(entries.length);
  });

  it('filtra per corso', () => {
    const grammar = searchVocabulary(entries, { courseSlug: 'grammatica' });
    expect(koOf(grammar)).toEqual(['가다']);
    expect(grammar.total).toBe(1);
  });

  it('il filtro per corso si combina con la ricerca', () => {
    expect(koOf(searchVocabulary(entries, { query: 'ga', courseSlug: 'grammatica' }))).toEqual(['가다']);
    // 가족 si cerca 'ga' nella romanizzazione (gajok): resta nel suo corso.
    expect(koOf(searchVocabulary(entries, { query: 'ga', courseSlug: 'lessico' }))).toEqual(['가족']);
    expect(searchVocabulary(entries, { query: 'caffè', courseSlug: 'grammatica' }).total).toBe(0);
  });
});

describe('dizionario: contaggi per corso', () => {
  it('elenca i corsi nell\'ordine del curricolo con le voci di ciascuno', () => {
    expect(vocabFacets(entries)).toEqual([
      { slug: 'lessico', title: 'Parole di ogni giorno', count: 4 },
      { slug: 'grammatica', title: 'Frasi che stanno in piedi', count: 1 },
    ]);
  });

  it('i contaggi seguono la ricerca, non il dizionario intero', () => {
    const searched = searchVocabulary(entries, { query: 'a' });
    const counts = vocabFacets(searched.entries).reduce((sum, facet) => sum + facet.count, 0);
    expect(counts).toBe(searched.total);
  });
});
