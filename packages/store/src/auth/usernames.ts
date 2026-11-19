import { randomBytes } from '../crypto/random';

/**
 * Il nome di un profilo che nasce da solo.
 *
 * Il portale non chiede di registrarsi: il profilo appare la prima volta che
 * si apre il sito, e serve un nome che (a) non richieda all'utente di inventare
 * niente, (b) distinguano due studenti sullo stesso computer, (c) si leggano
 * senza chiedere l'ortografia. Da qui lo schema di Reddit, aggettivo + animale
 * + numero, in italiano: `VeloceLepre7`.
 *
 * Gli aggettivi sono tutti in `-e/-ante/-ile`: in italiano valgono per ogni
 * genere, così `FedeleBalena3` non suona mai sbagliato.
 */

const ADJECTIVES = [
  'Veloce',
  'Forte',
  'Gentile',
  'Agile',
  'Nobile',
  'Felice',
  'Grande',
  'Speciale',
  'Leale',
  'Fedele',
  'Tenace',
  'Costante',
  'Vivace',
  'Sottile',
  'Feroce',
  'Lieve',
  'Enorme',
  'Moderno',
  'Audace',
  'Sagace',
  'Solerte',
  'Ardente',
  'Lucente',
  'Vibrante',
  'Pulsante',
  'Danzante',
  'Viaggiante',
  'Navigante',
  'Risonante',
  'Splendente',
  'Resistente',
  'Brillante',
  'Elegante',
  'Importante',
  'Sorprendente',
  'Originale',
  'Geniale',
  'Essenziale',
  'Fondamentale',
  'Arguto',
] as const;

const ANIMALS = [
  'Lepre',
  'Tigre',
  'Volpe',
  'Lince',
  'Lontra',
  'Delfino',
  'Balena',
  'Rondine',
  'Gufo',
  'Falco',
  'Aquila',
  'Picchio',
  'Cigno',
  'Airone',
  'Istrice',
  'Scoiattolo',
  'Castoro',
  'Riccio',
  'Capriolo',
  'Cervo',
  'Cinghiale',
  'Cammello',
  'Daino',
  'Stambecco',
  'Puzzola',
  'Donnola',
  'Martora',
  'Granchio',
  'Gambero',
  'Seppia',
  'Pinguino',
  'Papero',
  'Germano',
  'Tacchino',
  'Struzzo',
  'Fenicottero',
  'Cavallo',
  'Asino',
  'Gatto',
  'Cane',
] as const;

/**
 * Il numero tiene separati i profili che prendono la stessa coppia di parole.
 * Si sale di ordine di grandezza quando lo spazio da 1 a 99 è già occupato: su
 * un browser con dieci profili non succede mai, ma la funzione non deve
 * potersi inceppare.
 */
const RANGES = [
  { min: 1, max: 99 },
  { min: 100, max: 999 },
  { min: 1000, max: 9999 },
] as const;

const SUFFIX_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function pick(list: readonly string[], random: () => number): string {
  const index = Math.min(list.length - 1, Math.floor(random() * list.length));
  return list[index]!;
}

function number(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function entropySuffix(): string {
  const bytes = randomBytes(3);
  let out = '';
  for (const byte of bytes) out += SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length]!;
  return out;
}

/**
 * Un nome non ancora usato su questo computer. `taken` è la domanda al
 * database: la forma `VeloceLepre7` viene riproposta finché non è libera.
 */
export function randomUsername(
  taken: (username: string) => boolean,
  random: () => number = Math.random,
): string {
  for (const range of RANGES) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const candidate = `${pick(ADJECTIVES, random)}${pick(ANIMALS, random)}${number(
        range.min,
        range.max,
        random,
      )}`;
      if (!taken(candidate)) return candidate;
    }
  }

  // Uno spazio di nomi esaurito: qui l'entropia vera batte la cortesia.
  return `${pick(ADJECTIVES, random)}${pick(ANIMALS, random)}${entropySuffix()}`;
}

/** La forma che il generatore produce, per validare e per i test. */
export const USERNAME_SHAPE = /^[A-Z][a-z]+[A-Z][a-z]+[0-9a-z]{1,10}$/;
