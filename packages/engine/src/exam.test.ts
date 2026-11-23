import { describe, expect, it } from 'vitest';
import type { FillBlankExercise } from '@ciaocorea/shared';
import type { ChallengeSource } from './challenge';
import {
  EXAM_LEVELS,
  EXAM_MIN_EXERCISES,
  EXAM_SIZE,
  EXAM_THRESHOLD,
  examPassed,
  examReadiness,
  findExamLevel,
  sameLevel,
  selectExamQuestions,
} from './exam';

function source(level: string, lesson: string, index: number): ChallengeSource {
  const exercise: FillBlankExercise = {
    id: `ex-${level}-${lesson}-${index}`,
    type: 'fill_blank',
    prompt: 'Completa la frase con la forma giusta.',
    text: '문이 ___어요.',
    options: ['열려', '열어'],
    answer: '열려',
  };
  return {
    exercise,
    courseSlug: `corso-${level}`,
    courseTitle: `Corso ${level}`,
    level,
    lessonId: lesson,
    lessonTitle: `Lezione ${lesson}`,
  };
}

describe('scala dei livelli', () => {
  it('non ha identificativi doppi e va dal più semplice al più difficile', () => {
    const ids = EXAM_LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['pre-a1', 'a1', 'a2', 'b1', 'b2']);
  });

  it('riconosce un livello ignorando maiuscole e spazi', () => {
    expect(findExamLevel('  A2 ')?.label).toBe('A2');
    expect(findExamLevel('C1')).toBeUndefined();
  });

  it('confronta il livello del corso con quello dell’esame', () => {
    expect(sameLevel('pre-A1', 'pre-a1')).toBe(true);
    expect(sameLevel('A2', 'a2')).toBe(true);
    expect(sameLevel('A2', 'B1')).toBe(false);
  });
});

describe('prontezza del traguardo', () => {
  it('chiede metà delle lezioni del livello', () => {
    const readiness = examReadiness({ totalLessons: 20, closedLessons: 10, availableExercises: 80 });
    expect(readiness.requiredLessons).toBe(10);
    expect(readiness.unlocked).toBe(true);
    expect(readiness.missingLessons).toBe(0);
  });

  it('non apre con meno della metà, e dice quante ne mancano', () => {
    const readiness = examReadiness({ totalLessons: 20, closedLessons: 7, availableExercises: 80 });
    expect(readiness.unlocked).toBe(false);
    expect(readiness.missingLessons).toBe(3);
  });

  it('protegge i livelli corti con un minimo di quattro lezioni', () => {
    const readiness = examReadiness({ totalLessons: 4, closedLessons: 2, availableExercises: 40 });
    expect(readiness.requiredLessons).toBe(4);
    expect(readiness.unlocked).toBe(false);
  });

  it('non apre se le lezioni chiuse offrono troppi pochi esercizi', () => {
    const readiness = examReadiness({
      totalLessons: 6,
      closedLessons: 4,
      availableExercises: EXAM_MIN_EXERCISES - 1,
    });
    expect(readiness.unlocked).toBe(false);
  });
});

describe('selezione delle domande', () => {
  const sources = [
    ...Array.from({ length: 8 }, (_, lesson) =>
      Array.from({ length: 4 }, (_, index) => source('A2', `a${lesson}`, index)),
    ).flat(),
    ...Array.from({ length: 4 }, (_, lesson) =>
      Array.from({ length: 4 }, (_, index) => source('B1', `b${lesson}`, index)),
    ).flat(),
  ];

  it('pesca solo dal livello chiesto', () => {
    const picked = selectExamQuestions(sources, 'A2', 'seme');
    expect(picked).toHaveLength(EXAM_SIZE);
    expect(picked.every((item) => item.level === 'A2')).toBe(true);
  });

  it('non ripete esercizi e resta stabile con lo stesso seme', () => {
    const first = selectExamQuestions(sources, 'A2', 'seme');
    const second = selectExamQuestions(sources, 'A2', 'seme');
    expect(second.map((item) => item.exercise.id)).toEqual(first.map((item) => item.exercise.id));
    expect(new Set(first.map((item) => item.exercise.id)).size).toBe(first.length);
  });

  it('con poche domande disponibili dà quelle che ci sono', () => {
    const few = sources.filter((item) => item.lessonId === 'b0');
    const picked = selectExamQuestions(few, 'B1', 'seme');
    expect(picked).toHaveLength(4);
  });
});

describe('soglia', () => {
  it('passa dal 75% in su', () => {
    expect(examPassed(EXAM_THRESHOLD)).toBe(true);
    expect(examPassed(EXAM_THRESHOLD - 1)).toBe(false);
  });
});
