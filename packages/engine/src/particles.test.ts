import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@ciaocorea/shared';
import { particleFace, particleIssues } from './particles';

function entry(ko: string, it: string, rr: string): VocabEntry {
  return { ko, it, rr, courseSlug: 'x', courseTitle: 'X', lessonId: 'l', lessonTitle: 'L' };
}

/** Un vocabolario piccolo: il controllo giudica solo ciò che riconosce. */
const entries: VocabEntry[] = [
  entry('학교', 'scuola', 'hakgyo'),
  entry('사람', 'persona', 'saram'),
  entry('물', 'acqua', 'mul'),
  entry('팔', 'braccio', 'pal'),
  entry('말', 'parola', 'mal'),
  entry('책', 'libro', 'chaek'),
  entry('사과', 'mela', 'sagwa'),
  entry('가방', 'borsa', 'gabang'),
  entry('강', 'fiume', 'gang'),
  entry('여행', 'viaggio', 'yeohaeng'),
  entry('층', 'piano', 'cheung'),
  entry('모자', 'cappello', 'moja'),
  entry('읽다', 'leggere', 'ilkda'),
  entry('많다', 'molto', 'manta'),
];

const EUL = '을';
const REUL = '를';
const EUN = '은';
const NUN = '는';
const I = '이';
const GA = '가';

describe('particleFace', () => {
  it('sceglie 이 dopo una consonante e 가 dopo una sillaba chiusa nulla', () => {
    expect(particleFace('사람', I)).toBe(I);
    expect(particleFace('학교', I)).toBe(GA);
  });

  it('conta la ㅁ finale: è la nasale che si sente, quindi vuole 이', () => {
    expect(particleFace('가방', I)).toBe(I);
    expect(particleFace('강', REUL)).toBe(EUL);
    expect(particleFace('여행', REUL)).toBe(EUL);
  });

  it('la 을 dopo la ㄹ si scrive ancora 을, anche se si sente [를]', () => {
    // È l'esempio dell'ortografia coreana: «팔을».
    expect(particleFace('팔', REUL)).toBe(EUL);
    expect(particleFace('물', REUL)).toBe(EUL);
  });

  it('per 으로/로 la ㄹ finale vuole sempre 로', () => {
    expect(particleFace('말', '으로')).toBe('로');
    expect(particleFace('팔', '으로')).toBe('로');
    expect(particleFace('사람', '으로')).toBe('으로');
    expect(particleFace('층', '으로')).toBe('으로');
    expect(particleFace('학교', '으로')).toBe('로');
  });

  it('non inventa forme per particelle che non cambiano', () => {
    expect(particleFace('학교', '에서')).toBeNull();
    expect(particleFace('학교', '도')).toBeNull();
  });
});

describe('particleIssues', () => {
  it('lascia stare le frasi corrette', () => {
    const ok =
      '학교가 커요. 사람을 좋아해요. 물을 마셔요. 책을 읽어요. ' +
      '여행' + EUL + ' 가요. 층' + EUL + ' 올라가요. 가방' + I + ' 무거워요. 모자' + REUL + ' 썼어요.';
    expect(particleIssues(entries, ok)).toEqual([]);
  });

  it('trova 이 dove va 가', () => {
    const issues = particleIssues(entries, '학교' + I + ' 커요.');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ base: '학교', particle: I, expected: GA });
  });

  it('trova 는 dove va 은', () => {
    expect(particleIssues(entries, '사람' + NUN + ' 커요.').map((issue) => issue.expected)).toEqual([EUN]);
  });

  it('trova 를 dove la ㄹ finale vuole 을', () => {
    expect(particleIssues(entries, '물' + REUL + ' 마셔요.').map((issue) => issue.expected)).toEqual([EUL]);
  });

  it('trova 으로 dove la ㄹ finale vuole 로', () => {
    const issues = particleIssues(entries, '말' + '으로' + ' 말해요.');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ base: '말', particle: '으로', expected: '로' });
  });

  it('non giudica le desinenze dei verbi, che non sono particelle', () => {
    // «읽는» è «che legge», e «많은» è «molto»: non sono particelle ed è giusto così.
    expect(particleIssues(entries, '읽는 사람')).toEqual([]);
    expect(particleIssues(entries, '많은 사람')).toEqual([]);
  });

  it('non giudica ciò che non è nel vocabolario', () => {
    expect(particleIssues(entries, '아무개' + EUN + ' 커요')).toEqual([]);
  });

  it('ignora spazi, punteggiatura e lettere non coreane', () => {
    expect(particleIssues(entries, ' 학교가 3 개, 학교' + GA + ' 집. Hello')).toEqual([]);
  });
});
