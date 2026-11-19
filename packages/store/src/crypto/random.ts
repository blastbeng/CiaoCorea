/**
 * Casualità dal crypto del browser. Il database vive nella scheda, ma gli id e
 * i token devono restare imprevedibili: `Math.random()` non basta nemmeno per
 * un'app locale, perché un id prevedibile è un id che qualcun altro può
 * indovinare in un backup condiviso.
 */

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += HEX[byte >>> 4]! + HEX[byte & 0x0f]!;
  return out;
}

/** UUID v4 dai byte casuali: `crypto.randomUUID` c'è, ma solo in HTTPS. */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = toHex(bytes);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Token casuale in base64url, come quello che il server scriveva nel cookie. */
export function randomToken(size = 32): string {
  const bytes = randomBytes(size);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64URL[(chunk >>> 18) & 63]!;
    if (i + 1 < bytes.length) out += BASE64URL[(chunk >>> 12) & 63]!;
    if (i + 2 < bytes.length) out += BASE64URL[(chunk >>> 6) & 63]!;
    if (i + 3 < bytes.length) out += BASE64URL[chunk & 63]!;
  }
  return out;
}
