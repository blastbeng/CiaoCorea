import { describe, expect, it } from 'vitest';
import type { ProgressSummary } from '@ciaocorea/shared';
import {
  WEEKLY_GOAL_DEFAULT,
  buildDailyPlan,
  clampWeeklyGoal,
  daysLeftInWeek,
  weekStartIso,
} from './plan';

const summary = (over: Partial<ProgressSummary> = {}): ProgressSummary => ({
  lessonsPassed: 3,
  lessonsSkipped: 0,
  lessonsTotal: 24,
  percent: 12,
  streakDays: 2,
  mistakesOpen: 0,
  nextLesson: {
    courseSlug: 'grammatica',
    lessonId: 'gram-03',
    lessonTitle: 'Particelle',
    state: 'available',
  },
  ...over,
});

const WEDNESDAY = new Date('2026-11-18T09:30:00Z');

describe('calendario del piano', () => {
  it('porta la settimana al lunedì', () => {
    expect(weekStartIso(WEDNESDAY)).toBe('2026-11-16');
    // Il lunedì stesso è l'inizio, non la settimana prima.
    expect(weekStartIso(new Date('2026-11-16T00:10:00Z'))).toBe('2026-11-16');
    // La domenica chiude la settimana in corso.
    expect(weekStartIso(new Date('2026-11-22T23:59:00Z'))).toBe('2026-11-16');
  });

  it('conta i giorni che restano, oggi compreso', () => {
    expect(daysLeftInWeek('2026-11-16', '2026-11-16')).toBe(7);
    expect(daysLeftInWeek('2026-11-16', '2026-11-18')).toBe(5);
    expect(daysLeftInWeek('2026-11-16', '2026-11-22')).toBe(1);
  });

  it('l’obiettivo sta sempre fra 1 e 7 giorni', () => {
    expect(clampWeeklyGoal(0)).toBe(1);
    expect(clampWeeklyGoal(99)).toBe(7);
    expect(clampWeeklyGoal(Number.NaN)).toBe(WEEKLY_GOAL_DEFAULT);
    expect(clampWeeklyGoal(4.6)).toBe(5);
  });
});

describe('piano della giornata', () => {
  const base = {
    summary: summary(),
    dueCards: 4,
    weeklyGoal: 5,
    studyDays: ['2026-11-17', '2026-11-18'],
    dialogue: null,
    now: WEDNESDAY,
  };

  it('mette prima la lezione, poi i ripassi', () => {
    const plan = buildDailyPlan(base);
    expect(plan.tasks.map((task) => task.key)).toEqual(['lesson', 'reviews']);
    expect(plan.tasks[0].href).toBe('/corso/grammatica/lezione/gram-03');
    expect(plan.tasks[1].detail).toBe('4 parole in scadenza');
  });

  it('al singolare lo dice in italiano', () => {
    const plan = buildDailyPlan({ ...base, dueCards: 1 });
    expect(plan.tasks[1].detail).toBe('1 parola in scadenza');
  });

  it('offre la conversazione solo quando non c’è ripasso in scadenza', () => {
    const dialogue = { slug: 'al-bar', title: 'Al bar' };
    const conRipassi = buildDailyPlan({ ...base, dialogue });
    expect(conRipassi.tasks.map((task) => task.key)).toEqual(['lesson', 'reviews']);

    const senzaRipassi = buildDailyPlan({ ...base, dueCards: 0, dialogue });
    expect(senzaRipassi.tasks.map((task) => task.key)).toEqual(['lesson', 'dialogue']);
    expect(senzaRipassi.tasks[1].href).toBe('/dialoghi/al-bar');
  });

  it('conteggia solo i giorni della settimana in corso', () => {
    // Il 2026-11-13 è venerdì della settimana prima: non deve valere oggi.
    const plan = buildDailyPlan({ ...base, studyDays: ['2026-11-13', '2026-11-17', '2026-11-18'] });
    expect(plan.daysStudied).toBe(2);
    expect(plan.goalMet).toBe(false);
  });

  it('dice quando l’obiettivo è già raggiunto', () => {
    const plan = buildDailyPlan({
      ...base,
      studyDays: ['2026-11-16', '2026-11-17', '2026-11-18'],
      weeklyGoal: 3,
    });
    expect(plan.daysStudied).toBe(3);
    expect(plan.goalMet).toBe(true);
    expect(plan.note).toContain('raggiunto');
  });

  it('non conta i giorni che devono ancora venire', () => {
    const plan = buildDailyPlan({
      ...base,
      studyDays: ['2026-11-17', '2026-11-18', '2026-11-20', '2026-11-21'],
    });
    expect(plan.daysStudied).toBe(2);
  });

  it('ammette una giornata senza niente da fare, con un consiglio', () => {
    const plan = buildDailyPlan({
      summary: summary({ nextLesson: null }),
      dueCards: 0,
      weeklyGoal: 5,
      studyDays: ['2026-11-16'],
      dialogue: null,
      now: WEDNESDAY,
    });
    expect(plan.tasks).toHaveLength(0);
    expect(plan.note).toContain('Niente in scadenza');
    // Con un solo giorno fatto la frase deve restare italiano.
    expect(plan.note).toContain('1 giorno su 5');
  });

  it('declina “giorno” al singolare quando ne resta uno', () => {
    const sunday = new Date('2026-11-22T12:00:00Z');
    const plan = buildDailyPlan({
      summary: summary({ nextLesson: null }),
      dueCards: 0,
      weeklyGoal: 6,
      studyDays: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'],
      dialogue: null,
      now: sunday,
    });
    expect(plan.daysLeft).toBe(1);
    expect(plan.note).toContain('1 giorno ancora');
  });

  it('passa lo streak dalla dashboard, senza inventarlo', () => {
    expect(buildDailyPlan(base).streakDays).toBe(2);
  });

  it('usa il titolo del corso nel dettaglio della lezione', () => {
    const plan = buildDailyPlan({
      ...base,
      courses: [{ slug: 'grammatica', title: 'Prime frasi' }],
    });
    expect(plan.tasks[0].detail).toBe('Prime frasi · Particelle');
  });
});
