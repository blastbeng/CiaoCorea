import { describe, expect, it } from 'vitest';
import { composeHangul, dropLast } from './hangul';

describe('composeHangul', () => {
  it('impacchetta consonante + vocale', () => {
    expect(composeHangul('ㄱㅏ')).toBe('가');
    expect(composeHangul('ㅎㅏ')).toBe('하');
  });

  it('aggiunge il 받침', () => {
    expect(composeHangul('ㅂㅏㅂ')).toBe('밥');
    expect(composeHangul('ㅎㅏㄴ')).toBe('한');
  });

  it('compone più sillabe di seguito', () => {
    expect(composeHangul('ㅎㅏㄴㄱㅜㄱ')).toBe('한국');
    expect(composeHangul('ㅇㅏㄴㄴㅕㅇ')).toBe('안녕');
  });

  it('sposta il 받침 quando arriva una vocale', () => {
    // 밥 + ㅏ: il ㅂ passa a iniziale della sillaba nuova.
    expect(composeHangul('ㅂㅏㅂㅏ')).toBe('바바');
    expect(composeHangul('ㄱㅏㄴㅏ')).toBe('가나');
    expect(composeHangul('ㅅㅏㄹㅏㅁ')).toBe('사람');
  });

  it('appoggia la vocale iniziale a ㅇ muta', () => {
    expect(composeHangul('ㅏ')).toBe('아');
    expect(composeHangul('ㅇㅣ')).toBe('이');
  });

  it('lascia intatto ciò che non è jamo', () => {
    expect(composeHangul('한')).toBe('한');
    expect(composeHangul('ㅎㅏㄴ 국')).toBe('한 국');
  });

  it('non usa come 받침 le consonanti tese non ammesse', () => {
    // ㄸ non può chiudere sillaba: resta iniziale della successiva.
    expect(composeHangul('ㅏㄸ')).toBe('아ㄸ');
  });
});

describe('dropLast', () => {
  it('toglie un solo carattere', () => {
    expect(dropLast('ㅎㅏㄴ')).toBe('ㅎㅏ');
    expect(dropLast('한')).toBe('');
    expect(dropLast('')).toBe('');
  });
});
