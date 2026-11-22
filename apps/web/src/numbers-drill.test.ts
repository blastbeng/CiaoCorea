import { describe, expect, it } from 'vitest';
import { readNumber, spellNumber } from '@ciaocorea/engine';
import { NUMBER_MODES, answerValue, buildQuestion, type NumberMode } from './numbers-drill';

/** Un generatore deterministico: le stesse domande a ogni esecuzione. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const MODES: NumberMode[] = NUMBER_MODES.map((mode) => mode.id);

describe('le domande del trainer dei numeri', () => {
  it('ha una sola risposta giusta fra quattro, diverse fra loro', () => {
    for (const mode of MODES) {
      const random = seeded(7);
      for (let i = 0; i < 200; i += 1) {
        const question = buildQuestion(mode, random);
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
        expect(question.options.filter((option) => option === question.answer)).toHaveLength(1);
        expect(question.answer.trim()).toBe(question.answer);
        // Il riempitivo di emergenza non deve mai arrivare sullo schermo.
        expect(question.options.some((option) => / [1-3]$/.test(option))).toBe(false);
        expect(question.note.length).toBeGreaterThan(10);
      }
    }
  });

  it('scrive le cifre sino-coreane che dicono la domanda', () => {
    const random = seeded(11);
    for (let i = 0; i < 100; i += 1) {
      const question = buildQuestion('sino', random);
      const value = Number(question.prompt.replaceAll('.', ''));
      expect(answerValue(question)).toBe(value);
      expect(question.answer).not.toContain(' ');
    }
  });

  it('non offre mai la serie sbagliata come risposta buona dei contatori', () => {
    const random = seeded(19);
    for (let i = 0; i < 100; i += 1) {
      const question = buildQuestion('nativo', random);
      const value = Number(question.prompt.split(' ')[0]!.replaceAll('.', ''));
      expect(question.answer.startsWith(`${spellNumber(value, 'native')} `)).toBe(true);
      // La serie sbagliata compare però fra i distrattori: è l'errore da vedere.
      expect(question.options.some((option) => /^[일이삼사오육칠팔구십]+\s/.test(option))).toBe(true);
    }
  });

  it("legge l'ora col nativo e i minuti col sino", () => {
    const random = seeded(23);
    for (let i = 0; i < 100; i += 1) {
      const question = buildQuestion('orario', random);
      const [hour] = question.prompt.split(':');
      const hourValue = Number(hour);
      expect(question.answer).toContain('시');
      expect(question.answer.startsWith('한 시') || question.answer.startsWith('두 시')).toBe(
        hourValue === 1 || hourValue === 2,
      );
      expect(question.answer).not.toContain('일 시');
      expect(question.answer).not.toContain('이 시');
    }
  });

  it('non offre come sbagliata una lettura che vale lo stesso numero', () => {
    const random = seeded(37);
    for (let i = 0; i < 100; i += 1) {
      const question = buildQuestion('prezzo', random);
      const value = readNumber(question.answer.slice(0, -2).replaceAll(' ', ''))?.value;
      for (const option of question.options) {
        if (option === question.answer) continue;
        expect(readNumber(option.slice(0, -2).replaceAll(' ', ''))?.value).not.toBe(value);
      }
    }
  });

  it('raggruppa i prezzi a diecimila e chiude col won', () => {
    const random = seeded(29);
    for (let i = 0; i < 100; i += 1) {
      const question = buildQuestion('prezzo', random);
      expect(question.answer.endsWith(' 원')).toBe(true);
      const body = question.answer.slice(0, -2);
      const value = Number(question.prompt.replace('원', '').replaceAll('.', ''));
      expect(readNumber(body.replaceAll(' ', ''))?.value).toBe(value);
      if (value >= 20_000) expect(body).toMatch(/만/);
      if (value >= 10_000 && value < 20_000) expect(body.startsWith('만 ')).toBe(true);
    }
  });

  it('dette i numeri di telefono una cifra per volta', () => {
    const random = seeded(31);
    for (let i = 0; i < 100; i += 1) {
      const question = buildQuestion('telefono', random);
      const digits = question.prompt.replaceAll('-', '');
      expect(question.answer.replaceAll(' ', '')).toHaveLength(digits.length);
      expect(question.answer).not.toMatch(/[0-9]/);
      expect(question.answer.replaceAll(' ', '')).toBe(
        [...digits].map((digit) => '공일이삼사오육칠팔구'[Number(digit)]).join(''),
      );
    }
  });
});
