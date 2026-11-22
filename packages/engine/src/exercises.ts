import type {
  AttemptResult,
  Exercise,
  ExerciseResult,
  Lesson,
  LessonState,
  MatchPairsExercise,
  PublicExercise,
} from '@ciaocorea/shared';
import { compact, foldItalian, foldRomanization, matchesAny, normalizeAnswer } from './normalize';
import { pronunciationRomanize, romanizeWord } from './romanize';

/** Soglia di superamento di una lezione: sotto l'80% si torna a studiare. */
export const PASS_THRESHOLD = 0.8;

/**
 * Quello che la pagina può vedere. La soluzione non esce dallo store: se
 * arrivasse alla pagina, "studiare" diventerebbe "leggere la risposta giusta".
 */
export function stripExercise(exercise: Exercise): PublicExercise {
  const { answer: _answer, accept: _accept, ...rest } = exercise as Exercise & {
    answer?: string;
    accept?: string[];
  };
  return rest as PublicExercise;
}

export function stripExercises(exercises: readonly Exercise[]): PublicExercise[] {
  return exercises.map(stripExercise);
}

function checkChoice(exercise: Exercise, response: string): boolean {
  if (exercise.type !== 'jamo_choice' && exercise.type !== 'reading_mcq') return false;
  return normalizeAnswer(response) === normalizeAnswer(exercise.answer);
}

function checkHangul(exercise: Exercise, response: string): boolean {
  if (
    exercise.type !== 'type_hangul' &&
    exercise.type !== 'block_build' &&
    exercise.type !== 'listen_type'
  )
    return false;
  const accepted = [exercise.answer, ...((exercise as { accept?: string[] }).accept ?? [])];
  // compact = normalizzazione Hangul + niente spazi: "강 ." e "강" sono la
  // stessa risposta, e i jamo di compatibilità restano equivalenti.
  return matchesAny(response, accepted, compact).matched;
}

function checkMeaning(exercise: Exercise, response: string): boolean {
  if (exercise.type !== 'type_meaning') return false;
  const accepted = [exercise.answer, ...(exercise.accept ?? [])];
  return matchesAny(response, accepted, foldItalian).matched;
}

/**
 * Leggere e trascrivere: la romanizzazione si confronta senza maiuscole, senza
 * apostrofi e senza trattini, che sono convenzioni e non suoni. `kkochi`,
 * `Kkochi` e `kko-chi` sono la stessa risposta.
 *
 * Il motore accetta anche la romanizzazione che non applica le regole di
 * pronuncia (들어요 → deuleoyo accanto a deureoyo): sono due modi onesti di
 * trascrivere le stesse lettere, e nessuno dei due va trattato da errore.
 */
function checkReading(exercise: Exercise, response: string): boolean {
  if (exercise.type !== 'type_reading') return false;
  const accepted = [
    exercise.answer,
    ...(exercise.accept ?? []),
    romanizeWord(exercise.text),
    pronunciationRomanize(exercise.text),
  ];
  return matchesAny(response, accepted, foldRomanization).matched;
}

/**
 * Frase da rimettere in ordine: la risposta è la sequenza di tessere toccate,
 * `compact` toglie gli spazi così "나는 학교에" e "나는학교에" sono la stessa
 * risposta, mentre l'ordine delle parole resta quello che conta.
 */
function checkOrder(exercise: Exercise, response: string): boolean {
  if (exercise.type !== 'order_words') return false;
  return matchesAny(response, [exercise.answer], compact).matched;
}

/**
 * Buco da completare: con le opzioni è una scelta secca, senza si scrive in
 * coreano e vale la stessa normalizzazione degli esercizi di scrittura.
 */
function checkBlank(exercise: Exercise, response: string): boolean {
  if (exercise.type !== 'fill_blank') return false;
  const accepted = [exercise.answer, ...(exercise.accept ?? [])];
  const compare = exercise.options ? normalizeAnswer : compact;
  return matchesAny(response, accepted, compare).matched;
}

export function isCorrect(exercise: Exercise, response: string): boolean {
  switch (exercise.type) {
    case 'jamo_choice':
    case 'reading_mcq':
      return checkChoice(exercise, response);
    case 'block_build':
    case 'type_hangul':
    case 'listen_type':
      return checkHangul(exercise, response);
    case 'type_meaning':
      return checkMeaning(exercise, response);
    case 'type_reading':
      return checkReading(exercise, response);
    case 'order_words':
      return checkOrder(exercise, response);
    case 'fill_blank':
      return checkBlank(exercise, response);
    case 'match_pairs':
      return checkMatch(exercise, response);
  }
}

/**
 * La soluzione di un «collega»: le coppie nei dati sono già coppie vere,
 * quindi l'elemento i della colonna fissa va all'elemento i. È l'app a
 * mescolare la colonna mobile, non chi scrive il corso.
 */
export function matchSolution(exercise: MatchPairsExercise): number[] {
  return exercise.pairs.map((_, index) => index);
}

/** La risposta di un «collega»: indici separati da virgola, nell'ordine della colonna fissa. */
export function encodeMatch(indices: readonly number[]): string {
  return indices.join(',');
}

/**
 * Che cosa risponde a un «collega». Ogni elemento deve avere il suo
 * collegamento e nessuno può averne due: una risposta incompleta, o con un
 * elemento collegato due volte, non è mezza giusta: è sbagliata.
 */
export function checkMatch(exercise: MatchPairsExercise, response: string): boolean {
  const given = response.split(',').map((part) => Number(part.trim()));
  if (given.length !== exercise.pairs.length) return false;
  if (given.some((index) => !Number.isInteger(index) || index < 0 || index >= exercise.pairs.length)) {
    return false;
  }
  if (new Set(given).size !== given.length) return false;
  return given.every((index, position) => index === matchSolution(exercise)[position]);
}

/**
 * La risposta di un «collega» letta indietro: una lista di indici corta o
 * malformata non è una risposta, e si restituisce vuota.
 */
export function parseMatch(response: string): number[] {
  if (!response.trim()) return [];
  const given = response.split(',').map((part) => Number(part.trim()));
  if (given.some((index) => !Number.isInteger(index))) return [];
  return given;
}

/**
 * La risposta che supera l'esercizio, per qualsiasi tipo. Serve ai test che
 * scorrono tutto il curricolo e a chi deve rispondere per finta: il «collega»
 * non ha una soluzione scritta nei dati, perché la scrive l'app.
 */
export function sampleResponse(exercise: Exercise): string {
  return exercise.type === 'match_pairs' ? encodeMatch(matchSolution(exercise)) : exercise.answer;
}

/** La soluzione scritta per esteso, per la scheda degli errori. */
export function describeMatch(exercise: MatchPairsExercise): string {
  return exercise.pairs
    .map((pair) => (exercise.from === 'ko' ? `${pair.ko} → ${pair.it}` : `${pair.it} → ${pair.ko}`))
    .join(' · ');
}

export function gradeExercise(exercise: Exercise, response: string): ExerciseResult {
  return {
    exerciseId: exercise.id,
    correct: isCorrect(exercise, response),
    expected: exercise.type === 'match_pairs' ? describeMatch(exercise) : exercise.answer,
    response: normalizeAnswer(response),
  };
}

export interface SubmittedAnswer {
  exerciseId: string;
  response: string;
}

export interface GradeOptions {
  threshold?: number;
  /** Stato da assegnare quando la prova è superata (lezione normale o test). */
  passedState?: Extract<LessonState, 'passed' | 'skipped'>;
  previousBest?: number | null;
}

/**
 * Corregge una prova. Le risposte che non corrispondono a nessun
 * esercizio della lezione vengono ignorate: un client vecchio non deve poter
 * abbassare (né alzare) il punteggio inventando id.
 */
export function gradeAttempt(
  exercises: readonly Exercise[],
  answers: readonly SubmittedAnswer[],
  options: GradeOptions = {},
): AttemptResult {
  const threshold = options.threshold ?? PASS_THRESHOLD;
  const passedState = options.passedState ?? 'passed';
  const byId = new Map(answers.map((answer) => [answer.exerciseId, answer.response]));

  const results = exercises.map((exercise) => gradeExercise(exercise, byId.get(exercise.id) ?? ''));
  const correct = results.filter((result) => result.correct).length;
  const total = results.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  const passed = total > 0 && correct / total >= threshold;
  const previousBest = options.previousBest ?? null;

  return {
    score,
    correct,
    total,
    passed,
    results,
    lessonState: passed ? passedState : 'in_progress',
    bestScore: previousBest === null ? score : Math.max(previousBest, score),
  };
}

/**
 * Domande a risposta scritta: quelle che dimostrano il contenuto. Una scelta
 * multipla la si indovina in quattro secondi, scrivere la frase no, e il test
 * di salto serve a distinguere chi sa da chi tira a indovinare.
 */
export function isWrittenExercise(exercise: Exercise): boolean {
  switch (exercise.type) {
    case 'type_hangul':
    case 'type_meaning':
    case 'type_reading':
    case 'order_words':
    case 'listen_type':
      return true;
    case 'fill_blank':
      return exercise.options === undefined;
    default:
      return false;
  }
}

/**
 * Il test per saltare una lezione è deterministico (stessa lezione, stesse
 * domande) e pesca a intervalli regolari, così copre tutta la lezione invece
 * di ripetere le prime cinque domande. Prima si scelgono le domande con
 * risposta scritta: sono quelle che dimostrano davvero che il contenuto è noto.
 */
export function pickSkipTest(exercises: readonly Exercise[], count = 5): Exercise[] {
  if (exercises.length <= count) return [...exercises];

  const written = exercises.filter(isWrittenExercise);
  const chosen: Exercise[] = [];
  const used = new Set<string>();

  const takeStrided = (pool: readonly Exercise[], slots: number) => {
    if (slots <= 0 || pool.length === 0) return;
    for (let slot = 0; slot < slots; slot += 1) {
      const index = Math.floor((slot * pool.length) / slots);
      const candidate = pool[index] ?? pool[pool.length - 1];
      if (candidate && !used.has(candidate.id)) {
        used.add(candidate.id);
        chosen.push(candidate);
      }
    }
  };

  takeStrided(written, Math.min(2, count));
  takeStrided(exercises, count - chosen.length);

  // Riempimento: i due passaggi a intervalli possono sovrapporsi.
  for (const exercise of exercises) {
    if (chosen.length >= count) break;
    if (!used.has(exercise.id)) {
      used.add(exercise.id);
      chosen.push(exercise);
    }
  }

  return chosen.slice(0, count);
}

/** Domande del test di salto del corso: dodici, una per lezione quando ci sta. */
export const COURSE_SKIP_COUNT = 12;

/**
 * Campiona a intervalli regolari, senza spostare l'ordine: la lista che ne esce
 * copre tutto l'elenco invece delle prime `count` domande.
 */
function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];

  const picked: T[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const candidate = items[Math.floor((slot * items.length) / count)];
    if (candidate && !picked.includes(candidate)) picked.push(candidate);
  }
  return picked;
}

/**
 * Il test per saltare un corso intero: una domanda per lezione, pescata con gli
 * stessi criteri del test di salto (prima le risposte scritte, che sono quelle
 * che dimostrano il contenuto). Se le lezioni sono poche si alza il numero per
 * lezione, fino a raggiungere le domande richieste o fino a esaurirle.
 *
 * È deterministico: la prova non cambia fra due aperture della pagina, e non si
 * può ripetere sperando in una pesca più facile.
 */
export function pickCourseSkipTest(
  lessons: readonly Lesson[],
  options: { count?: number } = {},
): Exercise[] {
  const count = Math.max(1, options.count ?? COURSE_SKIP_COUNT);
  const pool = lessons
    .map((lesson) => lesson.exercises)
    .filter((exercises) => exercises.length > 0);
  if (pool.length === 0) return [];

  const biggest = Math.max(...pool.map((exercises) => exercises.length));
  const chosen: Exercise[] = [];
  const seen = new Set<string>();

  // Un giro per ogni "domande per lezione": si sale finché la pesca non arriva
  // alla misura richiesta o finché gli esercizi non sono finiti.
  for (let perLesson = 1; perLesson <= biggest; perLesson += 1) {
    chosen.length = 0;
    seen.clear();

    for (const exercises of pool) {
      for (const exercise of pickSkipTest(exercises, perLesson)) {
        if (seen.has(exercise.id)) continue;
        seen.add(exercise.id);
        chosen.push(exercise);
      }
    }

    if (chosen.length >= count) break;
  }

  return spread(chosen, count);
}
