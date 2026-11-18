import type { PlanTask, ProgressSummary, StudyPlan } from '@ciaocorea/shared';

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 7;
export const WEEKLY_GOAL_DEFAULT = 5;

export function clampWeeklyGoal(value: number): number {
  if (!Number.isFinite(value)) return WEEKLY_GOAL_DEFAULT;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, Math.round(value)));
}

/** Lunedì della settimana in corso, in formato `YYYY-MM-DD` (UTC). */
export function weekStartIso(now: Date = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - sinceMonday);
  return day.toISOString().slice(0, 10);
}

export function dayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Giorni che mancano alla fine della settimana, oggi compreso. */
export function daysLeftInWeek(weekStart: string, today: string): number {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(now)) return 0;
  const passed = Math.round((now - start) / 86_400_000);
  return Math.min(7, Math.max(0, 7 - passed));
}

export interface PlanSource {
  summary: ProgressSummary;
  dueCards: number;
  weeklyGoal: number;
  /** Giorni `YYYY-MM-DD` in cui lo studente ha studiato; anche fuori settimana. */
  studyDays: readonly string[];
  /**
   * Il quaderno: consegne aperte e non ancora scritte, e se oggi si è già
   * scritto qualcosa. Uno scritto fatto vale la consegna della giornata.
   */
  writing?: { pending: number; wroteToday: boolean } | null;
  /** Primi dialogo aperto e non legato a una lezione da fare, se c'è. */
  dialogue?: { slug: string; title: string } | null;
  courses?: ReadonlyArray<{ slug: string; title: string }>;
  now?: Date;
}

/**
 * Il piano della giornata.
 *
 * La priorità è una sola: prima la lezione (è lì che entra materiale nuovo),
 * poi i ripassi in scadenza (è lì che il materiale non si perde), poi il
 * quaderno (è lì che il materiale diventa produzione), e la conversazione per
 * ultima, nei giorni leggeri: un dialogo da portare a casa è il modo migliore
 * per chiudere una giornata in cui non c'è altro.
 *
 * Non inventa lavoro: se non c'è niente in programma lo dice, e lega il
 * discorso all'obiettivo settimanale, che è l'unica cosa rimasta da fare.
 */
export function buildDailyPlan(source: PlanSource): StudyPlan {
  const now = source.now ?? new Date();
  const today = dayIso(now);
  const weekStart = weekStartIso(now);
  const goal = clampWeeklyGoal(source.weeklyGoal);

  const weekDays = source.studyDays.filter((day) => day >= weekStart && day <= today);
  const daysStudied = weekDays.length;
  const daysLeft = daysLeftInWeek(weekStart, today);
  const goalMet = daysStudied >= goal;

  const tasks: PlanTask[] = [];
  const { nextLesson } = source.summary;

  if (nextLesson) {
    const courseTitle = source.courses?.find((course) => course.slug === nextLesson.courseSlug)?.title;
    tasks.push({
      key: 'lesson',
      label: 'Lezione',
      detail: courseTitle
        ? `${courseTitle} · ${nextLesson.lessonTitle}`
        : nextLesson.lessonTitle,
      href: `/corso/${nextLesson.courseSlug}/lezione/${nextLesson.lessonId}`,
    });
  }

  if (source.dueCards > 0) {
    tasks.push({
      key: 'reviews',
      label: 'Ripasso',
      detail:
        source.dueCards === 1
          ? '1 parola in scadenza'
          : `${source.dueCards} parole in scadenza`,
      href: '/ripassi',
    });
  }

  // Il quaderno è il passo che trasforma il riconoscimento in produzione: si
  // propone una volta al giorno, quando c'è una consegna aperta e non si è
  // ancora scritto niente.
  if (source.writing && source.writing.pending > 0 && !source.writing.wroteToday) {
    tasks.push({
      key: 'writing',
      label: 'Quaderno',
      detail:
        source.writing.pending === 1
          ? '1 consegna da scrivere'
          : `${source.writing.pending} consegne da scrivere`,
      href: '/quaderno',
    });
  }

  // La conversazione prende spazio solo quando la giornata è leggera: non ha
  // senso metterla sopra ai ripassi che scadono, né dopo una lezione e un
  // quaderno già in programma.
  if (source.dueCards === 0 && tasks.length < 2 && source.dialogue) {
    tasks.push({
      key: 'dialogue',
      label: 'Conversazione',
      detail: `${source.dialogue.title} · continua il dialogo`,
      href: `/dialoghi/${source.dialogue.slug}`,
    });
  }

  const giorni = (n: number) => (n === 1 ? 'giorno' : 'giorni');
  const goalLine = goalMet
    ? 'Obiettivo della settimana raggiunto: quello che fai da qui è tutto guadagnato.'
    : `${daysStudied} ${giorni(daysStudied)} su ${goal} · ${daysLeft} ${giorni(daysLeft)} ancora per chiudere la settimana.`;

  const note =
    tasks.length === 0
      ? goalMet
        ? 'Niente in scadenza e settimana in ordine: anticipa una lezione, o leggi il dizionario.'
        : `Niente in scadenza oggi, ma la settimana non è chiusa. ${goalLine}`
      : goalLine;

  return {
    day: today,
    weekStart,
    goal,
    daysStudied,
    daysLeft,
    goalMet,
    streakDays: source.summary.streakDays,
    tasks,
    note,
  };
}
