/**
 * PBKDF2-HMAC-SHA256 in TypeScript puro.
 *
 * Serve solo quando `crypto.subtle` non c'è: fuori da un contesto sicuro (HTTPS
 * o localhost) il browser lo nasconde, e un sito aperto via `http://` su una
 * rete locale deve comunque poter creare un profilo. Il risultato è identico a
 * quello di WebCrypto — è lo stesso standard, bit per bit — quindi un hash
 * scritto qui si verifica là, e viceversa.
 */

import { sha256 } from './sha256';

const BLOCK_BYTES = 64;
const HASH_BYTES = 32;

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const shortKey = key.length > BLOCK_BYTES ? sha256(key) : key;
  const padded = new Uint8Array(BLOCK_BYTES);
  padded.set(shortKey);

  const outer = new Uint8Array(BLOCK_BYTES);
  const inner = new Uint8Array(BLOCK_BYTES + message.length);
  for (let i = 0; i < BLOCK_BYTES; i += 1) {
    inner[i] = padded[i]! ^ 0x36;
    outer[i] = padded[i]! ^ 0x5c;
  }
  inner.set(message, BLOCK_BYTES);

  const innerHash = sha256(inner);
  const full = new Uint8Array(BLOCK_BYTES + HASH_BYTES);
  full.set(outer);
  full.set(innerHash, BLOCK_BYTES);
  return sha256(full);
}

export function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyBytes = HASH_BYTES,
): Uint8Array {
  const out = new Uint8Array(keyBytes);
  const blocks = Math.ceil(keyBytes / HASH_BYTES);

  for (let block = 1; block <= blocks; block += 1) {
    const seed = new Uint8Array(salt.length + 4);
    seed.set(salt);
    new DataView(seed.buffer).setUint32(salt.length, block);

    let u = hmacSha256(password, seed);
    const accumulated = new Uint8Array(u);

    for (let round = 1; round < iterations; round += 1) {
      u = hmacSha256(password, u);
      for (let i = 0; i < HASH_BYTES; i += 1) accumulated[i]! ^= u[i]!;
    }

    const offset = (block - 1) * HASH_BYTES;
    out.set(accumulated.subarray(0, Math.min(HASH_BYTES, keyBytes - offset)), offset);
  }

  return out;
}
