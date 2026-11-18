import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('rate limiter', () => {
  it('consente fino al limite e poi blocca', () => {
    let now = 0;
    const limiter = createRateLimiter(3, 60_000, () => now);

    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(true);

    const blocked = limiter.hit('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('separa le chiavi e riapre dopo la finestra', () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1000, () => now);

    expect(limiter.hit('ip:1').allowed).toBe(true);
    expect(limiter.hit('ip:1').allowed).toBe(false);
    expect(limiter.hit('ip:2').allowed).toBe(true);

    now = 1001;
    expect(limiter.hit('ip:1').allowed).toBe(true);
  });

  it('reset azzera un singolo contatore o tutti', () => {
    const limiter = createRateLimiter(1, 1000);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
    limiter.reset('a');
    expect(limiter.hit('a').allowed).toBe(true);
    limiter.reset();
    expect(limiter.hit('b').allowed).toBe(true);
  });
});
