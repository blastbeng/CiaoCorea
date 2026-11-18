import { describe, expect, it } from 'vitest';
import type { WritingPrompt } from '@ciaocorea/shared';
import { checkWriting, editDistance, similarity } from './writing';

const prompt: WritingPrompt = {
  id: 'w-test',
  courseSlug: 'grammatica',
  lessonId: 'gram-01',
  title: 'Chi sei',
  task: 'Presentati: scrivi «Sono uno studente.»',
  words: ['저는', '학생', '이에요'],
  must: ['저는', '학생'],
  model: '저는 학생이에요.',
  alt: ['저는 학생입니다.'],
  notes: '학생 ha il 받침, quindi 이에요.',
};

describe('misura della distanza', () => {
  it('conta le modifiche carattere per carattere', () => {
    expect(editDistance('밥', '밥')).toBe(0);
    expect(editDistance('밥', '집')).toBe(1);
    expect(editDistance('바다', '바다')).toBe(0);
    expect(editDistance('', '밥')).toBe(1);
  });

  it('ignora spazi e punteggiatura finale nella somiglianza', () => {
    expect(similarity('저는 학생이에요', '저는 학생이에요.')).toBe(1);
    expect(similarity('저는학생이에요', '저는 학생이에요')).toBe(1);
  });
});

describe('controllo di un testo del quaderno', () => {
  it('riconosce il testo identico al modello, anche senza punteggiatura', () => {
    const check = checkWriting(prompt, '저는 학생이에요');
    expect(check.verdict).toBe('model');
    expect(check.missing).toEqual([]);
    expect(check.similarity).toBe(1);
  });

  it('accetta le varianti altrettanto corrette', () => {
    expect(checkWriting(prompt, '저는 학생입니다.').verdict).toBe('model');
  });

  it('dice che cosa manca invece di dare solo una percentuale', () => {
    const check = checkWriting(prompt, '학생이에요');
    expect(check.missing).toEqual(['저는']);
    expect(check.verdict).toBe('far');
  });

  it('considera vicino un testo con una parola sbagliata ma tutte le forme', () => {
    const check = checkWriting(prompt, '저는 학생이에요요');
    expect(check.missing).toEqual([]);
    expect(check.similarity).toBeGreaterThan(0.8);
    expect(check.verdict).toBe('close');
  });

  it('tratta il vuoto come un testo ancora da scrivere', () => {
    const check = checkWriting(prompt, '   ');
    expect(check.verdict).toBe('far');
    expect(check.similarity).toBe(0);
    expect(check.missing).toEqual(['저는', '학생']);
  });

  it('non si fa ingannare dai jamo di compatibilità', () => {
    // ㅂㅏㄷㅏ è «바다» scritto come jamo separati: la tastiera può produrlo.
    const mare: WritingPrompt = { ...prompt, must: [], model: '바다', alt: undefined };
    expect(checkWriting(mare, 'ㅂㅏㄷㅏ').verdict).toBe('model');
  });

  it('restituisce sempre il modello e la spiegazione', () => {
    const check = checkWriting(prompt, '몰라요');
    expect(check.model).toBe('저는 학생이에요.');
    expect(check.notes).toContain('받침');
  });
});
