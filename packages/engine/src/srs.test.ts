import { describe, expect, it } from 'vitest';
import { FRAGILE_LAPSES, isFragile, reviewDirection, scheduleCard, WRITE_AFTER_REPS } from './srs';

describe('direzione del ripasso', () => {
  it('una parola nuova si legge, non si scrive', () => {
    expect(reviewDirection(0, '밥')).toBe('read');
    expect(reviewDirection(WRITE_AFTER_REPS - 1, '밥')).toBe('read');
  });

  it('dopo due ripassi andati bene si chiede di scriverla', () => {
    expect(reviewDirection(WRITE_AFTER_REPS, '밥')).toBe('write');
    expect(reviewDirection(WRITE_AFTER_REPS + 3, '커피')).toBe('write');
  });

  it('jamo sciolti e frasi restano da leggere', () => {
    expect(reviewDirection(5, 'ㄱ')).toBe('read');
    expect(reviewDirection(5, '안녕하세요?')).toBe('read');
    expect(reviewDirection(5, '몇 시예요')).toBe('read');
  });

  it('un errore riporta la parola alla lettura, perché i reps ripartono da zero', () => {
    const state = { ease: 2.5, intervalDays: 10, reps: 4, lapses: 0 };
    const next = scheduleCard(state, 0, new Date('2026-01-10T10:00:00Z'));
    expect(next.reps).toBe(0);
    expect(reviewDirection(next.reps, '밥')).toBe('read');
  });
});

describe('parole fragili', () => {
  it('un solo errore è distrazione, due sono fragilità', () => {
    expect(isFragile({ lapses: 0 })).toBe(false);
    expect(isFragile({ lapses: FRAGILE_LAPSES - 1 })).toBe(false);
    expect(isFragile({ lapses: FRAGILE_LAPSES })).toBe(true);
    expect(isFragile({ lapses: 7 })).toBe(true);
  });

  it('sono i lapse a contarle, non i ripassi andati bene', () => {
    const starting = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
    const wrong = scheduleCard(starting, 0, new Date('2026-01-10T10:00:00Z'));
    expect(isFragile(wrong)).toBe(false);
    const again = scheduleCard(wrong, 0, new Date('2026-01-11T10:00:00Z'));
    expect(isFragile(again)).toBe(true);

    // Ripassarla bene non la assolve: il conto degli errori resta.
    const good = scheduleCard(again, 2, new Date('2026-01-12T10:00:00Z'));
    expect(isFragile(good)).toBe(true);
  });
});
