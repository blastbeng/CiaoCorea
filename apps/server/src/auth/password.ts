import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * promisify() non sa che scrypt accetta le opzioni: senza questo wrapper il
 * costo del KDF (N, r, p) non potrebbe essere passato, e ogni verifica
 * userebbe i parametri di default.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

const PARAMS = { N: 16384, r: 8, p: 1, keyLength: 64, saltLength: 16 } as const;

/**
 * Formato: scrypt$N$r$p$salt$hash, tutto in base64 tranne i parametri.
 * Salvare i parametri nell'hash permette di alzare il costo in futuro senza
 * invalidare le password già registrate.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PARAMS.saltLength);
  const key = (await scrypt(password.normalize('NFKC'), salt, PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
  })) as Buffer;

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(rawSalt ?? '', 'base64');
  const expected = Buffer.from(rawHash ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  const key = (await scrypt(password.normalize('NFKC'), salt, expected.length, { N, r, p })) as Buffer;

  // timingSafeEqual richiede lunghezze uguali: qui lo sono per costruzione.
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const DUMMY_SALT = Buffer.alloc(PARAMS.saltLength, 7);

/**
 * Brucia lo stesso tempo di una verifica vera quando l'email non esiste: senza,
 * un attaccante capisce quali email sono registrate misurando la latenza
 * (user enumeration).
 */
export async function simulateVerify(): Promise<void> {
  await scrypt('password-finta-per-tempi-costanti', DUMMY_SALT, PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
  });
}
