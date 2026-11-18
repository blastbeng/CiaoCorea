import { describe, expect, it } from 'vitest';
import { reviewDirection, scheduleCard, WRITE_AFTER_REPS } from './srs';

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
