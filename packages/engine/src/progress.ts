import type {
  Course,
  CourseView,
  Lesson,
  LessonState,
  LessonView,
  ProgressSummary,
  UnitView,
} from '@ciaocorea/shared';

export interface ProgressRow {
  lesson_id: string;
  state: LessonState;
  best_score: number | null;
}

export interface CourseProgress {
  course: Course;
  progress: ProgressRow[];
}

/** Gli stati che sbloccano la lezione successiva. */
const UNLOCKING: ReadonlySet<LessonState> = new Set<LessonState>(['passed', 'skipped']);

/**
 * Regola di sblocco, tenuta qui perché è la regola didattica dell'app e va
 * testata senza database: la prima lezione è sempre aperta, ognuna delle
 * successive si apre quando la precedente è stata fatta o saltata.
 * Una lezione saltata resta tale ma continua a generare ripassi: non è un buco.
 */
export function resolveState(
  lessons: readonly Lesson[],
  index: number,
  rows: ReadonlyMap<string, ProgressRow>,
): LessonState {
  const lesson = lessons[index];
  if (!lesson) return 'locked';

  const row = rows.get(lesson.id);
  if (row && (row.state === 'passed' || row.state === 'skipped' || row.state === 'in_progress')) {
    return row.state;
  }

  if (index === 0) return 'available';

  const previous = lessons[index - 1];
  if (!previous) return 'locked';

  const previousRow = rows.get(previous.id);
  // La precedente va chiusa o saltata: "in corso" non basta a sbloccare, così
  // non si accumulano lezioni aperte che poi si dimenticano.
  if (previousRow && UNLOCKING.has(previousRow.state)) return 'available';

  return 'locked';
}

export function buildCourseView({ course, progress }: CourseProgress): CourseView {
  const rows = new Map(progress.map((row) => [row.lesson_id, row]));
  const flat = course.units.flatMap((unit) => unit.lessons);

  let flatIndex = 0;
  const units: UnitView[] = course.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    purpose: unit.purpose,
    lessons: unit.lessons.map((lesson) => {
      const state = resolveState(flat, flatIndex, rows);
      flatIndex += 1;
      const row = rows.get(lesson.id);
      // Gli esercizi si tolgono qui, non nel client: le soluzioni non devono
      // nemmeno partire dal server quando si chiede l'indice del corso.
      const { exercises: _exercises, ...publicLesson } = lesson;
      const view: LessonView = {
        ...publicLesson,
        state,
        bestScore: row?.best_score ?? null,
      };
      return view;
    }),
  }));

  const allLessons = units.flatMap((unit) => unit.lessons);
  const passed = allLessons.filter((lesson) => lesson.state === 'passed').length;
  const skipped = allLessons.filter((lesson) => lesson.state === 'skipped').length;
  const lessonsTotal = allLessons.length;

  return {
    ...course,
    units,
    stats: {
      lessons: lessonsTotal,
      passed,
      skipped,
      percent: lessonsTotal === 0 ? 0 : Math.round(((passed + skipped) / lessonsTotal) * 100),
    },
  };
}

/** Il "prossimo passo" della dashboard: la prima lezione non ancora chiusa. */
export function nextLessonOf(views: readonly CourseView[]): ProgressSummary['nextLesson'] {
  for (const course of views) {
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        if (lesson.state === 'available' || lesson.state === 'in_progress') {
          return {
            courseSlug: course.slug,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            state: lesson.state,
          };
        }
      }
    }
  }
  return null;
}

export function summarize(views: readonly CourseView[], streakDays: number): ProgressSummary {
  const lessonsPassed = views.reduce((sum, course) => sum + course.stats.passed, 0);
  const lessonsSkipped = views.reduce((sum, course) => sum + course.stats.skipped, 0);
  const lessonsTotal = views.reduce((sum, course) => sum + course.stats.lessons, 0);

  return {
    lessonsPassed,
    lessonsSkipped,
    lessonsTotal,
    percent: lessonsTotal === 0 ? 0 : Math.round(((lessonsPassed + lessonsSkipped) / lessonsTotal) * 100),
    streakDays,
    nextLesson: nextLessonOf(views),
  };
}
