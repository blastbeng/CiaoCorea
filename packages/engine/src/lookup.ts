import { compose, decompose, expandPastContraction, expandRieulTail, expandVowelContraction } from './hangul';
import { normalizeAnswer, normalizeHangul } from './normalize';
import { readNumber, readWrittenNumber, formatNumber } from './numbers';
import { readProperNoun } from './proper-nouns';
import type { VocabEntry } from '@ciaocorea/shared';

export type WordMatchVia = 'exact' | 'particle' | 'stem' | 'copula' | 'number' | 'name';

export interface WordMatch {
  entry: VocabEntry;
  via: WordMatchVia;
  /** La particella tolta dal testo, quando via === 'particle'. */
  particle?: string;
  /** Che cosa fa quella particella, in italiano. */
  particleHint?: string;
  /** La desinenza riconosciuta, quando via === 'stem'. */
  ending?: string;
  /** Il suffisso tolto dal testo, quando via === 'copula' (입니다, 예요…). */
  suffix?: string;
  /** Altre voci con la stessa parola: 배 è una pera, una pancia e una barca. */
  senses?: VocabEntry[];
  /** Una riga di spiegazione per i casi che non sono una semplice voce. */
  note?: string;
}

interface Particle {
  suffix: string;
  hint: string;
}

/**
 * Particelle e suffissi che si attaccano al nome. L'ordine conta: si prova
 * prima la forma più lunga, altrimenti 에서 diventerebbe 에 + 서.
 */
const PARTICLES: readonly Particle[] = [
  { suffix: '이라고는', hint: '라고 + 는: "quello che si chiama…", con il tema' },
  { suffix: '이라고', hint: '라고: "che si chiama", per dire un nome' },
  { suffix: '에서는', hint: '에서 + 는: nel luogo dove si fa qualcosa' },
  { suffix: '에게서', hint: 'da una persona (chi manda o dice)' },
  { suffix: '에는', hint: '에 + 는: nel luogo o nel tempo, come tema' },
  { suffix: '에도', hint: '에 + 도: anche nel luogo o nel tempo' },
  { suffix: '에서', hint: 'nel luogo dove si fa qualcosa, da un luogo' },
  { suffix: '에게', hint: 'a una persona' },
  { suffix: '한테', hint: 'a una persona (parlato)' },
  { suffix: '으로', hint: 'verso, per mezzo di (dopo consonante)' },
  { suffix: '부터', hint: 'da (inizio)' },
  { suffix: '까지', hint: 'fino a' },
  { suffix: '보다', hint: 'di (nel paragone: 더 … 보다)' },
  { suffix: '처럼', hint: 'come, uguale a' },
  { suffix: '이랑', hint: 'e, insieme a (dopo consonante)' },
  { suffix: '하고', hint: 'e, insieme a (parlato)' },
  { suffix: '은', hint: 'tema: quanto a…' },
  { suffix: '는', hint: 'tema: quanto a…' },
  { suffix: '이', hint: 'soggetto' },
  { suffix: '가', hint: 'soggetto' },
  { suffix: '을', hint: 'oggetto' },
  { suffix: '를', hint: 'oggetto' },
  { suffix: '에', hint: 'a, in: luogo o tempo' },
  { suffix: '도', hint: 'anche' },
  { suffix: '만', hint: 'solo' },
  { suffix: '쯤', hint: 'circa, all\'incirca' },
  { suffix: '의', hint: 'di (possesso)' },
  { suffix: '와', hint: 'e, insieme a (dopo vocale)' },
  { suffix: '과', hint: 'e, insieme a (dopo consonante)' },
  { suffix: '로', hint: 'verso, per mezzo di (dopo vocale o ㄹ)' },
  { suffix: '랑', hint: 'e, insieme a (dopo vocale)' },
  { suffix: '나', hint: 'o (tra due possibilità)' },
];

/**
 * Desinenze frequenti: servono solo a capire dove finisce la radice. Sono tutte
 * di almeno due sillabe, tranne 요: con una sola consonante o vocale il rischio
 * di scambiare una parola intera per una coniugazione è troppo alto (사고 non è
 * 사다 + 고).
 */
const ENDINGS = [
  '습니다', 'ㅂ니다', 'ㅂ니까', '습니까',
  // I segni del tempo vengono prima delle forme intere: 먹었어요 è "먹 + 었",
  // e la scheda deve dire quello, non ripetere tutta la desinenza.
  '았', '었', '겠',
  '아서', '어서', '여서', '으면', '으세요', '세요', '는데', '지만', '니까', '려고', '으러', '기로', '는지',
  '으니까', '으니', '을래', 'ㄹ래', '을게', '을까', '나요', '까요',
  'ㄴ다고', '는다고', '다면서',
  '어요', '아요', '여요', '해요', '러', '려', '면', '지', '게', '고', '기',
  '니', '다', '요',
  // Participi e oggetto: 좋은 사람, 먹을 것. Vengono per ultimi perché sono
  // corti e senza una radice davanti farebbero troppi falsi positivi.
  '은', '는', '을', '를', 'ㄴ', 'ㄹ', '던', '어', '아',
];

/** La -시- di cortesia, fra la radice e la desinenza: 오시면, 읽으세요. */
const HONORIFICS = ['으시', '시'];

/** Il verbo essere attaccato a un nome: 원입니다, 원이에요. */
const COPULAS: readonly { suffix: string; hint: string }[] = [
  { suffix: '합니다', hint: '하다 nella forma cortese: "è / fa"' },
  { suffix: '합니까', hint: '하다 nella domanda cortese' },
  { suffix: '입니다', hint: 'verbo essere, forma cortese scritta' },
  { suffix: '입니까', hint: 'verbo essere, domanda cortese' },
  { suffix: '이에요', hint: 'verbo essere, forma cortese parlata' },
  { suffix: '예요', hint: 'verbo essere, forma cortese parlata (dopo vocale)' },
  { suffix: '이시죠', hint: 'verbo essere + 시 (cortesia) + 죠: "è vero?"' },
  { suffix: '이죠', hint: 'verbo essere + 죠: "è vero?"' },
  { suffix: '이요', hint: 'verbo essere, cortese: "è…"' },
  { suffix: '이야', hint: 'verbo essere, forma informale' },
  { suffix: '이고', hint: 'verbo essere + 고: "è … e"' },
];

function indexOf(entries: readonly VocabEntry[]): Map<string, VocabEntry[]> {
  const byKo = new Map<string, VocabEntry[]>();
  for (const entry of entries) {
    const key = normalizeAnswer(entry.ko).trim();
    if (key.length === 0) continue;
    const list = byKo.get(key);
    if (list) list.push(entry);
    else byKo.set(key, [entry]);
  }
  return byKo;
}

function build(byKo: Map<string, VocabEntry[]>, key: string, via: WordMatchVia, extra: Partial<WordMatch> = {}): WordMatch | null {
  const hits = byKo.get(key);
  if (!hits || hits.length === 0) return null;
  const [first, ...rest] = hits;
  return { entry: first, via, ...(rest.length > 0 ? { senses: rest } : {}), ...extra };
}

/**
 * Le forme che si sentono parlando: 거 = 것 (e 거예요 = 것이에요), 게 = 것이,
 * 걸 = 것을, 건 = 것은; 내가 = 나 + 가. Si provano dopo la parola vera, così
 * una voce di vocabolario ha sempre la precedenza.
 */
const SPOKEN: readonly { head: string; whole: boolean; ko: string; note: string }[] = [
  { head: '거', whole: false, ko: '것', note: 'parlando, 것 si dice 거' },
  { head: '게', whole: true, ko: '것이', note: 'nel parlato 게 = 것이' },
  { head: '걸', whole: true, ko: '것을', note: 'nel parlato 걸 = 것을' },
  { head: '건', whole: true, ko: '것은', note: 'nel parlato 건 = 것은' },
  { head: '내가', whole: true, ko: '나', note: '내가 = 나 + 가: con la particella del soggetto 나 diventa 내' },
  { head: '제가', whole: true, ko: '저', note: '제가 = 저 + 가' },
  { head: '네가', whole: true, ko: '너', note: '네가 = 너 + 가' },
];

/** Cerca la parola così com'è, poi senza il 요 finale della cortesia. */
function candidates(wanted: string): { word: string; note?: string }[] {
  const list: { word: string; note?: string }[] = [{ word: wanted }];
  if (wanted.length > 2 && wanted.endsWith('요')) {
    list.push({ word: wanted.slice(0, -1), note: 'il 요 finale è la cortesia' });
  }
  for (const spoken of SPOKEN) {
    if (spoken.whole && wanted === spoken.head) {
      list.push({ word: spoken.ko, note: spoken.note });
      continue;
    }
    if (spoken.whole || !wanted.startsWith(spoken.head) || wanted.length === spoken.head.length) continue;
    list.push({ word: spoken.ko + wanted.slice(spoken.head.length), note: spoken.note });
  }
  return list;
}

/**
 * Una voce che non viene da una lezione: un numero, un nome proprio, una cifra
 * con il contatore. Non ha corso né lezione, ma la scheda deve poterla mostrare
 * come tutte le altre.
 */
function entryOf(ko: string, it: string, rr: string): VocabEntry {
  return { ko, it, rr, courseSlug: '', courseTitle: '', lessonId: '', lessonTitle: '' };
}

function matchOne(byKo: Map<string, VocabEntry[]>, word: string): WordMatch | null {
  const exact = build(byKo, word, 'exact');
  if (exact) return exact;

  // Prima dei suffissi: 삼만 è trentamila, non 삼 + 만. Vale anche per le cifre
  // con il contatore attaccato: 5층, 3월, 1만.
  const written = readWrittenNumber(word);
  if (written) {
    return {
      entry: entryOf(word, `${formatNumber(written.value)} · ${written.unitIt}`, written.rr),
      via: 'number',
      note: `si legge ${written.hangul}`,
    };
  }

  const number = readNumber(word);
  if (number) {
    return {
      entry: entryOf(word, `${formatNumber(number.value)} (numero)`, number.rr),
      via: 'number',
      note: number.system === 'sino' ? 'serie sino-coreana: soldi, minuti, mesi, anni, piani' : 'serie nativa: ore, persone, oggetti, animali, età',
    };
  }

  for (const { suffix, hint } of PARTICLES) {
    if (word.length <= suffix.length || !word.endsWith(suffix)) continue;
    const base = word.slice(0, -suffix.length);
    const hit = build(byKo, base, 'particle', { particle: suffix, particleHint: hint });
    if (hit) return hit;
    // Un nome proprio con la sua particella: 부산까지, 서울에서.
    const place = readProperNoun(base);
    if (place) {
      return {
        entry: entryOf(base, place.it, place.rr),
        via: 'name',
        particle: suffix,
        particleHint: hint,
      };
    }
  }

  for (const { suffix, hint } of COPULAS) {
    if (word.length <= suffix.length || !word.endsWith(suffix)) continue;
    const hit = build(byKo, word.slice(0, -suffix.length), 'copula', { suffix, note: hint });
    if (hit) return hit;
  }

  // Un nome di persona o di luogo: 지수, 마르코, 한강.
  const name = readProperNoun(word);
  if (name) return { entry: entryOf(word, name.it, name.rr), via: 'name' };

  // Radice di un verbo: la voce finisce in 다, la forma nel brano no.
  // Vince la radice più lunga, così 먹었어요 non finisce su una parola più corta.
  let best: VocabEntry | null = null;
  let bestSenses: VocabEntry[] | undefined;
  let bestLength = 0;
  let bestEnding = '';
  for (const [key, hits] of byKo) {
    if (!key.endsWith('다') || key.length < 2) continue;
    const stem = key.slice(0, -1);
    if (stem.length <= bestLength) continue;
    const found = readForm(stem, word) ?? readForm(withHonorific(stem), word);
    if (found === null) continue;
    best = hits[0];
    bestSenses = hits.length > 1 ? hits.slice(1) : undefined;
    bestLength = stem.length;
    bestEnding = found;
  }
  if (best) {
    return { entry: best, via: 'stem', ending: bestEnding, ...(bestSenses ? { senses: bestSenses } : {}) };
  }

  return null;
}

/**
 * Che cosa resta della forma del brano dopo la radice. Restituisce la desinenza
 * riconosciuta, oppure `null` quando quel che avanza non è una desinenza: meglio
 * nessuna scheda che una scheda che inventa.
 */
function readForm(stem: string, word: string): string | null {
  // L'ultima sillaba della radice può essersi fusa con la desinenza (자 + 았 = 잤,
  // 결제하 + ㄹ = 결제할), e con la 르 irregolare cambia anche la penultima
  // (부르 → 불러): si guardano due sillabe, non una.
  if (!word.startsWith(stem.slice(0, Math.max(0, stem.length - 2)))) return null;
  // 얼 (gelare), 해 (fai): nel testo c'è la radice nuda, senza desinenza.
  if (word === stem) return '';

  // La parte che avanza deve sembrare una desinenza, non un'altra parola.
  const rest = word.startsWith(stem) ? word.slice(stem.length) : '';
  if (rest.length > 0) {
    const plain = ENDINGS.find((candidate) => rest.startsWith(candidate));
    if (plain) return plain;
    // Vieni!, entra!: la -시- di cortesia sta fra la radice e la desinenza.
    for (const honorific of HONORIFICS) {
      if (!rest.startsWith(honorific)) continue;
      const after = rest.slice(honorific.length);
      const ending = ENDINGS.find((candidate) => after.startsWith(candidate));
      if (ending) return `${honorific}${ending}`;
    }
  }

  // 먹었어요 è 먹 + 었; 졌습니다 è 지 + 었 + 습니다, con la ㅆ appoggiata alla radice.
  const past = expandPastContraction(stem, word);
  if (past) {
    const ending = ENDINGS.find((candidate) => past.startsWith(candidate));
    if (ending) return ending;
  }

  // 와서, 돼요, 했어요, 비어: la vocale della radice e quella della desinenza
  // si fondono in una sola sillaba.
  const fused = expandVowelContraction(stem, word);
  if (fused !== null) {
    if (fused.length === 0) return '';
    const ending = ENDINGS.find((candidate) => fused.startsWith(candidate));
    if (ending) return ending;
  }

  // 합니다, 출발합니다: la ㅂ si appoggia alla radice e resta 니다.
  const lastStem = decompose(stem[stem.length - 1]);
  if (lastStem && lastStem.tail === '') {
    const closed = compose(lastStem.lead, lastStem.vowel, 'ㅂ');
    if (closed && word.startsWith(`${stem.slice(0, -1)}${closed}`)) {
      const after = word.slice(stem.length);
      if (after.startsWith('니다')) return 'ㅂ니다';
      if (after.startsWith('니까')) return 'ㅂ니까';
    }
  }

  // 온다고, 간다고: la ㄴ di -ㄴ다고 si appoggia alla radice (오 + ㄴ다고).
  if (lastStem && lastStem.tail === '') {
    const nasal = compose(lastStem.lead, lastStem.vowel, 'ㄴ');
    if (nasal && word.startsWith(`${stem.slice(0, -1)}${nasal}`)) {
      const after = word.slice(stem.length);
      if (after.startsWith('다고')) return 'ㄴ다고';
      if (after.startsWith('다면서')) return 'ㄴ다면서';
      if (after.startsWith('지')) return 'ㄴ지';
    }
  }

  // 결제할, 운전할: la ㄹ del futuro/potenziale si appoggia alla radice.
  const rieul = expandRieulTail(stem, word);
  if (rieul !== null) {
    if (rieul.length === 0) return 'ㄹ';
    const ending = ENDINGS.find((candidate) => rieul.startsWith(candidate));
    if (ending) return ending;
  }

  // 걷 + 어서 = 걸어서: i verbi in ㄷ irregolare cambiano la ㄷ in ㄹ davanti a
  // una desinenza che comincia per vocale (듣다 → 들어요, 묻다 → 물어요).
  const softened = softenRieul(stem);
  if (softened && word.startsWith(softened)) {
    const after = word.slice(softened.length);
    const ending = ENDINGS.find((candidate) => after.startsWith(candidate));
    if (ending) return ending;
  }

  return null;
}

/**
 * La radice con la -시- di cortesia già attaccata: 아프 → 아프시, 찾 → 찾으시.
 * Serve per forme come 아프셨어요, dove la 시 si è fusa con il passato.
 */
function withHonorific(stem: string): string {
  if (stem.length === 0) return stem;
  const last = decompose(stem[stem.length - 1]);
  if (!last) return stem;
  return last.tail === '' ? `${stem}시` : `${stem}으시`;
}

/**
 * L'ultima sillaba della radice con la ㄷ al posto della ㄹ finale: 걷 → 걸.
 * Restituisce `null` se la radice non finisce con la ㄷ.
 */
function softenRieul(stem: string): string | null {
  if (stem.length === 0) return null;
  const last = decompose(stem[stem.length - 1]);
  if (!last || last.tail !== 'ㄷ') return null;
  const changed = compose(last.lead, last.vowel, 'ㄹ');
  return changed ? stem.slice(0, -1) + changed : null;
}

export function lookupWord(entries: readonly VocabEntry[], word: string): WordMatch | null {
  const wanted = normalizeHangul(word).trim();
  if (wanted.length === 0) return null;
  const byKo = indexOf(entries);

  for (const { word: candidate, note } of candidates(wanted)) {
    const match = matchOne(byKo, candidate);
    if (match) return note ? { ...match, note: match.note ? `${note}; ${match.note}` : note } : match;
  }

  // La copula su un nome proprio o su un numero: 마르코예요, 사천 원이에요.
  const copula = COPULAS.find(({ suffix }) => wanted.length > suffix.length && wanted.endsWith(suffix));
  if (copula) {
    const base = wanted.slice(0, -copula.suffix.length);
    const person = readProperNoun(base);
    if (person) {
      return { entry: entryOf(base, person.it, person.rr), via: 'name', suffix: copula.suffix, note: copula.hint };
    }
    const amount = readNumber(base);
    if (amount) {
      return {
        entry: entryOf(base, `${formatNumber(amount.value)} (numero)`, amount.rr),
        via: 'number',
        suffix: copula.suffix,
        note: copula.hint,
      };
    }
  }

  return null;
}
