import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@ciaocorea/shared';
import { lookupWord } from './lookup';

function entry(ko: string, it: string, rr: string): VocabEntry {
  return { ko, it, rr, courseSlug: 'a2', courseTitle: 'A2', lessonId: 'a2-05', lessonTitle: 'Lezione' };
}

const entries = [
  entry('학교', 'scuola', 'hakgyo'),
  entry('먹다', 'mangiare', 'meokda'),
  entry('만나다', 'incontrare', 'mannada'),
  entry('물', 'acqua', 'mul'),
  entry('좋다', 'essere buono', 'jota'),
  entry('배', 'pera', 'bae'),
  entry('배', 'pancia', 'bae'),
  entry('원', 'won (moneta)', 'won'),
  entry('얼마예요?', 'quanto costa?', 'eolmeyeyo'),
  entry('부르다', 'chiamare', 'bureuda'),
  entry('계시다', 'esserci (cortesia di 있다)', 'gyesida'),
  entry('오다', 'venire', 'oda'),
  entry('오르다', 'salire', 'oreuda'),
  entry('쪽', 'lato', 'jjok'),
  entry('저쪽', 'da quella parte', 'jeojjok'),
  entry('말씀', 'parola (di rispetto)', 'malsseum'),
  entry('고맙다', 'essere grato', 'gomapda'),
];

describe('lookupWord', () => {
  it('trova la parola esatta', () => {
    expect(lookupWord(entries, '학교')?.entry.it).toBe('scuola');
  });

  it('toglie la particella', () => {
    expect(lookupWord(entries, '학교에')?.entry.ko).toBe('학교');
    expect(lookupWord(entries, '물을')?.entry.ko).toBe('물');
    expect(lookupWord(entries, '학교에서는')?.entry.ko).toBe('학교');
  });

  it('dice quale particella ha tolto e a che cosa serve', () => {
    const oggetto = lookupWord(entries, '물을');
    expect(oggetto?.particle).toBe('을');
    expect(oggetto?.particleHint).toContain('oggetto');

    const luogo = lookupWord(entries, '학교에서');
    expect(luogo?.particle).toBe('에서');
    expect(luogo?.particleHint).toContain('luogo');

    // 에서 non va letto come 에 seguito da una parola che finisce per 서.
    expect(lookupWord(entries, '학교에서는')?.particle).toBe('에서는');
    expect(lookupWord(entries, '학교')?.particle).toBeUndefined();
  });

  it('riconosce la forma coniugata dalla radice', () => {
    expect(lookupWord(entries, '먹었어요')?.entry.ko).toBe('먹다');
    expect(lookupWord(entries, '만나요')?.entry.ko).toBe('만나다');
    expect(lookupWord(entries, '좋아요')?.entry.ko).toBe('좋다');
  });

  it('dice quale desinenza ha riconosciuto', () => {
    expect(lookupWord(entries, '먹었어요')?.ending).toBe('었');
    expect(lookupWord(entries, '먹었어요')?.particle).toBeUndefined();
  });

  it('non inventa un match quando la parola non c’è', () => {
    expect(lookupWord(entries, '바다')).toBeNull();
    expect(lookupWord(entries, '먹이')).toBeNull();
  });

  it('mostra tutti i significati della stessa parola', () => {
    const pera = lookupWord(entries, '배');
    expect(pera?.entry.it).toBe('pera');
    expect(pera?.senses?.map((sense) => sense.it)).toEqual(['pancia']);
  });

  it('attraversa la punteggiatura del vocabolario', () => {
    // La voce è scritta «얼마예요?»: il punto interrogativo non deve nasconderla.
    expect(lookupWord(entries, '얼마예요')?.entry.it).toBe('quanto costa?');
  });

  it('toglie la copula e dice quale era', () => {
    const form = lookupWord(entries, '원이에요');
    expect(form?.entry.ko).toBe('원');
    expect(form?.via).toBe('copula');
    expect(form?.suffix).toBe('이에요');
    expect(lookupWord(entries, '원입니다')?.suffix).toBe('입니다');
  });

  it('legge i numeri e i nomi propri', () => {
    const number = lookupWord(entries, '사천오백');
    expect(number?.via).toBe('number');
    expect(number?.entry.it).toBe('4.500 (numero)');

    const name = lookupWord(entries, '지수');
    expect(name?.via).toBe('name');
    expect(name?.entry.it).toContain('nome');
  });

  it('non scambia un nome con una particella per un verbo', () => {
    expect(lookupWord(entries, '물이')?.entry.ko).toBe('물');
    expect(lookupWord(entries, '학교를')?.entry.ko).toBe('학교');
  });
});

describe('lookupWord: le forme che si allontanano dalla radice', () => {
  it('riconosce la 르 irregolare: 부르 + 어요 = 불러요', () => {
    expect(lookupWord(entries, '불러요')?.entry.ko).toBe('부르다');
    expect(lookupWord(entries, '불러요')?.ending).toBe('어요');
  });

  it('riconosce la 시 + 어 che si stringe in 세: 계세요', () => {
    expect(lookupWord(entries, '계세요')?.entry.ko).toBe('계시다');
    expect(lookupWord(entries, '계세요')?.ending).toBe('어요');
  });

  it('riconosce la ㄴ che si appoggia alla radice: 온다고, 오른다고', () => {
    expect(lookupWord(entries, '온다고')?.entry.ko).toBe('오다');
    expect(lookupWord(entries, '온다고')?.ending).toBe('ㄴ다고');
    expect(lookupWord(entries, '오른다고')?.entry.ko).toBe('오르다');
  });

  it('riconosce la ㅂ irregolare: 고맙다 → 고마워', () => {
    expect(lookupWord(entries, '고마워요')?.entry.ko).toBe('고맙다');
  });

  it('toglie la particella da un nome composto: 저쪽에', () => {
    const found = lookupWord(entries, '저쪽에');
    expect(found?.entry.ko).toBe('저쪽');
    expect(found?.via).toBe('particle');
    expect(found?.particle).toBe('에');
  });

  it('legge la copula con la cortesia: 말씀이시죠', () => {
    expect(lookupWord(entries, '말씀이시죠')?.entry.ko).toBe('말씀');
    expect(lookupWord(entries, '말씀이시죠')?.suffix).toBe('이시죠');
  });

  it('legge una cifra con il contatore', () => {
    const floor = lookupWord(entries, '5층');
    expect(floor?.via).toBe('number');
    expect(floor?.entry.it).toContain('piano');
    expect(floor?.note).toBe('si legge 오층');
    expect(lookupWord(entries, '1만')?.entry.it).toContain('10.000');
  });
});

describe('lookupWord: le contrazioni del parlato', () => {
  const forms = [
    entry('하다', 'fare', 'hada'),
    entry('되다', 'diventare', 'doeda'),
    entry('비다', 'essere vuoto', 'bida'),
    entry('말하다', 'parlare', 'malhada'),
    entry('걷다', 'camminare', 'geotda'),
    entry('결제하다', 'pagare', 'gyeoljehada'),
    entry('아프다', 'fare male', 'apeuda'),
    entry('돕다', 'aiutare', 'dopda'),
    entry('찾다', 'cercare', 'chatda'),
    entry('가다', 'andare', 'gada'),
    entry('주다', 'dare', 'juda'),
    entry('것', 'cosa', 'geot'),
    entry('나', 'io', 'na'),
    entry('부산', 'Busan', 'busan'),
    entry('쯤', 'circa', 'jjeum'),
    entry('시간', 'tempo, ora', 'sigan'),
    entry('부르다', 'chiamare', 'bureuda'),
    entry('고맙다', 'essere grato', 'gomapda'),
    entry('오다', 'venire', 'oda'),
  ];

  it('ricostruisce il passato contratto: 하 + 았 = 했, 되 + 었 = 됐', () => {
    expect(lookupWord(forms, '했어요')?.entry.ko).toBe('하다');
    expect(lookupWord(forms, '했어요')?.ending).toBe('았');
    expect(lookupWord(forms, '됐어요')?.entry.ko).toBe('되다');
  });

  it('sceglie l’armonia giusta per le radici in ㅡ: 아프 + 았 = 아팠', () => {
    expect(lookupWord(forms, '아팠어요')?.entry.ko).toBe('아프다');
    expect(lookupWord(forms, '아팠어요')?.ending).toBe('았');
  });

  it('riconosce la radice con l’onorifico dentro la contrazione: 아프셨어요', () => {
    expect(lookupWord(forms, '아프셨어요')?.entry.ko).toBe('아프다');
    expect(lookupWord(forms, '아프셨어요')?.ending).toBe('었');
  });

  it('unisce la vocale della radice con quella della desinenza', () => {
    expect(lookupWord(forms, '와서')?.entry.ko).toBe('오다');
    expect(lookupWord(forms, '돼요')?.entry.ko).toBe('되다');
    expect(lookupWord(forms, '비어요')?.entry.ko).toBe('비다');
    expect(lookupWord(forms, '말해요')?.entry.ko).toBe('말하다');
    expect(lookupWord(forms, '가서')?.entry.ko).toBe('가다');
  });

  it('raddoppia la ㄹ della 르 irregolare e ammorbidisce la ㄷ', () => {
    expect(lookupWord(forms, '걸어서')?.entry.ko).toBe('걷다');
    expect(lookupWord(forms, '불러요')?.entry.ko).toBe('부르다');
  });

  it('legge la ㅂ irregolare: 돕 + 아 = 도와', () => {
    expect(lookupWord(forms, '도와')?.entry.ko).toBe('돕다');
    expect(lookupWord(forms, '고마워요')?.entry.ko).toBe('고맙다');
  });

  it('assorbe la ㄹ nel participio futuro: 결제하 + ㄹ = 결제할', () => {
    expect(lookupWord(forms, '결제할')?.entry.ko).toBe('결제하다');
    expect(lookupWord(forms, '결제할')?.ending).toBe('ㄹ');
  });

  it('legge la forma cortese in ㅂ니다', () => {
    expect(lookupWord(forms, '합니다')?.entry.ko).toBe('하다');
    expect(lookupWord(forms, '합니다')?.ending).toBe('ㅂ니다');
  });

  it('riprova la radice con l’onorifico: 찾 + 으시 = 찾으세요', () => {
    expect(lookupWord(forms, '찾으세요')?.entry.ko).toBe('찾다');
    expect(lookupWord(forms, '찾으세요')?.ending).toBe('으세요');
    expect(lookupWord(forms, '주세요')?.entry.ko).toBe('주다');
  });

  it('scioglie le forme del parlato: 거예요, 내가', () => {
    // 거 è 것 nel parlato, 내가 è 나 + 가.
    expect(lookupWord(forms, '거예요')?.entry.ko).toBe('것');
    expect(lookupWord(forms, '내가')?.entry.ko).toBe('나');
    expect(lookupWord(forms, '내가')?.note).toContain('나');
  });

  it('toglie la particella anche dai nomi propri e dice 쯤', () => {
    expect(lookupWord(forms, '부산까지')?.entry.ko).toBe('부산');
    expect(lookupWord(forms, '부산까지')?.via).toBe('particle');
    expect(lookupWord(forms, '시간쯤')?.entry.ko).toBe('시간');
    expect(lookupWord(forms, '시간쯤')?.particle).toBe('쯤');
  });
});
