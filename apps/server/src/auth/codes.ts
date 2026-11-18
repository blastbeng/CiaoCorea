import { createHash, randomInt } from 'node:crypto';

/**
 * Codici di invito. L'alfabeto esclude le forme ambigue (I/O e 1/0): un codice
 * copiato a mano da lavagna o da un messaggio non deve dipendere da come si
 * legge un carattere. Dodici simboli su 32 sono ~60 bit, più che sufficienti
 * per un servizio con poche decine di account, e il confronto avviene sempre
 * sull'hash: nel database un codice rubato non è riutilizzabile.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUP_SIZE = 4;
const GROUPS = 3;

export function generateInviteCode(): string {
  const chars = Array.from({ length: GROUP_SIZE * GROUPS }, () =>
    ALPHABET.charAt(randomInt(ALPHABET.length)),
  );
  const groups = [];
  for (let i = 0; i < chars.length; i += GROUP_SIZE) groups.push(chars.slice(i, i + GROUP_SIZE).join(''));
  return groups.join('-');
}

/**
 * Rimette in forma un codice scritto dall'utente: maiuscole, spazi e trattini
 * sono decorazione, non contenuto, quindi "ab cd-efgh jklm" e "ABCDEFGHIJKLM"
 * devono indicare lo stesso invito.
 */
export function normalizeInviteCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .trim();
}

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(normalizeInviteCode(code)).digest('hex');
}

/** True se la forma normalizzata ha la lunghezza di un codice generato qui. */
export function isInviteCodeShape(value: string): boolean {
  const compact = normalizeInviteCode(value);
  return compact.length === GROUP_SIZE * GROUPS && [...compact].every((c) => ALPHABET.includes(c));
}
