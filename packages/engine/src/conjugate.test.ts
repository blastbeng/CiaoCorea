import { describe, expect, it } from 'vitest';
import { CONJUGATION_CLASSES, CONJUGATION_ENDINGS, classifyLemma, conjugate } from './conjugate';

/**
 * Ogni riga è un paradigma verificato su Wiktionary (sezione «Conjugation»,
 * forme 해요체 e determinanti): non è una deduzione dalla regola, è la forma
 * che i dizionari registrano. Se una regola cambia e una di queste righe
 * smette di tornare, il test lo dice.
 *
 * Ordine: voce, classe, presente, passato, causa (-아/어서), formale,
 * futuro, che… (verbo), che… (qualità).
 */
type Golden = [string, string, string, string, string, string, string, string | null, string];

const GOLDEN: Golden[] = [
  ['읽다', 'regolare', '읽어요', '읽었어요', '읽어서', '읽습니다', '읽을 거예요', '읽는', '읽은'],
  ['먹다', 'regolare', '먹어요', '먹었어요', '먹어서', '먹습니다', '먹을 거예요', '먹는', '먹은'],
  ['가다', 'contrazione', '가요', '갔어요', '가서', '갑니다', '갈 거예요', '가는', '간'],
  ['오다', 'contrazione', '와요', '왔어요', '와서', '옵니다', '올 거예요', '오는', '온'],
  ['보다', 'contrazione', '봐요', '봤어요', '봐서', '봅니다', '볼 거예요', '보는', '본'],
  ['주다', 'contrazione', '줘요', '줬어요', '줘서', '줍니다', '줄 거예요', '주는', '준'],
  ['마시다', 'contrazione', '마셔요', '마셨어요', '마셔서', '마십니다', '마실 거예요', '마시는', '마신'],
  ['기다리다', 'contrazione', '기다려요', '기다렸어요', '기다려서', '기다립니다', '기다릴 거예요', '기다리는', '기다린'],
  ['켜다', 'contrazione', '켜요', '켰어요', '켜서', '켭니다', '켤 거예요', '켜는', '켠'],
  ['세다', 'contrazione', '세요', '셌어요', '세서', '셉니다', '셀 거예요', '세는', '센'],
  ['싸다', 'contrazione', '싸요', '쌌어요', '싸서', '쌉니다', '쌀 거예요', null, '싼'],
  ['사다', 'contrazione', '사요', '샀어요', '사서', '삽니다', '살 거예요', '사는', '산'],
  ['서다', 'contrazione', '서요', '섰어요', '서서', '섭니다', '설 거예요', '서는', '선'],
  ['되다', 'contrazione', '돼요', '됐어요', '돼서', '됩니다', '될 거예요', '되는', '된'],
  ['하다', 'hada', '해요', '했어요', '해서', '합니다', '할 거예요', '하는', '한'],
  ['공부하다', 'hada', '공부해요', '공부했어요', '공부해서', '공부합니다', '공부할 거예요', '공부하는', '공부한'],
  ['듣다', 'd', '들어요', '들었어요', '들어서', '듣습니다', '들을 거예요', '듣는', '들은'],
  ['싣다', 'd', '실어요', '실었어요', '실어서', '싣습니다', '실을 거예요', '싣는', '실은'],
  ['믿다', 'regolare', '믿어요', '믿었어요', '믿어서', '믿습니다', '믿을 거예요', '믿는', '믿은'],
  ['닫다', 'regolare', '닫아요', '닫았어요', '닫아서', '닫습니다', '닫을 거예요', '닫는', '닫은'],
  ['붓다', 's', '부어요', '부었어요', '부어서', '붓습니다', '부을 거예요', '붓는', '부은'],
  ['짓다', 's', '지어요', '지었어요', '지어서', '짓습니다', '지을 거예요', '짓는', '지은'],
  ['낫다', 's', '나아요', '나았어요', '나아서', '낫습니다', '나을 거예요', '낫는', '나은'],
  ['긋다', 's', '그어요', '그었어요', '그어서', '긋습니다', '그을 거예요', '긋는', '그은'],
  ['젓다', 's', '저어요', '저었어요', '저어서', '젓습니다', '저을 거예요', '젓는', '저은'],
  ['빚다', 'regolare', '빚어요', '빚었어요', '빚어서', '빚습니다', '빚을 거예요', '빚는', '빚은'],
  ['춥다', 'b', '추워요', '추웠어요', '추워서', '춥습니다', '추울 거예요', null, '추운'],
  ['덥다', 'b', '더워요', '더웠어요', '더워서', '덥습니다', '더울 거예요', null, '더운'],
  ['쉽다', 'b', '쉬워요', '쉬웠어요', '쉬워서', '쉽습니다', '쉬울 거예요', null, '쉬운'],
  ['어렵다', 'b', '어려워요', '어려웠어요', '어려워서', '어렵습니다', '어려울 거예요', null, '어려운'],
  ['맵다', 'b', '매워요', '매웠어요', '매워서', '맵습니다', '매울 거예요', null, '매운'],
  ['가깝다', 'b', '가까워요', '가까웠어요', '가까워서', '가깝습니다', '가까울 거예요', null, '가까운'],
  ['무겁다', 'b', '무거워요', '무거웠어요', '무거워서', '무겁습니다', '무거울 거예요', null, '무거운'],
  ['고맙다', 'b', '고마워요', '고마웠어요', '고마워서', '고맙습니다', '고마울 거예요', null, '고마운'],
  ['돕다', 'b', '도와요', '도왔어요', '도와서', '돕습니다', '도울 거예요', '돕는', '도운'],
  ['곱다', 'b', '고와요', '고왔어요', '고와서', '곱습니다', '고울 거예요', null, '고운'],
  ['잡다', 'regolare', '잡아요', '잡았어요', '잡아서', '잡습니다', '잡을 거예요', '잡는', '잡은'],
  ['입다', 'regolare', '입어요', '입었어요', '입어서', '입습니다', '입을 거예요', '입는', '입은'],
  ['빨갛다', 'h', '빨개요', '빨갰어요', '빨개서', '빨갛습니다', '빨갈 거예요', null, '빨간'],
  ['파랗다', 'h', '파래요', '파랬어요', '파래서', '파랗습니다', '파랄 거예요', null, '파란'],
  ['하얗다', 'h', '하얘요', '하얬어요', '하얘서', '하얗습니다', '하얄 거예요', null, '하얀'],
  ['그렇다', 'h', '그래요', '그랬어요', '그래서', '그렇습니다', '그럴 거예요', null, '그런'],
  ['어떻다', 'h', '어때요', '어땠어요', '어때서', '어떻습니다', '어떨 거예요', null, '어떤'],
  ['좋다', 'regolare', '좋아요', '좋았어요', '좋아서', '좋습니다', '좋을 거예요', null, '좋은'],
  ['많다', 'regolare', '많아요', '많았어요', '많아서', '많습니다', '많을 거예요', null, '많은'],
  ['싫다', 'regolare', '싫어요', '싫었어요', '싫어서', '싫습니다', '싫을 거예요', null, '싫은'],
  ['모르다', 'reu', '몰라요', '몰랐어요', '몰라서', '모릅니다', '모를 거예요', '모르는', '모른'],
  ['빠르다', 'reu', '빨라요', '빨랐어요', '빨라서', '빠릅니다', '빠를 거예요', null, '빠른'],
  ['다르다', 'reu', '달라요', '달랐어요', '달라서', '다릅니다', '다를 거예요', null, '다른'],
  ['부르다', 'reu', '불러요', '불렀어요', '불러서', '부릅니다', '부를 거예요', '부르는', '부른'],
  ['마르다', 'reu', '말라요', '말랐어요', '말라서', '마릅니다', '마를 거예요', '마르는', '마른'],
  ['오르다', 'reu', '올라요', '올랐어요', '올라서', '오릅니다', '오를 거예요', '오르는', '오른'],
  ['따르다', 'eu', '따라요', '따랐어요', '따라서', '따릅니다', '따를 거예요', '따르는', '따른'],
  ['쓰다', 'eu', '써요', '썼어요', '써서', '씁니다', '쓸 거예요', '쓰는', '쓴'],
  ['크다', 'eu', '커요', '컸어요', '커서', '큽니다', '클 거예요', null, '큰'],
  ['바쁘다', 'eu', '바빠요', '바빴어요', '바빠서', '바쁩니다', '바쁠 거예요', null, '바쁜'],
  ['예쁘다', 'eu', '예뻐요', '예뻤어요', '예뻐서', '예쁩니다', '예쁠 거예요', null, '예쁜'],
  ['아프다', 'eu', '아파요', '아팠어요', '아파서', '아픕니다', '아플 거예요', null, '아픈'],
  ['살다', 'l', '살아요', '살았어요', '살아서', '삽니다', '살 거예요', '사는', '산'],
  ['알다', 'l', '알아요', '알았어요', '알아서', '압니다', '알 거예요', '아는', '안'],
  ['만들다', 'l', '만들어요', '만들었어요', '만들어서', '만듭니다', '만들 거예요', '만드는', '만든'],
  ['울다', 'l', '울어요', '울었어요', '울어서', '웁니다', '울 거예요', '우는', '운'],
  ['멀다', 'l', '멀어요', '멀었어요', '멀어서', '멉니다', '멀 거예요', null, '먼'],
  ['길다', 'l', '길어요', '길었어요', '길어서', '깁니다', '길 거예요', null, '긴'],
  ['있다', 'regolare', '있어요', '있었어요', '있어서', '있습니다', '있을 거예요', '있는', '있은'],
  ['없다', 'regolare', '없어요', '없었어요', '없어서', '없습니다', '없을 거예요', '없는', '없는'],
  ['맛있다', 'regolare', '맛있어요', '맛있었어요', '맛있어서', '맛있습니다', '맛있을 거예요', '맛있는', '맛있는'],
  ['괜찮다', 'regolare', '괜찮아요', '괜찮았어요', '괜찮아서', '괜찮습니다', '괜찮을 거예요', null, '괜찮은'],
  ['피곤하다', 'hada', '피곤해요', '피곤했어요', '피곤해서', '피곤합니다', '피곤할 거예요', null, '피곤한'],
  ['계시다', 'contrazione', '계셔요', '계셨어요', '계셔서', '계십니다', '계실 거예요', '계시는', '계신'],
];

const KEYS = CONJUGATION_ENDINGS.map((entry) => entry.key);

function formsOf(lemma: string): Record<string, string | null> {
  const table = conjugate(lemma);
  if (!table) throw new Error(`conjugate(${lemma}) è null`);
  return Object.fromEntries(table.forms.map((entry) => [entry.key, entry.form]));
}

describe('coniugazione', () => {
  it('copre tutte le desinenze della tabella', () => {
    expect(KEYS).toEqual([
      'presente',
      'passato',
      'causale',
      'connettivo',
      'avversativo',
      'formale',
      'futuro',
      'modificanteVerbo',
      'modificanteNome',
    ]);
  });

  for (const [lemma, cls, presente, passato, causale, formale, futuro, verbo, nome] of GOLDEN) {
    it(`${lemma}: paradigma verificato (${cls})`, () => {
      const table = conjugate(lemma);
      expect(table).not.toBeNull();
      expect(table?.class.id).toBe(cls);
      expect(formsOf(lemma)).toEqual({
        presente,
        passato,
        causale,
        connettivo: `${lemma.slice(0, -1)}고`,
        avversativo: `${lemma.slice(0, -1)}지만`,
        formale,
        futuro,
        modificanteVerbo: verbo,
        modificanteNome: nome,
      });
    });
  }

  it('dichiara le forme mancanti invece di inventarle', () => {
    const table = conjugate('좋다');
    expect(table?.missing).toEqual(['modificanteVerbo']);
  });

  it('non coniuga parole che finiscono per 다 ma non sono predicati', () => {
    for (const word of ['바다', '감사합니다', '합니다', '아니다', '이다', '않다']) {
      expect(classifyLemma(word)).toBeNull();
      expect(conjugate(word)).toBeNull();
    }
  });

  it('distingue gli aggettivi dai verbi per la forma in -는', () => {
    expect(classifyLemma('좋다')?.kind).toBe('adjective');
    expect(classifyLemma('먹다')?.kind).toBe('verb');
    expect(classifyLemma('춥다')?.kind).toBe('adjective');
    expect(classifyLemma('돕다')?.kind).toBe('verb');
  });

  it('tiene separate le classi che si somigliano', () => {
    expect(classifyLemma('빚다')?.id).toBe('regolare'); // ㅅ che non cade
    expect(classifyLemma('믿다')?.id).toBe('regolare'); // ㄷ che non diventa ㄹ
    expect(classifyLemma('잡다')?.id).toBe('regolare'); // ㅂ che non diventa 우
    expect(classifyLemma('따르다')?.id).toBe('eu'); // 르 senza raddoppio
    expect(classifyLemma('읽다')?.id).toBe('regolare'); // finale doppia
    expect(classifyLemma('싫다')?.id).toBe('regolare');
    expect(classifyLemma('살다')?.id).toBe('l');
  });

  it('ogni classe ha un nome, una regola e degli esempi coniugabili', () => {
    for (const cls of CONJUGATION_CLASSES) {
      expect(cls.label.length).toBeGreaterThan(0);
      expect(cls.rule.length).toBeGreaterThan(20);
      for (const example of cls.examples) {
        expect(classifyLemma(example), `${example} (${cls.id})`).not.toBeNull();
      }
    }
  });
});
