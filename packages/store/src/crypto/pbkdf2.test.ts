import { pbkdf2Sync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../auth/password';
import { pbkdf2Sha256 } from './pbkdf2';

const encoder = new TextEncoder();

describe('pbkdf2Sha256', () => {
  const cases: Array<{ password: string; salt: string; iterations: number; keyBytes: number }> = [
    { password: 'corea12345', salt: '0123456789abcdef', iterations: 1, keyBytes: 32 },
    { password: 'blast', salt: 'sale-casuale', iterations: 1000, keyBytes: 32 },
    { password: '한국어', salt: 'caffè', iterations: 2500, keyBytes: 32 },
    { password: 'x'.repeat(200), salt: 'a', iterations: 500, keyBytes: 64 },
  ];

  for (const { password, salt, iterations, keyBytes } of cases) {
    it(`coincide con node:crypto (${iterations} iterazioni, ${keyBytes} byte)`, () => {
      const actual = pbkdf2Sha256(encoder.encode(password), encoder.encode(salt), iterations, keyBytes);
      const expected = pbkdf2Sync(password, salt, iterations, keyBytes, 'sha256');
      expect(Buffer.from(actual).equals(expected)).toBe(true);
    });
  }
});

describe('password senza crypto.subtle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crea e verifica un hash in TypeScript puro, e lo rilegge con WebCrypto', async () => {
    const webcrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => webcrypto.getRandomValues(array),
    });

    const stored = await hashPassword('corea12345');
    expect(stored.startsWith('pbkdf2$sha256$60000$')).toBe(true);
    expect(await verifyPassword('corea12345', stored)).toBe(true);
    expect(await verifyPassword('sbagliata', stored)).toBe(false);

    vi.unstubAllGlobals();
    expect(await verifyPassword('corea12345', stored)).toBe(true);
  }, 30_000);
});
