import { describe, expect, it } from 'vitest';
import {
  compact,
  foldItalian,
  foldRomanization,
  matchesAny,
  normalizeAnswer,
  normalizeHangul,
} from './normalize';

describe('normalizeHangul', () => {
  it('rende uguali NFC e NFD (macOS contro il resto del mondo)', () => {
    const nfc = '밥';
    const nfd = nfc.normalize('NFD');
    expect(nfd).not.toBe(nfc);
    expect(normalizeHangul(nfd)).toBe(normalizeHangul(nfc));
  });

  it('unifica i jamo di compatibilità con quelli conjoining', () => {
    expect(normalizeHangul('ㅂ')).toBe('ᄇ');
    expect(normalizeHangul('ㅏ')).toBe('ᅡ');
  });

  it('non tocca il testo latino', () => {
    expect(normalizeHangul('Ciao Corea')).toBe('Ciao Corea');
  });
});

describe('normalizeAnswer', () => {
  it('ignora spazi doppi e punteggiatura finale', () => {
    expect(normalizeAnswer('  안녕하세요!  ')).toBe('안녕하세요');
    expect(normalizeAnswer('밥   먹었어요.')).toBe('밥 먹었어요');
  });

  it('tollera il punto interrogativo coreano a larghezza piena', () => {
    expect(normalizeAnswer('뭐예요？')).toBe('뭐예요');
  });
});

describe('compact', () => {
  it('considera uguali le risposte con e senza spazio', () => {
    expect(compact('밥 이')).toBe(compact('밥이'));
  });
});

describe('foldItalian', () => {
  it('ignora accenti, maiuscole e apostrofi', () => {
    expect(foldItalian('Perché')).toBe('perche');
    expect(foldItalian("l'acqua")).toBe('lacqua');
    expect(foldItalian('  Caffè  ')).toBe('caffe');
  });
});

describe('foldRomanization', () => {
  it('accetta le varianti della romanizzazione riveduta', () => {
    expect(foldRomanization('eomeoni')).toBe(foldRomanization('ŏmŏni'));
    expect(foldRomanization('gamsa-hamnida')).toBe(foldRomanization('gamsahamnida'));
  });
});

describe('matchesAny', () => {
  it('trova la variante accettata e la restituisce per il feedback', () => {
    const result = matchesAny('밥이', ['밥이', '바비']);
    expect(result.matched).toBe(true);
    expect(result.via).toBe('밥이');
  });

  it('rifiuta il vuoto', () => {
    expect(matchesAny('   ', ['밥']).matched).toBe(false);
  });

  it('usa il comparatore indicato', () => {
    expect(matchesAny('Perche', ['perché'], foldItalian).matched).toBe(true);
  });
});
