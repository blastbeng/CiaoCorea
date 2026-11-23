import { pickChallenge, type ChallengeSource } from './challenge';

/**
 * Il traguardo di livello: un controllo di metà strada, non un certificato.
 *
 * Le domande vengono solo dalle lezioni già chiuse di quel livello, quindi
 * l'esame non anticipa mai un contenuto che lo studente non ha incontrato. Si
 * apre quando metà delle lezioni del livello è chiusa — abbastanza da poter
 * pescare venti domande diverse senza ripetersi, non così tante da diventare
 * un esame di fine corso.
 */

export interface ExamLevelInfo {
  id: string;
  label: string;
  title: string;
  description: string;
}

/**
 * La scala dei livelli, nell'ordine in cui si attraversa. Gli `id` sono quelli
 * che il curricolo scrive nel campo `level` dei corsi (normalizzati in
 * minuscolo): se un corso nuovo porta un livello che qui non c'è, resta fuori
 * dal traguardo invece di finire nel posto sbagliato.
 */
export const EXAM_LEVELS: readonly ExamLevelInfo[] = [
  {
    id: 'pre-a1',
    label: 'Pre-A1',
    title: 'Le lettere',
    description: 'Leggere e scrivere l’hangul: jamo, blocchi sillabici, 받침 e le regole che cambiano il suono.',
  },
  {
    id: 'a1',
    label: 'A1',
    title: 'Le prime frasi',
    description: 'Presentarsi, chiedere, dire di no: la frase cortese e le particelle che la tengono in piedi.',
  },
  {
    id: 'a2',
    label: 'A2',
    title: 'La vita di tutti i giorni',
    description: 'Passato e futuro, numeri e contatori, radici irregolari, rispetto e situazioni pratiche.',
  },
  {
    id: 'b1',
    label: 'B1',
    title: 'Testi e discorso',
    description: 'Leggere testi veri, collegare le frasi e riportare quello che ha detto qualcun altro.',
  },
  {
    id: 'b2',
    label: 'B2',
    title: 'Le sfumature',
    description: 'Discorso indiretto, passivo e causativo, congetture e ipotesi: il coreano che non si vede nei manuali.',
  },
];

/** Quante domande ha un traguardo. */
export const EXAM_SIZE = 20;
/** La soglia di superamento, in percentuale: quindici risposte su venti. */
export const EXAM_THRESHOLD = 75;
/** Sotto questa disponibilità l’esame sarebbe un ripasso travestito. */
export const EXAM_MIN_EXERCISES = 12;
/** La quota di lezioni del livello che va chiusa prima di presentarsi. */
export const EXAM_READY_RATIO = 0.5;

const byId = new Map(EXAM_LEVELS.map((level) => [level.id, level]));

export function findExamLevel(id: string): ExamLevelInfo | undefined {
  return byId.get(id.trim().toLowerCase());
}

export interface ExamLevelFacts {
  /** Lezioni del livello presenti nel curricolo. */
  totalLessons: number;
  /** Lezioni del livello già passate o saltate. */
  closedLessons: number;
  /** Esercizi disponibili nelle lezioni chiuse del livello. */
  availableExercises: number;
}

export interface ExamReadiness extends ExamLevelFacts {
  requiredLessons: number;
  missingLessons: number;
  unlocked: boolean;
}

/**
 * Quante lezioni servono, e se bastano. Il minimo di quattro protegge i livelli
 * corti: chiedere metà di tre lezioni sarebbe chiedere due lezioni, e un esame
 * su due lezioni non dice niente.
 */
export function examReadiness(facts: ExamLevelFacts): ExamReadiness {
  const requiredLessons = Math.max(4, Math.ceil(facts.totalLessons * EXAM_READY_RATIO));
  const missingLessons = Math.max(0, requiredLessons - facts.closedLessons);
  return {
    ...facts,
    requiredLessons,
    missingLessons,
    unlocked: missingLessons === 0 && facts.availableExercises >= EXAM_MIN_EXERCISES,
  };
}

/** Il livello dei corsi e quello dell’esame si somigliano: si confrontano così. */
export function sameLevel(courseLevel: string, examLevelId: string): boolean {
  return courseLevel.trim().toLowerCase() === examLevelId.trim().toLowerCase();
}

/**
 * Le domande del traguardo: solo esercizi del livello, presi a turno dalle
 * lezioni. Stesso seme, stesso esame: la consegna non può cambiare sotto i
 * piedi a chi sta rispondendo, e una seconda prova dentro la stessa giornata
 * non è una scusa per pescare le domande facili.
 */
export function selectExamQuestions(
  sources: readonly ChallengeSource[],
  levelId: string,
  seed: string,
): ChallengeSource[] {
  const ofLevel = sources.filter((source) => sameLevel(source.level, levelId));
  return pickChallenge(ofLevel, { count: EXAM_SIZE, perLesson: 2, seed });
}

export function examPassed(score: number): boolean {
  return score >= EXAM_THRESHOLD;
}
