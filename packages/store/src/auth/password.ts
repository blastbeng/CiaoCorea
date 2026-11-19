import { pbkdf2Sha256 } from '../crypto/pbkdf2';
import { randomBytes } from '../crypto/random';

/**
 * Le password di un database che vive nel browser valgono quanto la scheda:
 * chi apre gli strumenti di sviluppo vede tutto. Restano comunque degli hash
 * PBKDF2, perché un account è un'abitudine di studio condivisa su un computer
 * di casa, e la password non deve essere leggibile in chiaro a chi passa di lì.
 *
 * Il formato è `pbkdf2$sha256$<iterazioni>$<sale>$<hash>`, tutto in base64
 * tranne i parametri: alzare il costo in futuro non invalida le password già
 * scritte.
 */

const ITERATIONS = 210_000;
/**
 * Fuori da un contesto sicuro (HTTPS o localhost) il browser non espone
 * `crypto.subtle` e il calcolo scende in TypeScript puro: 210 000 iterazioni
 * costerebbero ~4 s, sessanta mila ~1 s. Su un database che vive nel browser la
 * differenza di robustezza è teorica; il costo resta scritto nell'hash, quindi
 * ogni password si verifica con il numero di iterazioni con cui è nata.
 */
const PBKDF2_JS_ITERATIONS = 60_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function hasSubtle(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** WebCrypto vuole una vista su un ArrayBuffer normale: la copia lo garantisce. */
function bufferOf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.length));
  copy.set(bytes);
  return copy;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const normalized = new TextEncoder().encode(password.normalize('NFKC'));

  if (!hasSubtle()) return pbkdf2Sha256(normalized, salt, iterations, KEY_BYTES);

  const key = await crypto.subtle.importKey(
    'raw',
    normalized,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bufferOf(salt), iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const iterations = hasSubtle() ? ITERATIONS : PBKDF2_JS_ITERATIONS;
  const hash = await derive(password, salt, iterations);
  return ['pbkdf2', 'sha256', String(iterations), toBase64(salt), toBase64(hash)].join('$');
}

/** Confronto a tempo costante: non serve contro un attaccante locale, ma è la forma giusta. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;

  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;

  const salt = fromBase64(parts[3] ?? '');
  const expected = fromBase64(parts[4] ?? '');
  if (salt.length === 0 || expected.length === 0) return false;

  const hash = await derive(password, salt, iterations);
  return equal(hash, expected);
}
