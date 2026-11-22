import { describe, expect, it } from 'vitest';
import type { FillBlankExercise } from '@ciaocorea/shared';
import { pickChallenge, type ChallengeSource } from './challenge';

function source(lesson: string, index: number): ChallengeSource {
  const exercise: FillBlankExercise = {
    id: `ex-${lesson}-${index}`,
    type: 'fill_blank',
    prompt: 'Completa la frase con la forma giusta.',
    text: '문이 ___어요.',
    options: ['열려', '열어'],
    answer: '열려',
  };
  return {
    exercise,
    courseSlug: 'test',
    courseTitle: 'Test',
    level: 'B2',
    lessonId: lesson,
    lessonTitle: `Lezione ${lesson}`,
  };
}

describe('pickChallenge', () => {
  it('è deterministico con lo stesso seme', () => {
    const sources = Array.from({ length: 6 }, (_, lesson) =>
      Array.from({ length: 5 }, (_, index) => source(`l${lesson}`, index)),
    ).flat();

    const first = pickChallenge(sources, { count: 12, seed: '2026-11-22:user' });
    const second = pickChallenge(sources, { count: 12, seed: '2026-11-22:user' });
    expect(second.map((item) => item.exercise.id)).toEqual(
      first.map((item) => item.exercise.id),
    );
  });

  it('cambia con il seme e rispetta il tetto per lezione', () => {
    const sources = Array.from({ length: 6 }, (_, lesson) =>
      Array.from({ length: 5 }, (_, index) => source(`l${lesson}`, index)),
    ).flat();

    const monday = pickChallenge(sources, { count: 12, seed: 'monday' });
    const tuesday = pickChallenge(sources, { count: 12, seed: 'tuesday' });
    expect(tuesday.map((item) => item.exercise.id)).not.toEqual(
      monday.map((item) => item.exercise.id),
    );

    const perLesson = new Map<string, number>();
    for (const item of monday) {
      perLesson.set(item.lessonId, (perLesson.get(item.lessonId) ?? 0) + 1);
    }
    expect(Math.max(...perLesson.values())).toBeLessThanOrEqual(2);
    expect(monday).toHaveLength(12);
  });

  it('con poche lezioni riempie senza superare il numero richiesto', () => {
    const sources = [source('only', 1), source('only', 2), source('only', 3)];
    const picked = pickChallenge(sources, { count: 12, seed: 'x' });
    expect(picked.map((item) => item.exercise.id).sort()).toEqual([
      'ex-only-1',
      'ex-only-2',
      'ex-only-3',
    ]);
  });

  it('non ripete un esercizio anche se arrivasse due volte', () => {
    const doubled = [source('a', 1), source('a', 1), source('a', 2)];
    const picked = pickChallenge(doubled, { count: 12, seed: 'x' });
    expect(picked.map((item) => item.exercise.id).sort()).toEqual(['ex-a-1', 'ex-a-2']);
  });
});
