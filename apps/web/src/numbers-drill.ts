/**
 * Le domande del trainer dei numeri.
 *
 * Due serie, due mondi: quella sino-coreana per le cifre lunghe, i soldi, i
 * minuti e i contatori moderni; quella nativa per ore, età e per la manciata di
 * contatori che si contano con le dita (개, 명, 마리, 권, 장…). Qui la serie non
 * si sceglie a caso: la decide il contatore, e le risposte sbagliate sono gli
 * errori che uno studente italiano fa davvero — 삼 권 invece di 세 권, 칠 시
 * invece di 일곱 시.
 */
import {
  COUNTERS_INFO,
  formatNumber,
  readNumber,
  spellCounter,
  spellDigits,
  spellNumber,
  spellSinoGrouped,
  type CounterInfo,
} from '@ciaocorea/engine';

export type NumberMode = 'sino' | 'nativo' | 'orario' | 'prezzo' | 'telefono';

export interface NumberQuestion {
  mode: NumberMode;
  /** La domanda: cifre, un'ora, un prezzo, un numero di telefono. */
  prompt: string;
  /** Che cosa si chiede, in una riga. */
  hint: string;
  /** La risposta giusta, già spaziata come si scrive. */
  answer: string;
  /** Quattro risposte, la giusta compresa, in ordine sparso. */
  options: string[];
  /** Perché quella è la risposta. */
  note: string;
}

export const NUMBER_MODES: readonly { id: NumberMode; label: string; blurb: string }[] = [
  {
    id: 'sino',
    label: 'Cifre sino-coreane',
    blurb: 'Le cifre dei numeri, dei soldi e dei minuti: 일, 이, 삼…',
  },
  {
    id: 'nativo',
    label: 'Contatori nativi',
    blurb: 'Quanti oggetti, persone, libri: 한 개, 두 명, 세 권…',
  },
  {
    id: 'orario',
    label: 'Che ore sono',
    blurb: "L'ora vuole il nativo, i minuti il sino: 일곱 시 사십 분.",
  },
  {
    id: 'prezzo',
    label: 'Prezzi in won',
    blurb: 'Le cifre si raggruppano a diecimila: 만 이천 오백 원.',
  },
  {
    id: 'telefono',
    label: 'Numeri di telefono',
    blurb: 'Cifra per cifra, e lo zero è 공: 공일공…',
  },
];

/** I contatori che si contano col nativo nella pratica di ogni giorno. */
const NATIVE_COUNTERS: readonly CounterInfo[] = COUNTERS_INFO.filter(
  (counter) => counter.system === 'native',
).filter((counter) => ['개', '명', '마리', '권', '장', '잔', '병', '대', '살', '시간'].includes(counter.ko));

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Il passo con cui si sbaglia una cifra, senza uscire dal migliaio giusto. */
function stepFor(value: number): number {
  if (value >= 10_000) return 1_000;
  if (value >= 1_000) return 100;
  if (value >= 100) return 10;
  return 1;
}

function uniqueOptions(answer: string, candidates: readonly string[], random: () => number): string[] {
  const seen = new Set([answer]);
  const wrong: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    wrong.push(candidate);
    if (wrong.length === 3) break;
  }
  // Se i candidati non bastano si allarga a mano: meglio una domanda in meno che
  // una domanda con due risposte giuste.
  while (wrong.length < 3) {
    wrong.push(`${answer} ${wrong.length + 1}`);
  }
  return shuffled([answer, ...wrong], random);
}

function sinoBreakdown(value: number): string {
  const units: readonly [number, string][] = [
    [10_000, '만'],
    [1_000, '천'],
    [100, '백'],
    [10, '십'],
  ];
  const parts: string[] = [];
  let rest = value;
  for (const [size, name] of units) {
    const count = Math.floor(rest / size);
    if (count === 0) continue;
    rest %= size;
    const head = count === 1 ? '' : spellNumber(count, 'sino');
    parts.push(`${head}${name}`);
  }
  if (rest > 0) parts.push(spellNumber(rest, 'sino'));
  return parts.join(' + ');
}

function sinoQuestion(random: () => number): NumberQuestion {
  const tier = pick(['due', 'tre', 'quattro', 'cinque'] as const, random);
  const ranges: Record<typeof tier, [number, number]> = {
    due: [11, 99],
    tre: [101, 999],
    quattro: [1_001, 9_999],
    cinque: [10_001, 99_999],
  };
  const [min, max] = ranges[tier];
  const step = tier === 'due' ? 1 : tier === 'tre' ? 7 : tier === 'quattro' ? 13 : 137;
  const value = min + Math.floor(random() * ((max - min) / step)) * step;
  const answer = spellNumber(value, 'sino');
  // Ogni risposta sbagliata cambia una cifra in una posizione diversa: così non
  // si può azzeccare guardando solo la fine della parola.
  const candidates: string[] = [];
  for (let place = 1; place * 10 <= value; place *= 10) {
    const digit = Math.floor(value / place) % 10;
    const replacement = (digit + 1 + Math.floor(random() * 8)) % 10;
    candidates.push(spellNumber(value + (replacement - digit) * place, 'sino'));
  }
  // Per le due cifre l'errore classico è mescolare le serie.
  if (value < 100) candidates.push(spellNumber(value, 'native'));
  // Nei numeri piccoli le posizioni non bastano a riempire le quattro risposte.
  for (const delta of [10, -10, 100, -100, 1, -1]) {
    const next = value + delta;
    if (next > 0 && next <= 99_999) candidates.push(spellNumber(next, 'sino'));
  }
  return {
    mode: 'sino',
    prompt: formatNumber(value),
    hint: 'Come si legge?',
    answer,
    options: uniqueOptions(answer, candidates, random),
    note: `${formatNumber(value)} = ${sinoBreakdown(value)}. Le cifre sino-coreane sono quelle dei soldi, dei minuti e dei contatori moderni.`,
  };
}

function nativeQuestion(random: () => number): NumberQuestion {
  const counter = pick(NATIVE_COUNTERS, random);
  const value = 1 + Math.floor(random() * (random() < 0.7 ? 19 : 98));
  const answer = `${spellNumber(value, 'native')} ${counter.ko}`;
  const sinoSame = `${spellNumber(value, 'sino')} ${counter.ko}`;
  const otherCounter = pick(NATIVE_COUNTERS.filter((item) => item.ko !== counter.ko), random);
  const otherValue = value === 2 ? 3 : 2;
  const candidates = [
    sinoSame,
    `${spellNumber(value, 'native')} ${otherCounter.ko}`,
    `${spellNumber(otherValue, 'native')} ${counter.ko}`,
  ];
  const note =
    value === 20
      ? 'Venti davanti al contatore diventa 스무: 스무 살, 스무 명.'
      : `${counter.ko} (${counter.it}) vuole i numeri nativi: ${value} → ${spellNumber(value, 'native')}, non ${spellNumber(value, 'sino')}.`;
  return {
    mode: 'nativo',
    prompt: `${formatNumber(value)} ${counter.it}`,
    hint: `Con il contatore ${counter.ko}`,
    answer,
    options: uniqueOptions(answer, candidates, random),
    note,
  };
}

function hourSpelling(hour: number, system: 'sino' | 'native'): string {
  return spellNumber(hour, system);
}

function orarioQuestion(random: () => number): NumberQuestion {
  const hour = 1 + Math.floor(random() * 12);
  const minute = Math.floor(random() * 12) * 5;
  const nativeHour = hourSpelling(hour, 'native');
  const sinoHour = hourSpelling(hour, 'sino');
  const answer = minute === 0 ? `${nativeHour} 시` : `${nativeHour} 시 ${spellNumber(minute, 'sino')} 분`;
  const candidates = [
    minute === 0 ? `${sinoHour} 시` : `${sinoHour} 시 ${spellNumber(minute, 'sino')} 분`,
    minute === 0 ? '' : `${nativeHour} 시 ${spellNumber(minute, 'native')} 분`,
    minute === 0
      ? `${nativeHour} 시 ${spellNumber(30, 'sino')} 분`
      : `${nativeHour} 시 ${spellNumber((minute + 15) % 60 || 30, 'sino')} 분`,
    `${hourSpelling(hour === 12 ? 1 : hour + 1, 'native')} 시${minute === 0 ? '' : ` ${spellNumber(minute, 'sino')} 분`}`,
  ];
  const exact = minute === 0 ? ' 정각 (in punto) si può aggiungere, ma non serve.' : '';
  return {
    mode: 'orario',
    prompt: `${hour}:${String(minute).padStart(2, '0')}`,
    hint: 'Che ore sono?',
    answer,
    options: uniqueOptions(answer, candidates, random),
    note: `L'ora vuole il nativo (${nativeHour} 시, non ${sinoHour} 시), i minuti il sino (${spellNumber(minute, 'sino')} 분).${exact}${
      minute === 30 ? ' 삼십 분 si può dire anche 반.' : ''
    }`,
  };
}

function prezzoQuestion(random: () => number): NumberQuestion {
  const value = (10 + Math.floor(random() * 990)) * 100;
  const answer = `${spellSinoGrouped(value)} 원`;
  const delta = stepFor(value);
  // Senza spazi la lettura è la stessa: non è un errore, quindi non è un
  // distrattore. Contano solo i numeri davvero diversi.
  const candidates = [
    `${spellSinoGrouped(value + delta)} 원`,
    `${spellSinoGrouped(value - delta)} 원`,
    `${spellSinoGrouped(value + delta * 10)} 원`,
    `${spellSinoGrouped(value - delta * 10)} 원`,
  ];
  return {
    mode: 'prezzo',
    prompt: `${formatNumber(value)}원`,
    hint: 'Quanto costa?',
    answer,
    options: uniqueOptions(answer, candidates, random),
    note: `Le cifre si raggruppano a diecimila: ${formatNumber(value)} = ${spellSinoGrouped(value)}. Lo spazio fra i gruppi è una convenzione: si può anche scrivere tutto attaccato.`,
  };
}

function telefonoQuestion(random: () => number): NumberQuestion {
  const part = (length: number): string =>
    Array.from({ length }, () => String(Math.floor(random() * 10))).join('');
  const groups = [part(3), part(4), part(4)];
  const digits = groups.join('');
  const answer = groups.map((group) => spellDigits(group)).join(' ');
  const asNumber = `${spellDigits(groups[0]!)} ${spellNumber(Number(groups[1]!), 'sino')} ${spellNumber(Number(groups[2]!), 'sino')}`;
  const lastDigit = Number(digits.at(-1));
  const swapped = `${groups.slice(0, -1).map((group) => spellDigits(group)).join(' ')} ${spellDigits(
    `${groups[2]!.slice(0, -1)}${(lastDigit + 1) % 10}`,
  )}`;
  const middleDigit = Number(groups[1]![0]);
  const swappedMiddle = `${spellDigits(groups[0]!)} ${spellDigits(
    `${(middleDigit + 1) % 10}${groups[1]!.slice(1)}`,
  )} ${spellDigits(groups[2]!)}`;
  const candidates = [asNumber, swapped, swappedMiddle];
  return {
    mode: 'telefono',
    prompt: groups.join('-'),
    hint: 'Come si dette al telefono?',
    answer,
    options: uniqueOptions(answer, candidates, random),
    note: 'Al telefono le cifre si leggono una per una e lo zero è 공, non 영. I trattini si sentono come piccole pause.',
  };
}

export function buildQuestion(mode: NumberMode, random: () => number = Math.random): NumberQuestion {
  switch (mode) {
    case 'sino':
      return sinoQuestion(random);
    case 'nativo':
      return nativeQuestion(random);
    case 'orario':
      return orarioQuestion(random);
    case 'prezzo':
      return prezzoQuestion(random);
    case 'telefono':
      return telefonoQuestion(random);
  }
}

/**
 * Il valore di una risposta, quando è solo un numero: serve al test per
 * controllare che la risposta giusta dica davvero la cifra della domanda.
 */
export function answerValue(question: NumberQuestion): number | null {
  return readNumber(question.answer.replaceAll(' ', ''))?.value ?? null;
}
