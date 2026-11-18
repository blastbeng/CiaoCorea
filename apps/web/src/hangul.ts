/**
 * Compositore Hangul per la tastiera su schermo.
 *
 * Chi impara non ha l'Hangul installato e preme i jamo uno per uno: la
 * sequenza va impacchettata in sillabe come farebbe un IME coreano. Le regole
 * che contano davvero qui sono tre: una consonante dopo una vocale diventa
 * 받침; una vocale dopo un 받침 sposta il 받침 nella sillaba successiva; un
 * 받침 doppio si divide. Senza queste, "한국" richiederebbe un tasto
 * "a capo" che nessuno studente capirebbe.
 */

const INITIALS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const MEDIALS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const FINAL_INDEX: Record<string, number> = {
  'ㄱ': 1, 'ㄲ': 2, 'ㄳ': 3, 'ㄴ': 4, 'ㄵ': 5, 'ㄶ': 6, 'ㄷ': 7,
  'ㄹ': 8, 'ㄺ': 9, 'ㄻ': 10, 'ㄼ': 11, 'ㄽ': 12, 'ㄾ': 13, 'ㄿ': 14,
  'ㅀ': 15, 'ㅁ': 16, 'ㅂ': 17, 'ㅄ': 18, 'ㅅ': 19, 'ㅆ': 20, 'ㅇ': 21,
  'ㅈ': 22, 'ㅊ': 23, 'ㅋ': 24, 'ㅌ': 25, 'ㅍ': 26, 'ㅎ': 27,
};

const CONSONANTS = new Set([...INITIALS, ...Object.keys(FINAL_INDEX)]);
const VOWELS = new Set(MEDIALS);

/** I 받침 doppi si spezzano: la prima resta, la seconda apre la sillaba. */
const SPLIT_FINAL: Record<string, [string, string]> = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
};

interface Block {
  initial: string;
  vowel?: string;
  final?: string;
}

function render(block: Block): string {
  if (!block.vowel) return block.initial;

  const initial = INITIALS.indexOf(block.initial);
  const vowel = MEDIALS.indexOf(block.vowel);
  if (initial < 0 || vowel < 0) {
    return `${block.initial}${block.vowel}${block.final ?? ''}`;
  }

  const final = block.final ? (FINAL_INDEX[block.final] ?? 0) : 0;
  return String.fromCharCode(0xac00 + (initial * 21 + vowel) * 28 + final);
}

/**
 * Trasforma una sequenza di jamo (compatibilità o già sillabe) in testo
 * coreano composto. I caratteri che non sono jamo passano intatti, così si
 * possono mescolare tastiera fisica e tastiera su schermo.
 */
export function composeHangul(raw: string): string {
  const out: string[] = [];
  let block: Block | null = null;

  const flush = () => {
    if (block) {
      out.push(render(block));
      block = null;
    }
  };

  for (const char of Array.from(raw)) {
    if (CONSONANTS.has(char)) {
      // Consonante dopo vocale, senza 받침: diventa 받침 se la lingua lo
      // permette (ㄸ, ㅃ, ㅉ no).
      if (block?.vowel && !block.final && FINAL_INDEX[char] !== undefined) {
        block.final = char;
        continue;
      }
      flush();
      block = { initial: char };
      continue;
    }

    if (VOWELS.has(char)) {
      if (block && !block.vowel) {
        block.vowel = char;
        continue;
      }
      if (block?.vowel && block.final) {
        const split: [string, string] | undefined = SPLIT_FINAL[block.final];
        if (split) {
          block.final = split[0];
          flush();
          block = { initial: split[1], vowel: char };
        } else {
          const moved: string = block.final;
          block.final = undefined;
          flush();
          block = { initial: moved, vowel: char };
        }
        continue;
      }
      // Vocale senza consonante: si appoggia a ㅇ muta, come nella scrittura.
      flush();
      block = { initial: 'ㅇ', vowel: char };
      continue;
    }

    flush();
    out.push(char);
  }

  flush();
  return out.join('');
}

/** Toglie l'ultimo carattere digitato, jamo o sillaba che sia. */
export function dropLast(raw: string): string {
  const chars = Array.from(raw);
  chars.pop();
  return chars.join('');
}
