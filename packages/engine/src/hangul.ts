/**
 * Le sillabe hangul sono un alfabeto componibile: ogni blocco è una consonante
 * iniziale, una vocale e una consonante finale, in un solo code point. Qui
 * servono a una cosa sola — riconoscere le forme contratte dei verbi, dove
 * 지 + 었 diventa 졌 e 하 + 았 diventa 했.
 */

const LEADS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWELS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const TAILS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const BASE = 0xac00;
const LAST = 0xd7a3;

export interface Syllable {
  lead: string;
  vowel: string;
  /** La consonante finale; stringa vuota quando la sillaba è aperta. */
  tail: string;
}

export function decompose(char: string): Syllable | null {
  const code = char.codePointAt(0);
  if (code === undefined || code < BASE || code > LAST) return null;
  const index = code - BASE;
  return {
    lead: LEADS[Math.floor(index / 588)],
    vowel: VOWELS[Math.floor((index % 588) / 28)],
    tail: TAILS[index % 28],
  };
}

export function compose(lead: string, vowel: string, tail = ''): string | null {
  const leadIndex = LEADS.indexOf(lead);
  const vowelIndex = VOWELS.indexOf(vowel);
  const tailIndex = TAILS.indexOf(tail);
  if (leadIndex < 0 || vowelIndex < 0 || tailIndex < 0) return null;
  return String.fromCodePoint(BASE + leadIndex * 588 + vowelIndex * 28 + tailIndex);
}

/**
 * Come si fondono due vocali quando una desinenza si attacca alla radice:
 * 오 + 아 = 와, 주 + 어 = 줘, 지 + 어 = 져, 하 + 아 = 해.
 */
const FUSION: Record<string, string> = {
  'ㅏㅏ': 'ㅏ',
  'ㅓㅓ': 'ㅓ',
  'ㅗㅏ': 'ㅘ',
  'ㅜㅓ': 'ㅝ',
  'ㅣㅓ': 'ㅕ',
  'ㅔㅓ': 'ㅔ',
  'ㅐㅓ': 'ㅐ',
  'ㅐㅏ': 'ㅐ',
  'ㅡㅏ': 'ㅏ',
  'ㅡㅓ': 'ㅓ',
  'ㅚㅓ': 'ㅙ',
  'ㅕㅓ': 'ㅕ',
  'ㅑㅓ': 'ㅕ',
  'ㅘㅏ': 'ㅘ',
  'ㅝㅓ': 'ㅝ',
};

/** La desinenza del passato che spetta alla vocale della radice. */
function pastVowel(stemVowel: string): 'ㅏ' | 'ㅓ' {
  return stemVowel === 'ㅏ' || stemVowel === 'ㅗ' ? 'ㅏ' : 'ㅓ';
}

/**
 * La vocale che nasce dalla fusione, con l'eccezione che la tabella non può
 * esprimere: 하 + 아 = 해 (non 하). 시 resta nella tabella: 시 + 어 = 셔,
 * 시 + 었 = 셨 (l'eccezione 세요 è una desinenza a sé, già in elenco).
 */
function fuseVowel(last: Syllable, harmony: 'ㅏ' | 'ㅓ'): string | null {
  if (last.lead === 'ㅎ' && last.vowel === 'ㅏ') return 'ㅐ';
  return FUSION[last.vowel + harmony] ?? null;
}

/**
 * 지 + 었 = 졌: la desinenza del passato si fonde con l'ultima sillaba della
 * radice e lascia dietro di sé solo la ㅆ. Restituisce la coda "sciolta"
 * (었 + il resto) quando il conto torna, `null` altrimenti.
 */
export function expandPastContraction(stem: string, word: string): string | null {
  if (stem.length === 0) return null;
  // L'ultima sillaba della radice non resta: è quella che si è contratta.
  const prefix = stem.slice(0, -1);
  if (!word.startsWith(prefix)) return null;
  const last = decompose(stem[stem.length - 1]);
  if (!last || last.tail !== '') return null; // la radice finisce già per consonante

  const rest = word.slice(prefix.length);
  const contracted = decompose(rest[0] ?? '');
  if (!contracted || contracted.tail !== 'ㅆ') return null;

  if (contracted.lead !== last.lead) return null;

  // Le radici in ㅡ non dicono da sole quale vocale vogliono: 아프 + 아 = 아팠,
  // 쓰 + 어 = 썼. Si prova la fusione con entrambe.
  const harmonies = last.vowel === 'ㅡ' ? (['ㅏ', 'ㅓ'] as const) : ([pastVowel(last.vowel)] as const);
  for (const harmony of harmonies) {
    const fused = fuseVowel(last, harmony);
    if (!fused || contracted.vowel !== fused) continue;
    return (harmony === 'ㅏ' ? '았' : '었') + rest.slice(1);
  }
  return null;
}

/**
 * Le contrazioni del presente: 오 + 아서 = 와서, 주 + 어요 = 줘요, 되 + 어요 =
 * 돼요, 하 + 여요 = 해요. Restituisce la coda "sciolta" (아서, 어요…) oppure
 * `null` quando la forma non torna.
 */
export function expandVowelContraction(stem: string, word: string): string | null {
  if (stem.length === 0) return null;

  // 부르 + 어요 = 불러요: la 르 irregolare raddoppia la ㄹ e indurisce la sillaba
  // prima (부 → 불). Il prefisso non basta a riconoscerla, perché cambia anche la
  // penultima sillaba: si guarda la radice intera prima di ogni altra regola.
  const lastOfStem = decompose(stem[stem.length - 1]);
  if (lastOfStem && lastOfStem.tail === '' && lastOfStem.lead === 'ㄹ' && lastOfStem.vowel === 'ㅡ' && stem.length >= 2) {
    const prev = decompose(stem[stem.length - 2]);
    const hardened = prev && prev.tail === '' ? compose(prev.lead, prev.vowel, 'ㄹ') : null;
    if (hardened) {
      const head = stem.slice(0, -2) + hardened;
      if (word.startsWith(head)) {
        const after = word.slice(head.length);
        const next = decompose(after[0] ?? '');
        if (next && next.lead === 'ㄹ') {
          for (const harmony of ['ㅏ', 'ㅓ'] as const) {
            if (fuseVowel({ lead: 'ㄹ', vowel: 'ㅡ', tail: '' }, harmony) !== next.vowel) continue;
            return (harmony === 'ㅏ' ? '아' : '어') + after.slice(1);
          }
        }
      }
    }
  }

  const prefix = stem.slice(0, -1);
  if (!word.startsWith(prefix)) return null;
  const last = decompose(stem[stem.length - 1]);
  if (!last) return null;

  const target = word.slice(prefix.length);
  const first = decompose(target[0] ?? '');
  if (!first) return null;

  // 어렵 + ㄹ = 어려울, 어렵 + 으면 = 어려우면: la ㅂ si apre in 우 e entra
  // nella sillaba dopo. 고맙 + 어요 = 고마워요, 돕 + 아요 = 도와요: la 우 si
  // fonde con la vocale della desinenza (워 = 우 + 어, 와 = 우 + 아).
  if (last.tail === 'ㅂ') {
    const open = compose(last.lead, last.vowel, '');
    if (!open) return null;
    const after = word.slice((prefix + open).length);
    const next = decompose(after[0] ?? '');
    if (!next || next.lead !== 'ㅇ') return null;
    if (next.vowel === 'ㅜ') {
      if (next.tail !== '') return next.tail + after.slice(1);
      return `으${after.slice(1)}`;
    }
    if (next.vowel === 'ㅘ') return `아${after.slice(1)}`;
    if (next.vowel === 'ㅝ') return `어${after.slice(1)}`;
    return null;
  }

  if (last.tail !== '') return null;
  if (first.lead !== last.lead) return null;

  // 하 + ㄴ = 한, 하 + ㅁ = 함: la 하 tiene la consonante della desinenza
  // (따뜻한, 생각함). La ㄹ passa già da expandRieulTail.
  if (last.lead === 'ㅎ' && last.vowel === 'ㅏ') {
    if (first.vowel === 'ㅏ' && ['ㄴ', 'ㅁ'].includes(first.tail)) return first.tail;
  }

  if (first.tail !== '') return null;

  // 계시 + 어요 = 계세요, 드시 + 어요 = 드세요: 시 + 어 si stringe in 세.
  if (last.lead === 'ㅅ' && last.vowel === 'ㅣ' && first.vowel === 'ㅔ') {
    return '어' + target.slice(1);
  }

  for (const harmony of ['ㅏ', 'ㅓ'] as const) {
    if (fuseVowel(last, harmony) !== first.vowel) continue;
    return (harmony === 'ㅏ' ? '아' : '어') + target.slice(1);
  }
  return null;
}

/**
 * 결제하 + ㄹ = 결제할: la ㄹ finale si appoggia all'ultima sillaba della
 * radice. Restituisce quello che avanza dopo la sillaba, o `null`.
 */
export function expandRieulTail(stem: string, word: string): string | null {
  if (stem.length === 0) return null;
  const last = decompose(stem[stem.length - 1]);
  if (!last || last.tail !== '') return null;
  const prefix = stem.slice(0, -1);
  if (!word.startsWith(prefix)) return null;
  const target = word.slice(prefix.length);
  const expected = compose(last.lead, last.vowel, 'ㄹ');
  if (!expected || !target.startsWith(expected)) return null;
  return target.slice(1);
}
