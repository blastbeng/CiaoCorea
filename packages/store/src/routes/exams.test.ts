import { beforeEach, describe, expect, it } from 'vitest';
import { findExercise, findLesson, getCourse } from '@ciaocorea/curriculum';
import { sampleResponse } from '@ciaocorea/engine';
import type {
  ExamPaper,
  ExamResultResponse,
  ExamsResponse,
  MistakesResponse,
} from '@ciaocorea/shared';
import { createStore, type Store } from '../store';
import { ApiError } from '../errors';

let store: Store;

beforeEach(async () => {
  store = await createStore({ storage: 'memory' });
  await store.bootstrap();
});

const PRE_A1 = 'hangul';
const PRE_A1_LESSONS = ['hangul-01', 'hangul-02', 'hangul-03', 'hangul-04', 'hangul-05'];

function answersForLesson(slug: string, lessonId: string) {
  const course = getCourse(slug);
  const lesson = course ? findLesson(course, lessonId) : undefined;
  expect(lesson, `lezione ${lessonId}`).toBeDefined();
  return (lesson?.exercises ?? []).map((exercise) => ({
    exerciseId: exercise.id,
    response: sampleResponse(exercise),
  }));
}

async function closeLesson(lessonId: string): Promise<void> {
  await store.call(
    'POST',
    `/api/courses/${PRE_A1}/lessons/${lessonId}/attempts`,
    { mode: 'lesson', answers: answersForLesson(PRE_A1, lessonId), durationMs: 20_000 },
  );
}

async function exams(): Promise<ExamsResponse> {
  return store.call<ExamsResponse>('GET', '/api/exams');
}

async function openPreA1(): Promise<ExamPaper> {
  for (const lesson of PRE_A1_LESSONS) await closeLesson(lesson);
  return store.call<ExamPaper>('GET', '/api/exams/pre-a1');
}

/** La risposta giusta di un esercizio pubblico, cercata nel curricolo. */
function correctResponse(exerciseId: string): string {
  const found = findExercise(exerciseId);
  expect(found, `esercizio ${exerciseId}`).toBeDefined();
  return found ? sampleResponse(found.exercise) : '';
}

describe('traguardo di livello', () => {
  it('parte chiuso e dice quante lezioni mancano', async () => {
    const body = await exams();
    expect(body.threshold).toBe(75);
    expect(body.levels.map((level) => level.id)).toEqual(['pre-a1', 'a1', 'a2', 'b1', 'b2']);

    const preA1 = body.levels[0]!;
    expect(preA1.totalLessons).toBe(9);
    expect(preA1.requiredLessons).toBe(5);
    expect(preA1.closedLessons).toBe(0);
    expect(preA1.missingLessons).toBe(5);
    expect(preA1.unlocked).toBe(false);
    expect(preA1.passed).toBe(false);
    expect(preA1.bestScore).toBeNull();

    // Gli altri livelli non hanno ancora nessuna lezione chiusa.
    expect(body.levels.slice(1).every((level) => !level.unlocked)).toBe(true);
  });

  it('non consegna la prova di un livello ancora chiuso', async () => {
    await expect(store.call('GET', '/api/exams/a1')).rejects.toBeInstanceOf(ApiError);
  });

  it('si apre quando metà delle lezioni è chiusa', async () => {
    await openPreA1();
    const preA1 = (await exams()).levels[0]!;
    expect(preA1.closedLessons).toBe(5);
    expect(preA1.missingLessons).toBe(0);
    expect(preA1.unlocked).toBe(true);
    expect(preA1.questionCount).toBeGreaterThanOrEqual(12);
  });

  it('la prova pesca solo dal livello e non porta le soluzioni', async () => {
    const paper = await openPreA1();
    expect(paper.exercises.length).toBeGreaterThanOrEqual(12);
    expect(paper.exercises.length).toBeLessThanOrEqual(20);
    for (const exercise of paper.exercises) {
      expect(exercise.course.level).toBe('pre-A1');
      expect(exercise).not.toHaveProperty('answer');
      expect(exercise).not.toHaveProperty('accept');
    }
    expect(new Set(paper.exercises.map((exercise) => exercise.id)).size).toBe(
      paper.exercises.length,
    );
  });

  it('corregge, registra il migliore e manda gli errori in banca', async () => {
    const paper = await openPreA1();
    const right = paper.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      response: correctResponse(exercise.id),
    }));

    const result = await store.call<ExamResultResponse>('POST', '/api/exams/pre-a1', {
      answers: right,
      durationMs: 60_000,
    });

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.firstPass).toBe(true);
    expect(result.wrong).toBe(0);
    expect(result.level.passed).toBe(true);
    expect(result.level.bestScore).toBe(100);
    expect(result.level.attempts).toBe(1);
    expect(result.level.passedAt).not.toBeNull();

    const stored = (await exams()).levels[0]!;
    expect(stored.bestScore).toBe(100);
    expect(stored.passed).toBe(true);

    // Una seconda prova: resta il migliore di sempre, ma il tentativo si conta.
    const worse = await store.call<ExamResultResponse>('POST', '/api/exams/pre-a1', {
      answers: paper.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        response: 'ㄱ',
      })),
      durationMs: 20_000,
    });
    expect(worse.score).toBeLessThan(100);
    expect(worse.firstPass).toBe(false);
    expect(worse.level.bestScore).toBe(100);
    expect(worse.level.attempts).toBe(2);

    const mistakes = await store.call<MistakesResponse>('GET', '/api/mistakes');
    expect(mistakes.items.length).toBeGreaterThan(0);
  });

  it('la seconda prova dello stesso giorno cambia domande, il ricaricamento no', async () => {
    const first = await openPreA1();
    const reloaded = await store.call<ExamPaper>('GET', '/api/exams/pre-a1');
    expect(reloaded.exercises.map((exercise) => exercise.id)).toEqual(
      first.exercises.map((exercise) => exercise.id),
    );

    const result = await store.call<ExamResultResponse>('POST', '/api/exams/pre-a1', {
      answers: first.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        response: correctResponse(exercise.id),
      })),
      durationMs: 60_000,
    });
    expect(result.passed).toBe(true);

    const second = await store.call<ExamPaper>('GET', '/api/exams/pre-a1');
    expect(second.exercises.map((exercise) => exercise.id)).not.toEqual(
      first.exercises.map((exercise) => exercise.id),
    );
  });
});
