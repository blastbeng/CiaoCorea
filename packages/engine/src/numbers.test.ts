import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  readNumber,
  readWrittenNumber,
  spellCounter,
  spellDigits,
  spellNumber,
  spellSinoGrouped,
} from './numbers';

describe('readNumber', () => {
  it('legge i numeri sino-coreani composti', () => {
    expect(readNumber('이십')?.value).toBe(20);
    expect(readNumber('이천')?.value).toBe(2000);
    expect(readNumber('오천')?.value).toBe(5000);
    expect(readNumber('사천오백')?.value).toBe(4500);
    expect(readNumber('오십만')?.value).toBe(500_000);
    expect(readNumber('백이십')?.value).toBe(120);
  });

  it('dice a quale serie appartiene il numero', () => {
    expect(readNumber('사천오백')?.system).toBe('sino');
    expect(readNumber('일곱')?.system).toBe('native');
  });

  it('romanizza sillaba per sillaba', () => {
    expect(readNumber('사천오백')?.rr).toBe('sa-cheon-o-baek');
    expect(readNumber('이십')?.rr).toBe('i-sip');
    expect(readNumber('열한')?.rr).toBe('yeol-han');
  });

  it('legge i numeri nativi, anche composti', () => {
    expect(readNumber('일곱')?.value).toBe(7);
    expect(readNumber('여덟')?.value).toBe(8);
    expect(readNumber('열한')?.value).toBe(11);
    expect(readNumber('스물두')?.value).toBe(22);
  });

  it('non legge una cifra sola: quella è una voce del vocabolario', () => {
    expect(readNumber('삼')).toBeNull();
    expect(readNumber('이')).toBeNull();
    expect(readNumber('열')).toBeNull();
  });

  it('rifiuta le scritture che non sono numeri', () => {
    expect(readNumber('사오')).toBeNull();
    expect(readNumber('학교')).toBeNull();
    // 열 + 이 (particella) non è 12: il nativo non somma le cifre sino-coreane.
    expect(readNumber('열이')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('separa le migliaia con il punto, come in italiano', () => {
    expect(formatNumber(4500)).toBe('4.500');
    expect(formatNumber(500_000)).toBe('500.000');
    expect(formatNumber(20)).toBe('20');
  });
});

describe('readWrittenNumber', () => {
  it('legge la cifra con il contatore attaccato', () => {
    expect(readWrittenNumber('5층')?.value).toBe(5);
    expect(readWrittenNumber('5층')?.unit).toBe('층');
    expect(readWrittenNumber('3월')?.value).toBe(3);
    expect(readWrittenNumber('12일')?.unitIt).toContain('giorno');
    expect(readWrittenNumber('2호선')?.unitIt).toContain('metropolitana');
  });

  it('sa in che modo si leggono la cifra e il contatore', () => {
    // I contatori nativi vogliono i numeri nativi: 세 시, 두 개.
    expect(readWrittenNumber('3시')?.system).toBe('native');
    expect(readWrittenNumber('3시')?.hangul).toBe('세시');
    expect(readWrittenNumber('5층')?.hangul).toBe('오층');
    expect(readWrittenNumber('12일')?.hangul).toBe('십이일');
    expect(readWrittenNumber('20살')?.hangul).toBe('스무살');
  });

  it('moltiplica le unità grandi', () => {
    // 1만 = diecimila: la cifra si legge e si moltiplica per 만.
    expect(readWrittenNumber('1만')?.value).toBe(10_000);
    expect(readWrittenNumber('1만')?.hangul).toBe('만');
    expect(readWrittenNumber('55만')?.value).toBe(550_000);
    expect(readWrittenNumber('500만')?.value).toBe(5_000_000);
  });

  it('legge i mesi irregolari come si dicono davvero', () => {
    // 6월 è 유월 e 10월 è 시월: leggerli 육월/십월 sarebbe insegnare un errore.
    expect(readWrittenNumber('6월')?.hangul).toBe('유월');
    expect(readWrittenNumber('6월')?.rr).toBe('yu-wol');
    expect(readWrittenNumber('10월')?.hangul).toBe('시월');
    expect(readWrittenNumber('10월')?.rr).toBe('si-wol');
    expect(readWrittenNumber('6월')?.unitIt).toContain('유월');
    expect(readWrittenNumber('3월')?.hangul).toBe('삼월');
  });

  it('romanizza la 비음화 davanti a ㅁ/ㄴ', () => {
    // 백만 si pronuncia [뱅만], 십년 [심년]: la scheda dice come si legge.
    expect(readWrittenNumber('500만')?.rr).toBe('o-baeng-man');
    expect(readWrittenNumber('10년')?.rr).toBe('sim-nyeon');
    expect(readWrittenNumber('55만')?.rr).toBe('o-sip-o-man');
    expect(readWrittenNumber('5분')?.rr).toBe('o-bun');
  });

  it('accetta le migliaia con la virgola e le particelle attaccate', () => {
    expect(readWrittenNumber('50,000원')?.value).toBe(50_000);
    expect(readWrittenNumber('5층에')?.value).toBe(5);
    expect(readWrittenNumber('3시로')?.value).toBe(3);
    expect(readWrittenNumber('8평입니다')?.value).toBe(8);
  });

  it('non legge una cifra senza un contatore che conosce', () => {
    expect(readWrittenNumber('5')).toBeNull();
    expect(readWrittenNumber('5xyz')).toBeNull();
    expect(readWrittenNumber('5절')?.unit).toBe('절');
    expect(readWrittenNumber('5권짜리')).toBeNull();
  });
});

describe('la serie giusta per ogni contatore', () => {
  it('legge 장 e 권 con i numeri nativi', () => {
    // 표 두 장, 책 세 권: sono nativi, come insegna il corso dei contatori.
    expect(readWrittenNumber('2장')?.hangul).toBe('두장');
    expect(readWrittenNumber('3권')?.hangul).toBe('세권');
    expect(readWrittenNumber('3권')?.system).toBe('native');
  });

  it('legge i contatori che il corso nomina', () => {
    expect(readWrittenNumber('2대')?.hangul).toBe('두대');
    expect(readWrittenNumber('3마리')?.hangul).toBe('세마리');
    expect(readWrittenNumber('2병')?.hangul).toBe('두병');
    expect(readWrittenNumber('2시간')?.hangul).toBe('두시간');
    expect(readWrittenNumber('2그릇')?.hangul).toBe('두그릇');
  });

  it('preferisce 시간 a 시 quando la parola è più lunga', () => {
    expect(readWrittenNumber('2시간')?.unit).toBe('시간');
    expect(readWrittenNumber('2시')?.unit).toBe('시');
  });

  it('tiene il sino per le uscite e i numeri di linea', () => {
    expect(readWrittenNumber('4번')?.hangul).toBe('사번');
    expect(readWrittenNumber('3호')?.hangul).toBe('삼호');
  });
});

describe('le cifre lunghe', () => {
  it('dice 만 e non 일만', () => {
    expect(readWrittenNumber('1만')?.hangul).toBe('만');
    expect(readWrittenNumber('1만')?.rr).toBe('man');
    expect(readWrittenNumber('1억')?.hangul).toBe('일억');
    expect(readWrittenNumber('2만')?.hangul).toBe('이만');
  });

  it('raggruppa a diecimila negli importi', () => {
    expect(spellSinoGrouped(12_500)).toBe('만 이천오백');
    expect(spellSinoGrouped(23_456)).toBe('이만 삼천사백오십육');
    expect(spellSinoGrouped(10_000)).toBe('만');
    expect(spellSinoGrouped(5_000)).toBe('오천');
    expect(spellSinoGrouped(123_456_789)).toBe('일억 이천삼백사십오만 육천칠백팔십구');
  });
});

describe('le due serie', () => {
  it('scrive il cardinale nella serie chiesta', () => {
    expect(spellNumber(4700, 'sino')).toBe('사천칠백');
    expect(spellNumber(21, 'native')).toBe('스물한');
    expect(spellNumber(20, 'native')).toBe('스무');
  });

  it('legge cifre e contatore insieme', () => {
    expect(spellCounter(3, '권')).toBe('세권');
    expect(spellCounter(12, '명')).toBe('열두명');
    expect(spellCounter(100, '명')).toBe('백명');
    expect(spellCounter(3, '권')).not.toContain('삼');
  });

  it('legge un numero di telefono cifra per cifra', () => {
    expect(spellDigits('010')).toBe('공일공');
    expect(spellDigits('2345-6789')).toBe('이삼사오육칠팔구');
  });
});
