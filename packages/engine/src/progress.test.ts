import type { Course, Lesson } from '@ciaocorea/shared';
import { describe, expect, it } from 'vitest';
import { buildCourseView, nextLessonOf, resolveState, summarize, type ProgressRow } from './progress';

function lesson(id: string, title = id): Lesson {
  return {
    id,
    slug: id,
    title,
    titleKo: '테스트',
    kind: 'letters',
    goal: 'obiettivo di prova sufficientemente lungo',
    durationMin: 10,
    points: ['punto di prova uno', 'punto di prova due'],
    vocab: [{ ko: '밥', it: 'riso', rr: 'bap' }],
    exercises: [],
  };
}

const lessons = [lesson('l1'), lesson('l2'), lesson('l3')];

const course: Course = {
  id: 'test',
  slug: 'test',
  title: 'Corso di prova',
  subtitle: 'sottotitolo',
  level: 'pre-A1',
  description: 'descrizione di prova abbastanza lunga',
  units: [
    {
      id: 'u1',
      title: 'Unità uno',
      purpose: 'scopo di prova sufficientemente lungo',
      lessons,
    },
  ],
};

function rows(...entries: Array<[string, ProgressRow['state']]>): ProgressRow[] {
  return entries.map(([lesson_id, state]) => ({ lesson_id, state, best_score: null }));
}

describe('resolveState', () => {
  it('apre solo la prima lezione quando non c’è progresso', () => {
    const map = new Map();
    expect(resolveState(lessons, 0, map)).toBe('available');
    expect(resolveState(lessons, 1, map)).toBe('locked');
    expect(resolveState(lessons, 2, map)).toBe('locked');
  });

  it('sblocca la successiva quando la precedente è superata', () => {
    const map = new Map(rows(['l1', 'passed']).map((row) => [row.lesson_id, row]));
    expect(resolveState(lessons, 1, map)).toBe('available');
  });

  it('considera chiusa anche una lezione saltata', () => {
    const map = new Map(rows(['l1', 'skipped']).map((row) => [row.lesson_id, row]));
    expect(resolveState(lessons, 1, map)).toBe('available');
  });

  it('non sblocca se la precedente è solo iniziata', () => {
    const map = new Map(rows(['l1', 'in_progress']).map((row) => [row.lesson_id, row]));
    expect(resolveState(lessons, 1, map)).toBe('locked');
  });

  it('conserva lo stato della lezione stessa', () => {
    const map = new Map(
      rows(['l1', 'in_progress'], ['l2', 'passed']).map((row) => [row.lesson_id, row]),
    );
    expect(resolveState(lessons, 0, map)).toBe('in_progress');
    expect(resolveState(lessons, 1, map)).toBe('passed');
  });
});

describe('buildCourseView', () => {
  it('calcola percentuale e conteggi', () => {
    const view = buildCourseView({ course, progress: rows(['l1', 'passed'], ['l2', 'skipped']) });
    expect(view.stats).toEqual({ lessons: 3, passed: 1, skipped: 1, percent: 67 });
    expect(view.units[0]?.lessons[2]?.state).toBe('available');
  });

  it('espone il punteggio migliore della lezione', () => {
    const view = buildCourseView({
      course,
      progress: [{ lesson_id: 'l1', state: 'passed', best_score: 92 }],
    });
    expect(view.units[0]?.lessons[0]?.bestScore).toBe(92);
  });
});

describe('nextLessonOf e summarize', () => {
  it('propone la prima lezione aperta', () => {
    const view = buildCourseView({ course, progress: [] });
    expect(nextLessonOf([view])).toEqual({
      courseSlug: 'test',
      lessonId: 'l1',
      lessonTitle: 'l1',
      state: 'available',
    });
  });

  it('chiude il corso senza proporre nulla', () => {
    const view = buildCourseView({
      course,
      progress: rows(['l1', 'passed'], ['l2', 'passed'], ['l3', 'passed']),
    });
    expect(nextLessonOf([view])).toBeNull();
    expect(summarize([view], 3)).toMatchObject({ lessonsPassed: 3, percent: 100, streakDays: 3 });
  });
});
