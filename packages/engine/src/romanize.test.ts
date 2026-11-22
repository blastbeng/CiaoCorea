import { describe, expect, it } from 'vitest';
import {
  isHangulSyllable,
  pronunciationRomanize,
  romanizeSyllable,
  romanizeText,
  romanizeWord,
  romanizationMatches,
} from './romanize';

/**
 * Le mappe di `romanize.ts` sono indicizzate per indice Unicode, non per
 * carattere jamo: questi test sono l'argomento che gli indici sono quelli
 * giusti. Ogni iniziale, ogni vocale e le finali comuni sono scritte come
 * sillabe vere, quindi se un indice fosse spostato il test si rompe.
 */
describe('indici della sillaba', () => {
  it('romanizza ogni iniziale alla sua sillaba', () => {
    const cases: [string, string][] = [
      ['가', 'ga'], ['까', 'kka'], ['나', 'na'], ['다', 'da'], ['라', 'ra'], ['마', 'ma'],
      ['따', 'tta'], ['바', 'ba'], ['빠', 'ppa'], ['사', 'sa'], ['짜', 'jja'],
      ['바', 'ba'], ['사', 'sa'], ['싸', 'ssa'], ['아', 'a'], ['자', 'ja'], ['차', 'cha'],
      ['카', 'ka'], ['타', 'ta'], ['파', 'pa'], ['하', 'ha'],
    ];
    for (const [syllable, expected] of cases) {
      expect(romanizeSyllable(syllable), syllable).toBe(expected);
    }
  });

  it('romanizza ogni vocale alla sua sillaba', () => {
    const cases: [string, string][] = [
      ['아', 'a'], ['애', 'ae'], ['야', 'ya'], ['얘', 'yae'], ['어', 'eo'], ['에', 'e'],
      ['여', 'yeo'], ['예', 'ye'], ['오', 'o'], ['와', 'wa'], ['왜', 'wae'], ['외', 'oe'],
      ['요', 'yo'], ['우', 'u'], ['워', 'wo'], ['웨', 'we'], ['위', 'wi'], ['유', 'yu'],
      ['으', 'eu'], ['의', 'ui'], ['이', 'i'],
    ];
    for (const [syllable, expected] of cases) {
      expect(romanizeSyllable(syllable), syllable).toBe(expected);
    }
  });

  it('romanizza le finali, anche quelle composte', () => {
    const cases: [string, string][] = [
      ['국', 'guk'], ['간', 'gan'], ['왅', 'wan'], ['갇', 'gat'], ['갈', 'gal'],
      ['닭', 'dalk'], ['김', 'gim'], ['입', 'ip'], ['없', 'eop'], ['앗', 'at'],
      ['잇', 'it'], ['광', 'gwang'],
    ];
    for (const [syllable, expected] of cases) {
      expect(romanizeSyllable(syllable), syllable).toBe(expected);
    }
  });
});

describe('parole reali', () => {
  it('rende la forma letterale, quella della scrittura', () => {
    const cases: [string, string][] = [
      ['한국', 'hanguk'], ['한국어', 'hangukeo'], ['감사합니다', 'gamsahapnida'],
      ['수업', 'sueop'], ['아침', 'achim'], ['어제', 'eoje'], ['영화', 'yeonghwa'],
      ['말씀', 'malsseum'], ['연락처', 'yeonrakcheo'], ['메뉴', 'menyu'],
      ['일인분', 'ilinbun'], ['요청', 'yocheong'], ['늦추다', 'neutchuda'],
      ['할머니', 'halmeoni'], ['할아버지', 'halabeoji'], ['꽃잎', 'kkotip'],
      ['옷이', 'oti'], ['읽어요', 'ilkeoyo'], ['쾌차', 'kwaecha'], ['댁', 'daek'],
      ['어려울', 'eoryeoul'], ['원', 'won'], ['학생', 'haksaeng'], ['국민', 'gukmin'],
    ];
    for (const [word, expected] of cases) {
      expect(romanizeWord(word), word).toBe(expected);
    }
  });

  it('lascia in pace ciò che Hangul non è', () => {
    expect(romanizeWord('3층')).toBe('3cheung');
    expect(romanizeWord('café')).toBe('café');
    expect(isHangulSyllable('a')).toBe(false);
    expect(isHangulSyllable('한')).toBe(true);
  });

  it('mantiene gli spazi di un testo', () => {
    expect(romanizeText('할머니가 보고 싶어요')).toBe('halmeoniga bogo sipeoyo');
  });
});

/**
 * La romanizzazione della pronuncia serve a far trovare una parola a chi la
 * cerca come la sente: qui la ㅅ, la ㅆ, la ㅈ e la ㅊ passano alla sillaba
 * dopo con il loro suono (제13항), quindi 꽃이 è «kkochi» e non «kkoci».
 */
describe('romanizzazione della pronuncia', () => {
  it('porta alla sillaba dopo le finali che la norma lascia passare', () => {
    expect(pronunciationRomanize('꽃이')).toBe('kkochi');
    expect(pronunciationRomanize('낮이')).toBe('naji');
    expect(pronunciationRomanize('셋이')).toBe('sesi');
    expect(pronunciationRomanize('꽃을')).toBe('kkocheul');
  });

  it('applica 비음화 e 유음화 quando la sillaba dopo comincia per consonante', () => {
    expect(pronunciationRomanize('국민')).toBe('gungmin');
    expect(pronunciationRomanize('신라')).toBe('silla');
    // 설날 [설랄] e 종로 [종노]: anche ㄹ+ㄴ e 비음+ㄹ cambiano.
    expect(pronunciationRomanize('설날')).toBe('seollal');
    expect(pronunciationRomanize('종로')).toBe('jongno');
    expect(pronunciationRomanize('왕십리')).toBe('wangsimni');
    expect(pronunciationRomanize('담력')).toBe('damnyeok');
  });

  it('chiude i finali doppi su un suono solo', () => {
    expect(pronunciationRomanize('닭')).toBe('dak');
    expect(pronunciationRomanize('값')).toBe('gap');
    expect(pronunciationRomanize('삶')).toBe('sam');
    expect(pronunciationRomanize('여덟')).toBe('yeodeol');
    expect(pronunciationRomanize('없다')).toBe('eopda');
  });

  it('tiene la ㄹ del ㄺ davanti a ㅎ e alle desinenze in ㄱ', () => {
    // 밝히다 [발키다] e 읽히다 [일키다]: la ㄹ si sente, la ㅎ diventa ㅋ.
    expect(pronunciationRomanize('밝히다')).toBe('balkida');
    expect(pronunciationRomanize('읽히다')).toBe('ilkida');
    // 읽고 [일꼬], 맑게 [말께]: la desinenza comincia per ㄱ.
    expect(pronunciationRomanize('읽고')).toBe('ilgo');
    expect(pronunciationRomanize('맑게')).toBe('malge');
    expect(pronunciationRomanize('늙고')).toBe('neulgo');
    // Ma 닭고기 resta un composto di nome + nome: [닥꼬기].
    expect(pronunciationRomanize('닭고기')).toBe('dakgogi');
    // E 읽다, davanti a ㄷ, chiude su ㄱ: [익따].
    expect(pronunciationRomanize('읽다')).toBe('ikda');
  });

  it('divide il finale doppio davanti a vocale', () => {
    expect(pronunciationRomanize('값이')).toBe('gapsi');
    expect(pronunciationRomanize('몫이')).toBe('moksi');
    expect(pronunciationRomanize('닭이')).toBe('dalgi');
    expect(pronunciationRomanize('앉아')).toBe('anja');
    expect(pronunciationRomanize('삶이')).toBe('salmi');
    expect(pronunciationRomanize('여덟이')).toBe('yeodeolbi');
    expect(pronunciationRomanize('싫어')).toBe('sireo');
  });

  it('aspira la consonante dopo la ㅎ finale', () => {
    expect(pronunciationRomanize('좋고')).toBe('joko');
    expect(pronunciationRomanize('놓다')).toBe('nota');
    expect(pronunciationRomanize('낳지')).toBe('nachi');
    expect(pronunciationRomanize('많다')).toBe('manta');
    expect(pronunciationRomanize('싫다')).toBe('silta');
    expect(pronunciationRomanize('좋습니다')).toBe('joseumnida');
  });

  it('aspira anche quando la ㅎ è l’iniziale della sillaba dopo', () => {
    // 제12항: 닫히다 [다치다], 잡히다 [자피다], 앉히다 [안치다].
    expect(pronunciationRomanize('닫히다')).toBe('dachida');
    expect(pronunciationRomanize('잡히다')).toBe('japida');
    expect(pronunciationRomanize('입히다')).toBe('ipida');
    expect(pronunciationRomanize('앉히다')).toBe('anchida');
    expect(pronunciationRomanize('먹히다')).toBe('meokida');
    expect(pronunciationRomanize('시작해요')).toBe('sijakaeyo');
  });

  it('lascia la ㄹ davanti a ㅁ', () => {
    // La ㄹ non è una nasale da assimilare: 할머니, 설명, 질문, 골목.
    expect(pronunciationRomanize('할머니')).toBe('halmeoni');
    expect(pronunciationRomanize('설명')).toBe('seolmyeong');
    expect(pronunciationRomanize('질문')).toBe('jilmun');
    expect(pronunciationRomanize('골목')).toBe('golmok');
    expect(pronunciationRomanize('별말씀을요')).toBe('byeolmalsseumeuryo');
  });

  it('non segna le consonanti tese, come vuole la RR', () => {
    // 학교 si sente [학꾜], ma la romanizzazione ufficiale è hakgyo.
    expect(pronunciationRomanize('학교')).toBe('hakgyo');
    expect(pronunciationRomanize('압구정')).toBe('apgujeong');
  });

  it('tiene 밟- chiuso davanti a consonante e aperto davanti a vocale', () => {
    expect(pronunciationRomanize('밟다')).toBe('bapda');
    expect(pronunciationRomanize('밟고')).toBe('bapgo');
    expect(pronunciationRomanize('밟아')).toBe('balba');
  });
});

describe('confronto tollerante', () => {
  it('accetta maiuscole e il trattino della RR', () => {
    expect(romanizationMatches('수업', 'su-eop')).toBe(true);
    expect(romanizationMatches('수업', 'Sueop')).toBe(true);
    expect(romanizationMatches('사오', 'sa-o')).toBe(true);
    expect(romanizationMatches('수업', 'sugeom')).toBe(false);
    expect(romanizationMatches('국민', 'gumin')).toBe(false);
  });

  it('accetta la y dopo una consonante e la sua assenza', () => {
    expect(romanizationMatches('메뉴', 'menu')).toBe(true);
    expect(romanizationMatches('메뉴', 'menyu')).toBe(true);
    expect(romanizationMatches('류', 'ryu')).toBe(true);
    expect(romanizationMatches('류', 'ru')).toBe(true);
    expect(romanizationMatches('유', 'yu')).toBe(true);
    // Con l'iniziale muta la y non si può togliere: 유 è yu, non u.
    expect(romanizationMatches('유', 'u')).toBe(false);
  });
});
