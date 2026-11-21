/**
 * Coniugazione delle forme che il percorso insegna, a partire dalla voce di
 * dizionario (먹다, 살다, 모르다…). Serve alla pagina «Coniuga»: lo studente
 * cerca un verbo e vede le forme vere, con la classe irregolare che spiega
 * perché sono così.
 *
 * Le regole seguono le classi descritte nelle lezioni del corso «Radici»
 * (ㄷ, ㄹ, ㅅ, ㅂ, ㅎ, 르, ㅡ) e sono fissate dai test: ogni forma attesa nei
 * test viene da un paradigma verificato (Wiktionary, voce per voce), non da una
 * deduzione. Le classi restituiscono `null` per le forme che non sono state
 * verificate, e la pagina le mostra come «—».
 *
 * Le regole di fonologia sono poche:
 * - armonia vocalica: 아 dopo ㅏ/ㅗ (e dopo ㅐ, ㅖ, ㅚ), 어 altrove;
 * - le vocali si fondono quando la radice finisce per vocale: 오+아→와,
 *   우+어→워, 이+어→여, 으→(ㅓ), 하+아→해;
 * - le desinenze che cominciano per vocale (아/어, 았/었, (으)ㄴ, (으)ㄹ) sono
 *   quelle che scatenano le irregolarità; quelle che cominciano per consonante
 *   (고, 지만, 는, ㅂ니다) lasciano la radice com'è.
 */
import { compose, decompose, type Syllable } from './hangul';

export type ConjugationClassId =
  | 'regolare'
  | 'hada'
  | 'contrazione'
  | 'd'
  | 'l'
  | 's'
  | 'b'
  | 'h'
  | 'reu'
  | 'eu';

export interface ConjugationClass {
  id: ConjugationClassId;
  /** Come si chiama la classe nella pagina. */
  label: string;
  /** Come riconoscerla guardando il dizionario. */
  signal: string;
  /** Cosa succede, in una frase. */
  rule: string;
  /** Voci che appartengono alla classe, oltre a quelle del dizionario. */
  examples: string[];
}

export const CONJUGATION_CLASSES: ConjugationClass[] = [
  {
    id: 'regolare',
    label: 'Radice regolare',
    signal: 'Radice che finisce per consonante (먹-, 읽-) o per vocale che si contrae (가-, 오-).',
    rule:
      'La desinenza si attacca alla radice; l’ultima vocale decide 아/어. Davanti a vocale le vocali si fondono: 가다 → 가요, 오다 → 와요, 보다 → 봐요, 주다 → 줘요, 마시다 → 마셔요.',
    examples: ['먹다', '읽다', '가다', '오다', '보다', '주다', '마시다', '기다리다'],
  },
  {
    id: 'hada',
    label: 'Verbi in -하다',
    signal: 'La voce finisce per 하다 (공부하다, 이야기하다).',
    rule: '하다 diventa 해: 해요, 했어요; davanti a consonante resta 하: 합니다, 하고, 하지만.',
    examples: ['공부하다', '이야기하다', '사랑하다', '궁금하다'],
  },
  {
    id: 'contrazione',
    label: 'Contrazione di vocale',
    signal: 'Radice in vocale che si fonde con 아/어 (가-, 오-, 보-, 주-, 되-, 서-, 사-, 세-, 싸-).',
    rule:
      'Le due vocali diventano una: 가+아→가, 오+아→와, 보+아→봐, 주+어→줘, 되+어→돼, 세+어→세, 하+아→해. Il passato aggiunge ㅆ alla vocale già contratta: 갔어요, 봤어요, 했어요.',
    examples: ['가다', '오다', '보다', '주다', '되다', '서다', '사다', '세다', '싸다'],
  },
  {
    id: 'd',
    label: 'Irregolare in ㄷ',
    signal: 'Radice che finisce per ㄷ: 듣-, 걷-, 묻-, 싣-.',
    rule:
      'Davanti a una desinenza che comincia per vocale la ㄷ diventa ㄹ: 듣다 → 들어요, 들었어요, 들을 거예요. Davanti a consonante resta ㄷ: 듣습니다, 듣고, 듣는.',
    examples: ['듣다', '걷다', '묻다', '싣다', '깨닫다'],
  },
  {
    id: 'l',
    label: 'Radice in ㄹ',
    signal: 'Radice che finisce per ㄹ: 살-, 알-, 만들-, 울-, 멀-, 길-.',
    rule:
      'Davanti a vocale la ㄹ resta: 살아요, 알아요, 만들어요. Davanti a ㄴ, ㅂ e ㅅ sparisce: 사는, 삽니다, 사세요. Le desinenze (으)… non prendono la 으: 살면, 살 거예요, 사는.',
    examples: ['살다', '알다', '만들다', '울다', '멀다', '길다', '팔다', '몰다', '낯설다'],
  },
  {
    id: 's',
    label: 'Irregolare in ㅅ',
    signal: 'Radice che finisce per ㅅ: 붓-, 짓-, 낫-, 잇-, 긋-.',
    rule: 'Davanti a una desinenza che comincia per vocale la ㅅ sparisce: 붓다 → 부어요, 지어요. Davanti a consonante resta: 붓습니다, 붓고, 붓는.',
    examples: ['붓다', '짓다', '낫다', '잇다', '긋다'],
  },
  {
    id: 'b',
    label: 'Irregolare in ㅂ',
    signal: 'Radice che finisce per ㅂ, ma solo in un gruppo chiuso: 춥-, 덥-, 쉽-, 어렵-, 맵-, 가깝-, 무겁-, 고맙-, 시끄럽-, 돕-.',
    rule:
      'Davanti a vocale la ㅂ diventa 우: 춥다 → 추워요, 쉽다 → 쉬워요, 고맙다 → 고마워요. 돕다 e 곱다 fanno 오: 도와요. Davanti a consonante resta: 춥습니다, 춥고. I verbi come 잡다, 입다, 뽑다 restano regolari.',
    examples: ['춥다', '덥다', '쉽다', '어렵다', '맵다', '가깝다', '무겁다', '고맙다', '시끄럽다', '돕다'],
  },
  {
    id: 'h',
    label: 'Irregolare in ㅎ',
    signal: 'Aggettivi di colore (빨갛-, 파랗-, 노랗-, 하얗-) e la famiglia 그렇다 / 어떻다 / 이렇다.',
    rule:
      'Davanti a vocale la ㅎ sparisce e la vocale diventa ㅐ (ㅑ → ㅒ): 빨갛다 → 빨개요, 그렇다 → 그래요, 하얗다 → 하얘요. Il modificante è 빨간, 그런. Davanti a consonante resta ㅎ: 빨갛습니다, 빨갛고.',
    examples: ['빨갛다', '파랗다', '노랗다', '하얗다', '그렇다', '어떻다', '이렇다'],
  },
  {
    id: 'reu',
    label: 'Irregolare in 르',
    signal: 'Radice che finisce per 르: 모르-, 빠르-, 다르-, 부르-, 마르-, 오르-.',
    rule:
      'La ㅡ sparisce e la ㄹ raddoppia davanti a vocale: 모르다 → 몰라요, 빠르다 → 빨라요, 부르다 → 불러요. Davanti a consonante la radice resta intera: 모르고, 모릅니다, 모를 거예요.',
    examples: ['모르다', '빠르다', '다르다', '부르다', '마르다', '오르다'],
  },
  {
    id: 'eu',
    label: 'Radice in ㅡ',
    signal: 'Radice che finisce per ㅡ: 쓰-, 크-, 바쁘-, 예쁘-, 아프-, 슬프-.',
    rule:
      'Davanti a vocale la ㅡ sparisce e prende la vocale dell’armonia, guardando la sillaba prima: 쓰다 → 써요, 크다 → 커요, 바쁘다 → 바빠요, 예쁘다 → 예뻐요. Davanti a consonante resta: 쓰고, 씁니다, 쓸 거예요.',
    examples: ['쓰다', '크다', '바쁘다', '예쁘다', '아프다', '슬프다', '기쁘다'],
  },
];

export type ConjugationEndingKey =
  | 'presente'
  | 'passato'
  | 'causale'
  | 'connettivo'
  | 'avversativo'
  | 'formale'
  | 'futuro'
  | 'modificanteVerbo'
  | 'modificanteNome';

export interface ConjugationEnding {
  key: ConjugationEndingKey;
  ending: string;
  label: string;
  hint: string;
}

export const CONJUGATION_ENDINGS: ConjugationEnding[] = [
  { key: 'presente', ending: '-아/어요', label: 'Presente cortese', hint: 'la forma che si usa parlando con tutti' },
  { key: 'passato', ending: '-았/었어요', label: 'Passato cortese', hint: 'quello che è già successo' },
  { key: 'causale', ending: '-아/어서', label: 'Causa', hint: '«perché…», «siccome…»' },
  { key: 'connettivo', ending: '-고', label: 'Collegamento', hint: '«e», «e poi»' },
  { key: 'avversativo', ending: '-지만', label: 'Contrasto', hint: '«ma», «però»' },
  { key: 'formale', ending: '-ㅂ니다 / -습니다', label: 'Formale', hint: 'notizie, presentazioni, testi' },
  { key: 'futuro', ending: '-(으)ㄹ 거예요', label: 'Futuro', hint: 'quello che succederà o l’intenzione' },
  { key: 'modificanteVerbo', ending: '-는', label: 'Che… (verbi)', hint: 'l’azione che si sta svolgendo: 먹는 사람' },
  { key: 'modificanteNome', ending: '-(으)ㄴ / -은', label: 'Che… (qualità)', hint: 'la qualità: 큰 집; sui verbi è il passato: 먹은 음식' },
];

/** I verbi che restano regolari pur finendo per 르 (따라요, 치러요…). */
const R_LIKE_REGULAR = new Set(['따르다', '치르다', '들르다', '우러르다', '다다르다']);
/** Radici in ㄷ irregolari: la ㄷ diventa ㄹ davanti a vocale. */
const D_IRREGULAR = new Set(['걷다', '듣다', '묻다', '싣다', '깨닫다', '긷다', '붇다', '눋다']);
/** Radici in ㅅ irregolari: la ㅅ cade davanti a vocale (빚다 resta regolare). */
const S_IRREGULAR = new Set(['짓다', '낫다', '잇다', '붓다', '긋다', '젓다']);
/** Il gruppo chiuso della ㅂ: fuori da qui la ㅂ resta (잡다, 입다, 뽑다). */
const B_IRREGULAR = new Set([
  '춥다',
  '덥다',
  '쉽다',
  '어렵다',
  '맵다',
  '가깝다',
  '무겁다',
  '고맙다',
  '어둡다',
  '시끄럽다',
  '귀엽다',
  '무섭다',
  '차갑다',
  '따갑다',
  '눕다',
  '굽다',
  '돕다',
  '곱다',
]);
/** La ㅎ irregolare: colori e famiglia 그렇다. 좋다, 많다, 싫다 restano regolari. */
const H_IRREGULAR = new Set(['빨갛다', '파랗다', '노랗다', '하얗다', '그렇다', '어떻다', '이렇다', '저렇다']);
/** Parole che finiscono per 다 ma non sono predicati coniugabili. */
const NOT_PREDICATE = new Set(['바다', '감사합니다', '합니다', '않다', '이다', '아니다']);

/**
 * Gli aggettivi che il percorso incontra: per loro la forma in -는 non esiste
 * (l'attributivo è -(으)ㄴ: 좋은, 많은, 큰). L'elenco è chiuso perché la classe
 * di parola non si legge dalla forma: le voci fuori elenco vengono trattate
 * come verbi e la pagina lo dichiara.
 */
const ADJECTIVES = new Set([
  // dal percorso
  '가깝다',
  '가능하다',
  '같다',
  '건강하다',
  '고맙다',
  '곱다',
  '괜찮다',
  '궁금하다',
  '귀엽다',
  '그렇다',
  '기쁘다',
  '길다',
  '낯설다',
  '늦다',
  '다르다',
  '더디다',
  '덥다',
  '따갑다',
  '따뜻하다',
  '멀다',
  '많다',
  '맛없다',
  '맛있다',
  '맵다',
  '무겁다',
  '무섭다',
  '바쁘다',
  '배고프다',
  '불편하다',
  '비싸다',
  '비슷하다',
  '빠르다',
  '빨갛다',
  '슬프다',
  '쉽다',
  '시끄럽다',
  '시원하다',
  '싫다',
  '싸다',
  '심심하다',
  '아프다',
  '어둡다',
  '어렵다',
  '어떻다',
  '어리다',
  '없다',
  '예쁘다',
  '유명하다',
  '이렇다',
  '자유롭다',
  '재미없다',
  '재미있다',
  '조용하다',
  '좁다',
  '졸리다',
  '좋다',
  '죄송하다',
  '중요하다',
  '차갑다',
  '춥다',
  '크다',
  '파랗다',
  '편하다',
  '피곤하다',
  '하얗다',
  '행복하다',
  '확실하다',
  '힘들다',
  // altri comuni
  '간단하다',
  '급하다',
  '깨끗하다',
  '귀찮다',
  '높다',
  '낮다',
  '넓다',
  '똑똑하다',
  '멋있다',
  '미안하다',
  '밝다',
  '부끄럽다',
  '부지런하다',
  '불행하다',
  '신기하다',
  '심하다',
  '안전하다',
  '어색하다',
  '어리석다',
  '위험하다',
  '이상하다',
  '작다',
  '정직하다',
  '충분하다',
  '특별하다',
  '훌륭하다',
]);


/** I verbi che il percorso insegna: per loro la forma in -는 è sempre quella giusta. */
const VERBS = new Set([
  '가다',
  '가르치다',
  '가져가다',
  '갈아타다',
  '걷다',
  '결제하다',
  '계산하다',
  '계시다',
  '구경하다',
  '기다리다',
  '기억하다',
  '꺼지다',
  '끝나다',
  '나다',
  '나오다',
  '낮아지다',
  '내다',
  '내리다',
  '넣다',
  '놀다',
  '늦추다',
  '닫다',
  '닫히다',
  '도와드리다',
  '도와주다',
  '도착하다',
  '돕다',
  '되다',
  '되시다',
  '두다',
  '드리다',
  '드시다',
  '듣다',
  '들어가다',
  '마르다',
  '마시다',
  '만나다',
  '만들다',
  '만지다',
  '말하다',
  '먹다',
  '모르다',
  '못하다',
  '물어보다',
  '믿다',
  '발표하다',
  '밝히다',
  '변경되다',
  '보내다',
  '보다',
  '부르다',
  '부탁하다',
  '붓다',
  '비비다',
  '빌려주다',
  '빌리다',
  '사과하다',
  '사다',
  '산책하다',
  '살다',
  '상담하다',
  '생기다',
  '서다',
  '설명하다',
  '소개하다',
  '수영하다',
  '쉬다',
  '시작하다',
  '시키다',
  '식다',
  '싣다',
  '싫어하다',
  '앉다',
  '알다',
  '알리다',
  '얼다',
  '여행하다',
  '열다',
  '열리다',
  '오다',
  '오르다',
  '올리다',
  '요리하다',
  '운전하다',
  '울다',
  '움직이다',
  '인사하다',
  '일하다',
  '읽다',
  '잇다',
  '있다',
  '자다',
  '자르다',
  '잘하다',
  '잠들다',
  '전화하다',
  '조심하다',
  '좋아하다',
  '주다',
  '주문하다',
  '준비하다',
  '지각하다',
  '지나다',
  '지내다',
  '찍다',
  '찾다',
  '찾아가다',
  '출근하다',
  '출발하다',
  '치르다',
  '켜다',
  '켜지다',
  '타다',
  '포기하다',
  '포함되다',
  '하다',
  '확인하다',
]);

const A_GROUP = new Set(['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅖ']);

/** Armonia larga: 아 dopo ㅏ/ㅗ e dopo ㅐ/ㅖ/ㅚ (보내요, 세요, 돼요). */
function harmony(vowel: string): 'ㅏ' | 'ㅓ' {
  return A_GROUP.has(vowel) ? 'ㅏ' : 'ㅓ';
}

/** Armonia stretta delle radici in ㅡ: solo ㅏ e ㅗ vogliono 아 (바빠요, 예뻐요). */
function tightHarmony(vowel: string): 'ㅏ' | 'ㅓ' {
  return vowel === 'ㅏ' || vowel === 'ㅗ' ? 'ㅏ' : 'ㅓ';
}

/** La ㅎ caduta porta la vocale verso ㅐ/ㅒ (빨개요, 그래요, 하얘요). */
const H_CONTRACTION: Record<string, string> = {
  'ㅏ': 'ㅐ',
  'ㅑ': 'ㅒ',
  'ㅓ': 'ㅐ',
  'ㅕ': 'ㅖ',
  'ㅗ': 'ㅙ',
  'ㅜ': 'ㅞ',
  'ㅡ': 'ㅐ',
};

const FUSION: Array<[string, string, string]> = [
  ['ㅏ', 'ㅏ', 'ㅏ'],
  ['ㅏ', 'ㅓ', 'ㅐ'],
  ['ㅓ', 'ㅏ', 'ㅐ'],
  ['ㅓ', 'ㅓ', 'ㅓ'],
  ['ㅗ', 'ㅏ', 'ㅘ'],
  ['ㅗ', 'ㅓ', 'ㅝ'],
  ['ㅜ', 'ㅏ', 'ㅘ'],
  ['ㅜ', 'ㅓ', 'ㅝ'],
  ['ㅣ', 'ㅓ', 'ㅕ'],
  ['ㅐ', 'ㅏ', 'ㅐ'],
  ['ㅐ', 'ㅓ', 'ㅐ'],
  ['ㅔ', 'ㅓ', 'ㅔ'],
  ['ㅚ', 'ㅏ', 'ㅙ'],
  ['ㅚ', 'ㅓ', 'ㅙ'],
  ['ㅕ', 'ㅓ', 'ㅕ'],
  ['ㅖ', 'ㅏ', 'ㅖ'],
  ['ㅖ', 'ㅓ', 'ㅖ'],
  ['ㅡ', 'ㅏ', 'ㅏ'],
  ['ㅡ', 'ㅓ', 'ㅓ'],
];

function fuse(vowel: string, ending: string): string | null {
  const hit = FUSION.find(([a, b]) => a === vowel && b === ending);
  return hit ? hit[2] : null;
}

interface Stem {
  blocks: Syllable[];
  /** Per la classe 르: la desinenza prende la ㄹ come iniziale (몰라요). */
  endingLead: string;
}

function blocksOf(word: string): Syllable[] | null {
  const out: Syllable[] = [];
  for (const char of word) {
    const block = decompose(char);
    if (!block) return null;
    out.push({ ...block });
  }
  return out.length > 0 ? out : null;
}

function render(blocks: Syllable[]): string {
  return blocks.map((block) => compose(block.lead, block.vowel, block.tail) ?? '').join('');
}

function last(blocks: Syllable[]): Syllable {
  return blocks[blocks.length - 1];
}

export type PredicateKind = 'verb' | 'adjective' | 'unknown';

export interface LemmaClass {
  id: ConjugationClassId;
  label: string;
  info: ConjugationClass;
  kind: PredicateKind;
}

/** Riconosce la classe di una voce di dizionario. `null` se non è un predicato. */
export function classifyLemma(lemma: string): LemmaClass | null {
  if (!lemma.endsWith('다') || lemma.length < 2) return null;
  if (NOT_PREDICATE.has(lemma)) return null;
  const stem = lemma.slice(0, -1);
  const blocks = blocksOf(stem);
  if (!blocks) return null;
  const head = last(blocks);
  let id: ConjugationClassId = 'regolare';

  if (stem.endsWith('하')) id = 'hada';
  else if (D_IRREGULAR.has(lemma)) id = 'd';
  else if (S_IRREGULAR.has(lemma)) id = 's';
  else if (B_IRREGULAR.has(lemma)) id = 'b';
  else if (H_IRREGULAR.has(lemma)) id = 'h';
  else if (head.lead === 'ㄹ' && head.vowel === 'ㅡ' && head.tail === '') id = R_LIKE_REGULAR.has(lemma) ? 'eu' : 'reu';
  else if (head.tail === 'ㄹ') id = 'l';
  else if (head.vowel === 'ㅡ') id = 'eu';
  else if (head.tail === '') id = 'contrazione';

  const info = CONJUGATION_CLASSES.find((entry) => entry.id === id);
  if (!info) return null;
  const kind: PredicateKind = ADJECTIVES.has(lemma) ? 'adjective' : VERBS.has(lemma) ? 'verb' : 'unknown';
  return { id, label: info.label, info, kind };
}

/** La radice pronta per una desinenza che comincia per vocale. */
function vowelStem(lemma: string, cls: ConjugationClassId, bVowel: 'ㅜ' | 'ㅗ' = 'ㅜ'): Stem {
  const blocks = blocksOf(lemma.slice(0, -1));
  if (!blocks) return { blocks: [], endingLead: '' };
  let endingLead = '';
  const head = last(blocks);

  switch (cls) {
    case 'd':
      head.tail = 'ㄹ';
      break;
    case 's':
      head.tail = '';
      break;
    case 'h':
      head.tail = '';
      head.vowel = H_CONTRACTION[head.vowel] ?? head.vowel;
      break;
    case 'b':
      head.tail = '';
      blocks.push({ lead: 'ㅇ', vowel: bVowel, tail: '' });
      break;
    case 'reu': {
      const previous = blocks[blocks.length - 2];
      blocks.pop();
      if (previous && !R_LIKE_REGULAR.has(lemma)) previous.tail = 'ㄹ';
      endingLead = 'ㄹ';
      break;
    }
    case 'eu': {
      const previous = blocks[blocks.length - 2];
      head.vowel = tightHarmony(previous?.vowel ?? '');
      head.tail = '';
      break;
    }
    default:
      break;
  }

  return { blocks, endingLead };
}

/** La ㅂ irregolare diventa 오 solo in 돕다 e 곱다. */
function bVowelFor(lemma: string): 'ㅜ' | 'ㅗ' {
  return lemma === '돕다' || lemma === '곱다' ? 'ㅗ' : 'ㅜ';
}

/** Radice del presente: gestisce 하+아→해 e la ㅅ caduta. */
function presentStem(lemma: string, cls: ConjugationClassId): Stem {
  const stem = vowelStem(lemma, cls, bVowelFor(lemma));
  const head = last(stem.blocks);
  if (cls === 'hada' && head.lead === 'ㅎ' && head.vowel === 'ㅏ' && head.tail === '') {
    head.vowel = 'ㅐ';
  }
  return stem;
}

/** Aggiunge una desinenza vocalica, fondendo se la radice finisce per vocale. */
function addVowelEnding(stem: Stem, vowel: string, tail: string, rest: string): string {
  const blocks = stem.blocks.map((block) => ({ ...block }));
  const head = last(blocks);

  if (stem.endingLead) {
    blocks.push({ lead: stem.endingLead, vowel, tail });
  } else if (head.tail === '') {
    const fused = fuse(head.vowel, vowel);
    if (fused) {
      head.vowel = fused;
      head.tail = tail;
    } else {
      blocks.push({ lead: 'ㅇ', vowel, tail });
    }
  } else {
    blocks.push({ lead: 'ㅇ', vowel, tail });
  }

  return render(blocks) + rest;
}

function present(lemma: string, cls: ConjugationClassId): string {
  const stem = presentStem(lemma, cls);
  const head = last(stem.blocks);
  const target = harmony(head.vowel);
  if (cls === 's') {
    // La ㅅ caduta non fa contrarre: 부어요, non 붜요.
    const blocks = stem.blocks.map((block) => ({ ...block }));
    blocks.push({ lead: 'ㅇ', vowel: target, tail: '' });
    return render(blocks) + '요';
  }
  if (cls === 'h') {
    // La ㅎ ha già portato la vocale a ㅐ/ㅒ: 빨개요, 하얘요.
    return render(stem.blocks) + '요';
  }
  return addVowelEnding(stem, target, '', '요');
}

function past(lemma: string, cls: ConjugationClassId): string {
  const stem = vowelStem(lemma, cls, bVowelFor(lemma));
  const head = last(stem.blocks);
  const target = harmony(head.vowel);

  if (stem.endingLead || head.tail !== '' || cls === 's') {
    const blocks = stem.blocks.map((block) => ({ ...block }));
    blocks.push({ lead: stem.endingLead || 'ㅇ', vowel: target, tail: 'ㅆ' });
    return render(blocks) + '어요';
  }

  if (cls === 'hada' && head.lead === 'ㅎ' && head.vowel === 'ㅏ') {
    head.vowel = 'ㅐ';
  } else if (head.vowel === 'ㅖ') {
    head.vowel = 'ㅏ';
  } else {
    head.vowel = fuse(head.vowel, target) ?? head.vowel;
  }
  head.tail = 'ㅆ';
  return render(stem.blocks) + '어요';
}

function causal(lemma: string, cls: ConjugationClassId): string {
  const stem = presentStem(lemma, cls);
  const head = last(stem.blocks);
  const target = harmony(head.vowel);
  if (cls === 's') {
    const blocks = stem.blocks.map((block) => ({ ...block }));
    blocks.push({ lead: 'ㅇ', vowel: target, tail: '' });
    return render(blocks) + '서';
  }
  if (cls === 'h') return render(stem.blocks) + '서';
  return addVowelEnding(stem, target, '', '서');
}

function connective(lemma: string): string {
  return render(blocksOf(lemma.slice(0, -1)) ?? []) + '고';
}

function adversative(lemma: string): string {
  return render(blocksOf(lemma.slice(0, -1)) ?? []) + '지만';
}

function formal(lemma: string, cls: ConjugationClassId): string | null {
  const blocks = blocksOf(lemma.slice(0, -1));
  if (!blocks) return null;
  const head = last(blocks);

  // Davanti a -ㅂ니다/-습니다 la radice resta com'è, tranne la ㄹ e la 르:
  // 살다 → 삽니다, 모르다 → 모릅니다; 춥다 → 춥습니다, 잡다 → 잡습니다.
  if (cls === 'l' || cls === 'reu') head.tail = 'ㅂ';
  else if (head.tail === '') head.tail = 'ㅂ';
  else return render(blocks) + '습니다';

  return render(blocks) + '니다';
}

function future(lemma: string, cls: ConjugationClassId): string | null {
  const blocks = blocksOf(lemma.slice(0, -1));
  if (!blocks) return null;
  const head = last(blocks);

  if (cls === 'l') return render(blocks) + ' 거예요';
  if (cls === 'reu') {
    head.tail = 'ㄹ';
    return render(blocks) + ' 거예요';
  }
  if (cls === 'h') {
    // La ㅎ cade davanti a ㄹ: 빨갈 거예요, 그럴 거예요.
    head.tail = 'ㄹ';
    return render(blocks) + ' 거예요';
  }
  if (cls === 'd') {
    head.tail = 'ㄹ';
    blocks.push({ lead: 'ㅇ', vowel: 'ㅡ', tail: 'ㄹ' });
    return render(blocks) + ' 거예요';
  }
  if (cls === 's') {
    head.tail = '';
    blocks.push({ lead: 'ㅇ', vowel: 'ㅡ', tail: 'ㄹ' });
    return render(blocks) + ' 거예요';
  }
  if (cls === 'b') {
    head.tail = '';
    blocks.push({ lead: 'ㅇ', vowel: 'ㅜ', tail: 'ㄹ' });
    return render(blocks) + ' 거예요';
  }
  if (head.tail === '') {
    head.tail = 'ㄹ';
    return render(blocks) + ' 거예요';
  }
  blocks.push({ lead: 'ㅇ', vowel: 'ㅡ', tail: 'ㄹ' });
  return render(blocks) + ' 거예요';
}

function modifierVerbo(lemma: string, cls: LemmaClass): string | null {
  const stem = lemma.slice(0, -1);
  // 있다 e 없다 (e i composti) hanno proprio -는 come attributivo: 있는, 없는.
  if (stem.endsWith('있') || stem.endsWith('없')) return stem + '는';
  // Gli altri aggettivi non hanno la forma in -는: l'attributivo è -(으)ㄴ.
  if (cls.kind === 'adjective') return null;

  const blocks = blocksOf(lemma.slice(0, -1));
  if (!blocks) return null;
  const head = last(blocks);
  if (cls.id === 'l') head.tail = '';
  return render(blocks) + '는';
}

function modifierNome(lemma: string, cls: LemmaClass): string | null {
  const stem = lemma.slice(0, -1);

  // 있다 e 없다 (e i composti 맛있다, 재미없다…) hanno -는 come attributivo
  // del presente: 있는, 없는. Per 있다 il passato è però 있은.
  if (stem === '있') return '있은';
  if (stem.endsWith('있') || stem.endsWith('없')) return stem + '는';

  if (cls.id === 'd') {
    const base = vowelStem(lemma, 'd');
    const head = last(base.blocks);
    if (head.tail === '') head.tail = 'ㄴ';
    else base.blocks.push({ lead: 'ㅇ', vowel: 'ㅡ', tail: 'ㄴ' });
    return render(base.blocks);
  }

  if (cls.id === 's') {
    // La ㅅ cade e resta il confine di sillaba: 나은, 지은, 부은.
    const base = vowelStem(lemma, 's');
    base.blocks.push({ lead: 'ㅇ', vowel: 'ㅡ', tail: 'ㄴ' });
    return render(base.blocks);
  }

  if (cls.id === 'b') {
    const base = vowelStem(lemma, 'b', 'ㅜ');
    last(base.blocks).tail = 'ㄴ';
    return render(base.blocks);
  }

  if (cls.id === 'h') {
    // La ㅎ cade ma la vocale resta: 빨간, 그런, 하얀.
    const original = blocksOf(stem);
    if (!original) return null;
    last(original).tail = 'ㄴ';
    return render(original);
  }

  const blocks = blocksOf(stem);
  if (!blocks) return null;
  const head = last(blocks);

  if (cls.id === 'l') {
    head.tail = 'ㄴ';
    return render(blocks);
  }

  if (head.tail === '') {
    head.tail = 'ㄴ';
    return render(blocks);
  }
  blocks.push({ lead: 'ㅇ', vowel: 'ㅡ', tail: 'ㄴ' });
  return render(blocks);
}

export interface ConjugatedForm {
  key: ConjugationEndingKey;
  form: string | null;
}

export interface ConjugationTable {
  lemma: string;
  stem: string;
  class: LemmaClass;
  forms: ConjugatedForm[];
  /** Le forme che la classe non permette di dare con sicurezza. */
  missing: ConjugationEndingKey[];
}

/** Coniuga una voce di dizionario; `null` se non è un verbo o un aggettivo. */
export function conjugate(lemma: string): ConjugationTable | null {
  const cls = classifyLemma(lemma);
  if (!cls) return null;

  const build: Record<ConjugationEndingKey, () => string | null> = {
    presente: () => present(lemma, cls.id),
    passato: () => past(lemma, cls.id),
    causale: () => causal(lemma, cls.id),
    connettivo: () => connective(lemma),
    avversativo: () => adversative(lemma),
    formale: () => formal(lemma, cls.id),
    futuro: () => future(lemma, cls.id),
    modificanteVerbo: () => modifierVerbo(lemma, cls),
    modificanteNome: () => modifierNome(lemma, cls),
  };

  const forms = CONJUGATION_ENDINGS.map(({ key }) => ({ key, form: build[key]() }));
  return {
    lemma,
    stem: lemma.slice(0, -1),
    class: cls,
    forms,
    missing: forms.filter((entry) => entry.form === null).map((entry) => entry.key),
  };
}
