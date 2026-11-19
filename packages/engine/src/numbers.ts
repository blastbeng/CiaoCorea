/**
 * I numeri che si leggono nei brani e nei dialoghi: 사천오백, 이십, 오십만, 일곱,
 * 열한. Servono alla scheda della parola, che altrimenti davanti a un prezzo non
 * avrebbe niente da dire.
 *
 * Ci sono due serie, e non sono intercambiabili: quella sino-coreana (일, 이, 삼,
 * 십, 백, 천, 만) per denaro, minuti, mesi, anni, piani e numeri di telefono;
 * quella nativa (하나, 둘, 셋, …, 열, 스물) per ore, persone, oggetti, animali ed
 * età. Qui si legge soltanto ciò che è scritto: la scelta della serie la fa la
 * frase, non questa funzione.
 */

export interface NumberReading {
  value: number;
  /** La serie a cui appartiene il numero scritto. */
  system: 'sino' | 'native';
  /** La lettura sillaba per sillaba: 사천오백 → sa-cheon-o-baek. */
  rr: string;
}

const SINO_DIGITS: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const SINO_UNITS: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
const SINO_BIG: Record<string, number> = { 만: 10_000, 억: 100_000_000 };

const NATIVE: Record<string, number> = {
  하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 넷: 4, 네: 4,
  다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9,
  열: 10, 스물: 20, 스무: 20, 서른: 30, 마흔: 40, 쉰: 50,
  예순: 60, 일흔: 70, 여든: 80, 아흔: 90,
};

/** Le decine native che si possono sommare a un'unità: 열한 11, 스물두 22. */
const NATIVE_TENS = ['열', '스물', '스무', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

const RR: Record<string, string> = {
  일: 'il', 이: 'i', 삼: 'sam', 사: 'sa', 오: 'o', 육: 'yuk', 칠: 'chil', 팔: 'pal', 구: 'gu',
  십: 'sip', 백: 'baek', 천: 'cheon', 만: 'man', 억: 'eok', 유: 'yu', 시: 'si',
  하나: 'hana', 한: 'han', 둘: 'dul', 두: 'du', 셋: 'set', 세: 'se', 넷: 'net', 네: 'ne',
  다섯: 'daseot', 여섯: 'yeoseot', 일곱: 'ilgop', 여덟: 'yeodeol', 아홉: 'ahop',
  열: 'yeol', 스물: 'seumul', 스무: 'seumu', 서른: 'seoreun', 마흔: 'maheun', 쉰: 'swin',
  예순: 'yesun', 일흔: 'ilheun', 여든: 'yeodeun', 아흔: 'aheun',
};

/** 한자어: 십/백/천/만 si susseguono, mai due cifre di fila. */
function parseSino(word: string): number | null {
  let total = 0;
  let section = 0;
  let pending = 0;
  let hasUnit = false;

  for (const ch of word) {
    if (ch in SINO_DIGITS) {
      // Due cifre di fila non sono un numero coreano: 사오 non si dice.
      if (pending !== 0) return null;
      pending = SINO_DIGITS[ch];
      continue;
    }
    if (ch in SINO_UNITS) {
      hasUnit = true;
      section += (pending || 1) * SINO_UNITS[ch];
      pending = 0;
      continue;
    }
    if (ch in SINO_BIG) {
      hasUnit = true;
      section += pending;
      pending = 0;
      total += (section || 1) * SINO_BIG[ch];
      section = 0;
      continue;
    }
    return null;
  }

  // Una cifra sola (삼) appartiene al vocabolario, non a questa lettura.
  if (!hasUnit) return null;
  return total + section + pending;
}

/**
 * Le forme native che davanti a un contatore perdono l'ultima consonante:
 * 하나 → 한 개, 둘 → 두 시, 셋 → 세 번. Sono le uniche di una sillaba che si
 * possono leggere come numero senza indovinare (열 resta "febbre", 만 "solo").
 */
const SHORT_NATIVE = new Set(['한', '두', '세']);

/** Nativo: da uno a novantanove, decina più unità (열한, 스물두). */
function parseNative(word: string): number | null {
  if (word.length < 2 && !SHORT_NATIVE.has(word)) return null;
  const whole = NATIVE[word];
  if (whole !== undefined) return whole;

  for (const tens of NATIVE_TENS) {
    if (!word.startsWith(tens)) continue;
    const rest = word.slice(tens.length);
    if (rest.length === 0) continue;
    const unit = NATIVE[rest];
    if (unit !== undefined && unit < 10) return NATIVE[tens] + unit;
  }
  return null;
}

function romanize(word: string): string {
  const keys = Object.keys(RR).sort((a, b) => b.length - a.length);
  const parts: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    const key = keys.find((candidate) => rest.startsWith(candidate));
    if (!key) return '';
    parts.push(RR[key]);
    rest = rest.slice(key.length);
  }
  return parts.join('-');
}

/** Separa le migliaia con il punto, come si scrivono i numeri in italiano. */
export function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Legge un numero scritto in hangul. Restituisce `null` quando la parola non è
 * un numero: meglio nessuna scheda che una scheda sbagliata.
 */
export function readNumber(word: string): NumberReading | null {
  // Una sillaba sola è troppo ambigua: 만 è anche la particella "solo", 열 è
  // anche "febbre". Restano coperte dal vocabolario, che può dire il contesto.
  if (word.length < 2 && !SHORT_NATIVE.has(word)) return null;

  const sino = parseSino(word);
  if (sino !== null) return { value: sino, system: 'sino', rr: romanize(word) };

  const native = parseNative(word);
  if (native !== null) return { value: native, system: 'native', rr: romanize(word) };

  return null;
}

/**
 * I contatori che nei testi compaiono attaccati a una cifra (5층, 3월, 12일).
 * `system` dice quale serie di numeri vuole il contatore: i contatori nativi si
 * leggono 세 시, 두 개, 다섯 명; gli altri 오 층, 삼 월, 십이 일.
 */
const COUNTERS: readonly { ko: string; it: string; rr: string; system: 'sino' | 'native' }[] = [
  { ko: '호선', it: 'linea della metropolitana', rr: 'hoseon', system: 'sino' },
  { ko: '절', it: 'strofa, versetto', rr: 'jeol', system: 'sino' },
  { ko: '인분', it: 'porzioni', rr: 'inbun', system: 'sino' },
  { ko: '원', it: 'won (la moneta coreana)', rr: 'won', system: 'sino' },
  { ko: '월', it: 'mese', rr: 'wol', system: 'sino' },
  { ko: '일', it: 'giorno del mese', rr: 'il', system: 'sino' },
  { ko: '년', it: 'anno', rr: 'nyeon', system: 'sino' },
  { ko: '분', it: 'minuto', rr: 'bun', system: 'sino' },
  { ko: '초', it: 'secondo', rr: 'cho', system: 'sino' },
  { ko: '층', it: 'piano (di un edificio)', rr: 'cheung', system: 'sino' },
  { ko: '번', it: 'numero, volta', rr: 'beon', system: 'sino' },
  { ko: '호', it: 'numero', rr: 'ho', system: 'sino' },
  { ko: '개', it: 'oggetti', rr: 'gae', system: 'native' },
  { ko: '명', it: 'persone', rr: 'myeong', system: 'native' },
  { ko: '살', it: 'anni (di età)', rr: 'sal', system: 'native' },
  { ko: '시', it: 'ora del giorno', rr: 'si', system: 'native' },
  { ko: '잔', it: 'bicchieri', rr: 'jan', system: 'native' },
  { ko: '장', it: 'fogli, biglietti', rr: 'jang', system: 'sino' },
  { ko: '권', it: 'libri', rr: 'gwon', system: 'sino' },
  { ko: '평', it: 'pyeong (3,3 m²)', rr: 'pyeong', system: 'sino' },
  { ko: '도', it: 'gradi', rr: 'do', system: 'sino' },
];

/** Le migliaia dell'hangul: 1만, 500만, 5천. */
const BIG_UNITS: readonly { ko: string; it: string; rr: string; value: number }[] = [
  { ko: '억', it: 'cento milioni', rr: 'eok', value: 100_000_000 },
  { ko: '만', it: 'diecimila', rr: 'man', value: 10_000 },
  { ko: '천', it: 'mille', rr: 'cheon', value: 1_000 },
  { ko: '백', it: 'cento', rr: 'baek', value: 100 },
];

/**
 * 비음화 davanti a ㅁ/ㄴ: 백만 si dice [뱅만], 십만 [심만], 10년 [심년]. La
 * romanizzazione qui è sillaba per sillaba, quindi basta correggere l'ultima
 * quando l'unità che segue comincia per m o n.
 */
const NASAL_LAST: Record<string, string> = { baek: 'baeng', sip: 'sim', yuk: 'yung' };

function joinWithUnit(spelled: string, unitRr: string): string {
  const parts = romanize(spelled).split('-');
  const last = parts[parts.length - 1];
  if (last && (unitRr.startsWith('m') || unitRr.startsWith('n'))) {
    parts[parts.length - 1] = NASAL_LAST[last] ?? last;
  }
  return [...parts, unitRr].join('-');
}

/** I mesi che non si leggono come si scrivono: 6월 è 유월, 10월 è 시월. */
const MONTH_IRREGULAR: Record<number, string> = { 6: '유', 10: '시' };

/** Ciò che può restare attaccato dopo il contatore: particelle e copula. */
const TAILS = [
  '이에요', '예요', '입니다', '에서', '으로', '부터', '까지', '이요', '이나', '씩', '째',
  '에', '로', '이', '은', '는', '을', '를', '도', '만', '인', '나',
];

const SINO_ONES_SPELL = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const NATIVE_ONES_SPELL = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS_SPELL = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

/** 27 → 이십칠. */
function sinoHangul(value: number): string {
  if (value === 0) return '영';
  if (value >= 100_000_000) {
    const high = Math.floor(value / 100_000_000);
    const low = value % 100_000_000;
    return `${sinoHangul(high)}억${low ? sinoHangul(low) : ''}`;
  }
  if (value >= 10_000) {
    const high = Math.floor(value / 10_000);
    const low = value % 10_000;
    return `${sinoHangul(high)}만${low ? sinoHangul(low) : ''}`;
  }
  let out = '';
  let rest = value;
  for (const [unit, spell] of [[1000, '천'], [100, '백'], [10, '십']] as const) {
    const count = Math.floor(rest / unit);
    if (count === 0) continue;
    out += (count === 1 ? '' : SINO_ONES_SPELL[count]) + spell;
    rest %= unit;
  }
  if (rest > 0) out += SINO_ONES_SPELL[rest];
  return out;
}

/** 3 → 세, 27 → 스물일곱. Oltre il 99 si passa ai numeri sino-coreani. */
function nativeHangul(value: number): string {
  if (value >= 100) return sinoHangul(value);
  if (value >= 10) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    // Vent'anni davanti a un contatore si dice 스무 살, non 스물 살.
    if (tens === 2 && ones === 0) return '스무';
    return NATIVE_TENS_SPELL[tens] + NATIVE_ONES_SPELL[ones];
  }
  return NATIVE_ONES_SPELL[value];
}

export interface WrittenNumberReading extends NumberReading {
  /** Il contatore o l'unità grande che segue la cifra. */
  unit: string;
  unitIt: string;
  /** La lettura in hangul: 오층, 세 시, 일만. */
  hangul: string;
}

/**
 * Legge una cifra con il suo contatore: 5층, 3월, 12일, 1만, 2호선. Nei testi del
 * corso i numeri si scrivono spesso in cifre: senza questa lettura la scheda
 * spiegherebbe soltanto il contatore (층 = piano) e perderebbe il numero, oppure
 * leggerebbe 만 come la particella "solo".
 */
export function readWrittenNumber(word: string): WrittenNumberReading | null {
  const parts = /^(\d[\d,]*)([가-힣]+)$/.exec(word);
  if (!parts) return null;
  const value = Number(parts[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  const rest = parts[2];

  const big = BIG_UNITS.find((unit) => rest.startsWith(unit.ko));
  if (big) {
    const tail = rest.slice(big.ko.length);
    if (tail === '' || TAILS.some((candidate) => tail === candidate)) {
      const total = value * big.value;
      const hangul = sinoHangul(value) + big.ko;
      return {
        value: total,
        system: 'sino',
        rr: joinWithUnit(sinoHangul(value), big.rr),
        unit: big.ko,
        unitIt: `${big.it} (${big.ko} = ${formatNumber(big.value)})`,
        hangul,
      };
    }
  }

  const counter = COUNTERS.find((unit) => rest.startsWith(unit.ko));
  if (!counter) return null;
  const tail = rest.slice(counter.ko.length);
  if (tail !== '' && !TAILS.some((candidate) => tail === candidate)) return null;
  const spelled = counter.system === 'native' ? nativeHangul(value) : sinoHangul(value);
  const irregular = counter.ko === '월' ? MONTH_IRREGULAR[value] : undefined;
  return {
    value,
    system: counter.system,
    rr: joinWithUnit(irregular ?? spelled, counter.rr),
    unit: counter.ko,
    unitIt: irregular
      ? `${counter.it} (${value}${counter.ko} si legge ${irregular}${counter.ko}, non ${spelled}${counter.ko})`
      : counter.it,
    hangul: (irregular ?? spelled) + counter.ko,
  };
}
