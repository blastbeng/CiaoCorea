import { describe, expect, it } from 'vitest';
import { randomUsername, USERNAME_SHAPE } from './usernames';

/**
 * Il nome deve sembrare scelto da qualcuno, non uscire da un generatore di id:
 * la forma è quella, e la forma è quello che un test può controllare.
 */
describe('nomi generati', () => {
  it('stanno sempre nella forma aggettivo + animale + numero', () => {
    for (let i = 0; i < 300; i += 1) {
      expect(randomUsername(() => false)).toMatch(USERNAME_SHAPE);
    }
  });

  it('con una casualità nota sono prevedibili', () => {
    // random() === 0: primo aggettivo, primo animale, numero più basso.
    expect(randomUsername(() => false, () => 0)).toBe('VeloceLepre1');
  });

  it('salgono di spazio dei numeri quando il nome è già preso', () => {
    const taken = (username: string) => username === 'VeloceLepre1';
    expect(randomUsername(taken, () => 0)).toBe('VeloceLepre100');
  });

  it('non si inceppano nemmeno con lo spazio dei numeri esaurito', () => {
    const name = randomUsername(() => true, () => 0);
    expect(name).toMatch(USERNAME_SHAPE);
    expect(name.startsWith('VeloceLepre')).toBe(true);
  });

  it('su 500 profili creati uno dietro l’altro non si ripetono', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const name = randomUsername((username) => seen.has(username));
      expect(seen.has(name)).toBe(false);
      seen.add(name);
    }
    expect(seen.size).toBe(500);
  });
});
