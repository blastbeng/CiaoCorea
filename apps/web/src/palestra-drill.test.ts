import { describe, expect, it } from 'vitest';
import { CONJUGATION_ENDINGS, conjugate, particleFace } from '@ciaocorea/engine';
import {
  DRILL_LEMMAS,
  DRILL_NOUNS,
  DRILLS,
  PARTICLE_FUNCTIONS,
  VERB_ENDINGS,
  buildParticleQuestion,
  buildVerbQuestion,
  isCorrectVerb,
  normalizeKorean,
} from './palestra-drill';

/** Un generatore deterministico: le stesse domande a ogni esecuzione. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const ENDING_BY_KEY = new Map(CONJUGATION_ENDINGS.map((entry) => [entry.key, entry]));

describe('la palestra: coniugazione', () => {
  it('copre tutte le classi irregolari con le sue voci', () => {
    const classes = new Set<string>(
      DRILL_LEMMAS.map((lemma) => conjugate(lemma)?.class.id as string).filter(Boolean),
    );
    for (const cls of ['regolare', 'contrazione', 'hada', 'd', 'l', 's', 'b', 'h', 'reu', 'eu']) {
      expect(classes.has(cls), `manca la classe ${cls}`).toBe(true);
    }
  });

  it('ogni voce e ogni desinenza dà una forma reale', () => {
    const random = seeded(5);
    for (let i = 0; i < 600; i += 1) {
      const question = buildVerbQuestion(random);
      const table = conjugate(question.lemma);
      expect(table).not.toBeNull();
      // La risposta è davvero la forma che il motore produce per quella
      // desinenza: la palestra non scrive forme, le pesca dal motore.
      const key = VERB_ENDINGS.find((candidate) => {
        const def = ENDING_BY_KEY.get(candidate);
        return def?.label === question.endingLabel;
      });
      expect(key, `desinenza sconosciuta: ${question.endingLabel}`).toBeTruthy();
      const expected = table?.forms.find((entry) => entry.key === key)?.form;
      expect(question.answer).toBe(expected);
      expect(question.answer).toBeTruthy();
      expect(question.note.length).toBeGreaterThan(20);
      // La risposta è coreana e non ha spazi di troppo all'inizio o alla fine.
      expect(/\p{Script=Hangul}/u.test(question.answer)).toBe(true);
      expect(question.answer.trim()).toBe(question.answer);
    }
  });

  it('corregge senza contare gli spazi (읽을 거예요 = 읽을거예요)', () => {
    const question = buildVerbQuestion(seeded(1));
    expect(isCorrectVerb(question, question.answer)).toBe(true);
    expect(isCorrectVerb(question, question.answer.replace(/\s+/g, ''))).toBe(true);
    expect(isCorrectVerb(question, 'zzz')).toBe(false);
    expect(normalizeKorean('  읽을   거예요  ')).toBe('읽을거예요');
  });
});

describe('la palestra: particelle', () => {
  it('la risposta è la faccia giusta della particella chiesta', () => {
    const random = seeded(13);
    const faces = new Set<string>();
    for (let i = 0; i < 600; i += 1) {
      const question = buildParticleQuestion(random);
      const canonical =
        PARTICLE_FUNCTIONS.find((entry) => entry.label === question.functionLabel)?.canonical ?? '';
      expect(canonical, `funzione sconosciuta: ${question.functionLabel}`).toBeTruthy();
      // la particella mostrata è quella che particleFace chiede per quella base
      expect(particleFace(question.base, canonical)).toBe(question.particle);
      expect(question.answer).toBe(question.base + question.particle);
      faces.add(question.particle);
      // le opzioni sono 3 o 4, senza doppioni, e contengono la risposta una sola volta
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      expect(question.options.length).toBeLessThanOrEqual(4);
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.options.filter((option) => option === question.answer)).toHaveLength(1);
      expect(question.note.length).toBeGreaterThan(10);
    }
    // tutte e dieci le facce devono comparire: soggetto/tema/oggetto/«e»/direzione
    for (const face of ['이', '가', '은', '는', '을', '를', '과', '와', '으로', '로']) {
      expect(faces.has(face), `la faccia ${face} non esce mai`).toBe(true);
    }
  });

  it('dopo una vocale non chiede mai la faccia delle consonanti', () => {
    const vowel = DRILL_NOUNS.find((noun) => !/[ㄱ-ㅎㅏ-ㅣ]/.test(noun.ko.slice(-1).normalize('NFC')));
    // un nome senza 받침 (vocale finale) prende 가/는/를/와/로
    const check = ['학교', '친구', '커피', '아이', '의사', '회사', '도시'];
    for (const noun of check) {
      expect(particleFace(noun, '이')).toBe('가');
      expect(particleFace(noun, '은')).toBe('는');
      expect(particleFace(noun, '을')).toBe('를');
      expect(particleFace(noun, '과')).toBe('와');
      expect(particleFace(noun, '으로')).toBe('로');
    }
    expect(vowel).toBeTruthy();
  });

  it('la ㄹ finale vuole 로 per la direzione', () => {
    expect(particleFace('서울', '으로')).toBe('로');
    expect(particleFace('물', '으로')).toBe('로');
  });
});

describe('la palestra: struttura', () => {
  it('espone i due esercizi', () => {
    expect(DRILLS.map((drill) => drill.id)).toEqual(['verbi', 'particelle']);
    for (const drill of DRILLS) {
      expect(drill.label.length).toBeGreaterThan(2);
      expect(drill.blurb.length).toBeGreaterThan(10);
    }
  });
});
