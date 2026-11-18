import { describe, expect, it } from 'vitest';
import { hashPassword, simulateVerify, verifyPassword } from './password';

describe('password', () => {
  it('produce un hash scrypt con parametri e salt distinti', async () => {
    const first = await hashPassword('2fa74lovz');
    const second = await hashPassword('2fa74lovz');

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first).not.toBe(second);
    expect(first.split('$')).toHaveLength(6);
  });

  it('verifica la password corretta e rifiuta quella sbagliata', async () => {
    const hash = await hashPassword('2fa74lovz');
    await expect(verifyPassword('2fa74lovz', hash)).resolves.toBe(true);
    await expect(verifyPassword('2fa74lovZ', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('rifiuta hash malformati senza lanciare eccezioni', async () => {
    await expect(verifyPassword('x', '')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$abc$8$1$AAAA$BBBB')).resolves.toBe(false);
  });

  it('normalizza Unicode: la stessa password digitata in NFD è accettata', async () => {
    const hash = await hashPassword('caffè');
    // "e" + accento combinante invece del carattere precomposto.
    await expect(verifyPassword('caffe\u0300', hash)).resolves.toBe(true);
  });

  it('la verifica finta completa senza errori', async () => {
    await expect(simulateVerify()).resolves.toBeUndefined();
  });
});
