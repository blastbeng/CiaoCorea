export type LessonState = 'locked' | 'available' | 'in_progress' | 'passed' | 'skipped';

export type LessonKind = 'letters' | 'syllables' | 'reading' | 'grammar' | 'vocab' | 'review';

/**
 * Esercizi: il contenuto vive nel curricolo, la correzione vive nel motore.
 * Le risposte corrette non lasciano mai il server: al client si invia la
 * versione "public" (senza answer/accept) e la correzione avviene lì dove i
 * dati sono già presenti.
 */
export interface ExerciseBase {
  id: string;
  /** La consegna, in italiano. */
  prompt: string;
  hint?: string;
  /** Spiegazione mostrata dopo la correzione. */
  explain?: string;
}

/** Scegli la forma giusta fra le opzioni (lettere, sillabe, significati). */
export interface JamoChoiceExercise extends ExerciseBase {
  type: 'jamo_choice';
  options: string[];
  answer: string;
}

/** Componi la sillaba a partire dai jamo dati, nell'ordine giusto. */
export interface BlockBuildExercise extends ExerciseBase {
  type: 'block_build';
  parts: string[];
  answer: string;
}

/** Scrivi in Hangul quello che leggi in romanizzazione o in italiano. */
export interface TypeHangulExercise extends ExerciseBase {
  type: 'type_hangul';
  answer: string;
  accept?: string[];
}

/** Leggi la parola coreana e scegli cosa significa. */
export interface ReadingMcqExercise extends ExerciseBase {
  type: 'reading_mcq';
  options: string[];
  answer: string;
}

/** Scrivi in italiano il significato della parola coreana. */
export interface TypeMeaningExercise extends ExerciseBase {
  type: 'type_meaning';
  answer: string;
  accept?: string[];
}

/**
 * Rimetti in ordine le parole della frase. Le tessere arrivano già mescolate
 * nel curricolo: la risposta che lo studente costruisce è le parole toccate,
 * unite da uno spazio.
 */
export interface OrderWordsExercise extends ExerciseBase {
  type: 'order_words';
  words: string[];
  /** La frase corretta: le stesse parole, nell'ordine giusto. */
  answer: string;
}

/** Il buco di un `fill_blank`: scritto così nel testo dell'esercizio. */
export const CLOZE_MARKER = '___';

/**
 * Completa la frase: il buco è scritto `___` nel testo. Con `options` la
 * risposta si sceglie, senza si scrive in coreano.
 */
export interface FillBlankExercise extends ExerciseBase {
  type: 'fill_blank';
  /** La frase con `___` al punto da completare. */
  text: string;
  options?: string[];
  answer: string;
  accept?: string[];
}

export type Exercise =
  | JamoChoiceExercise
  | BlockBuildExercise
  | TypeHangulExercise
  | ReadingMcqExercise
  | TypeMeaningExercise
  | OrderWordsExercise
  | FillBlankExercise;

export type ExerciseType = Exercise['type'];

/**
 * Esercizio senza soluzione: è ciò che il client riceve.
 * L'Omit va distribuito sui membri dell'unione, altrimenti restano solo i
 * campi comuni e il client non vedrebbe più options/parts/type.
 */
type WithoutSolution<T> = T extends unknown ? Omit<T, 'answer' | 'accept'> : never;
export type PublicExercise = WithoutSolution<Exercise>;

export interface ExerciseResult {
  exerciseId: string;
  correct: boolean;
  /** Risposta attesa, mostrata solo dopo la correzione. */
  expected: string;
  response: string;
}

export interface AttemptResult {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  results: ExerciseResult[];
  lessonState: LessonState;
  bestScore: number;
}

export interface VocabItem {
  /** Forma coreana (Hangul). */
  ko: string;
  /** Significato in italiano. */
  it: string;
  /** Romanizzazione riveduta, solo come appoggio per chi inizia. */
  rr: string;
}

/**
 * Un brano da leggere: sta nella lezione perché la lettura non è un esercizio
 * a sé, è il materiale su cui gli esercizi lavorano. La traduzione arriva al
 * client insieme al testo, ma l'interfaccia la apre solo a lezione chiusa:
 * leggerla prima renderebbe inutili le domande di comprensione.
 */
export interface ReadingPassage {
  title: string;
  /** Righe del brano, in coreano, nell'ordine in cui si leggono. */
  lines: string[];
  /** Parole difficili del brano, da leggere prima di attaccare il testo. */
  gloss: VocabItem[];
  /** Traduzione italiana, mostrata dopo il tentativo. */
  translation: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  titleKo: string;
  kind: LessonKind;
  /** Obiettivo didattico in una frase. */
  goal: string;
  durationMin: number;
  /** Punti chiave da leggere prima degli esercizi. */
  points: string[];
  vocab: VocabItem[];
  /** Brani per le lezioni di lettura. */
  passages?: ReadingPassage[];
  exercises: Exercise[];
}

export interface Unit {
  id: string;
  title: string;
  /** Perché questa unità esiste, in una riga. */
  purpose: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  /** Livello QCER di riferimento: pre-A1, A1, A2... */
  level: string;
  description: string;
  units: Unit[];
}

/**
 * Una lezione vista dal client: senza esercizi, quindi senza soluzioni.
 * Gli esercizi arrivano solo dall'endpoint della singola lezione, già privati
 * della risposta corretta.
 */
export interface LessonView extends Omit<Lesson, 'exercises'> {
  state: LessonState;
  bestScore: number | null;
}

export interface LessonDetail {
  course: { slug: string; title: string };
  unit: { id: string; title: string };
  lesson: LessonView;
  exercises: PublicExercise[];
  skipTest: PublicExercise[];
}

export interface CourseListResponse {
  courses: CourseView[];
  summary: ProgressSummary;
  dueCards: number;
  /** Che cosa fare oggi, e come sta andando la settimana. */
  plan: StudyPlan;
}

export interface AttemptResponse {
  attempt: AttemptResult;
  course: CourseView;
  summary: ProgressSummary;
}

/**
 * Il test per saltare un corso intero: dodici domande campionate da tutte le
 * lezioni, una per lezione quando ci sta. Come per gli esercizi di lezione, le
 * soluzioni non viaggiano: la correzione è del server.
 */
export interface CourseSkipTest {
  course: { slug: string; title: string; level: string };
  exercises: PublicExercise[];
  /** Soglia di superamento in percentuale: 80, come per le lezioni. */
  threshold: number;
  /** Lezioni che il test chiuderà se viene superato. */
  lessonsToClose: number;
  /** Lezioni già chiuse: il test non le tocca. */
  lessonsClosed: number;
}

export interface CourseSkipResponse {
  attempt: AttemptResult;
  course: CourseView;
  summary: ProgressSummary;
  /** Lezioni chiuse dal test, in questa consegna. */
  lessonsSkipped: number;
  reviewsCreated: number;
}

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  courseSlug: string;
  lessonId: string;
  dueAt: string;
}

export interface ReviewResponse {
  cards: ReviewCard[];
  dueCards: number;
}

/**
 * I due numeri che la shell mostra accanto alle voci: ripassi in scadenza ed
 * errori da rifare. Li chiede a ogni cambio di pagina per tenere i badge
 * aggiornati, e tirarsi dietro quaranta carte per scrivere due cifre sarebbe
 * sprecato.
 */
export interface DueCountResponse {
  dueCards: number;
  mistakes: number;
}

/* ------------------------------------------------------------------------- *
 * Il ripasso degli errori: gli esercizi che questo studente ha sbagliato
 * restano in una banca finché non li azzecca. Non è il ripasso delle parole
 * (quello è SRS, per parola): qui torna l'esercizio intero, com'era, con il
 * conto di quante volte è andato storto.
 * ------------------------------------------------------------------------- */

/** Un esercizio sbagliato, con la lezione da cui viene e quante volte è caduto. */
export interface MistakeItem {
  exercise: PublicExercise;
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  /** Quante volte è stato sbagliato: 2 significa che non era distrazione. */
  wrongCount: number;
  lastWrongAt: string;
}

export interface MistakesStats {
  /** Esercizi ancora in banca. */
  total: number;
  /** Lezioni da cui arrivano: dicono dove tornare a rileggere. */
  lessons: number;
}

export interface MistakesResponse {
  items: MistakeItem[];
  stats: MistakesStats;
}

export interface MistakeAnswerResponse {
  /** La correzione, con la risposta attesa: qui è lecito, è già stata data. */
  result: ExerciseResult;
  /** Restano in banca con questo conto; `null` se l'esercizio è uscito. */
  wrongCount: number | null;
  stats: MistakesStats;
}

export interface LoginResponse {
  user: SessionUser;
}

/* ------------------------------------------------------------------------- *
 * Conversazione guidata: il dialogo è un copione, non un modello linguistico.
 * Ogni battuta dello studente ha una forma attesa e un insieme di varianti
 * accettate: la correzione è deterministica e avviene sul server.
 * ------------------------------------------------------------------------- */

export type DialogueAnswerKind = 'choice' | 'type';

/** Risposta attesa da una battuta: la forma corretta è il `ko` della battuta. */
export interface DialogueAnswer {
  kind: DialogueAnswerKind;
  /** Varianti accettate oltre alla forma principale. */
  accept?: string[];
  /** Obbligatorie quando kind è 'choice'. */
  options?: string[];
  /** Promemoria mostrato accanto al campo di scrittura. */
  hint?: string;
}

export interface DialogueTurn {
  id: string;
  /** Chi parla. "Tu" è lo studente: la sua battuta è la risposta da produrre. */
  speaker: string;
  /** Forma coreana della battuta (per lo studente: la risposta corretta). */
  ko: string;
  /** Traduzione italiana: per lo studente è la consegna. */
  it: string;
  /** Nota didattica mostrata dopo la correzione. */
  note?: string;
  answer?: DialogueAnswer;
}

/** Riferimento secco a una lezione del percorso, come sta nel file dei dialoghi. */
export interface DialogueCourseLink {
  courseSlug: string;
  lessonId: string;
}

export interface Dialogue {
  id: string;
  slug: string;
  title: string;
  level: string;
  setting: string;
  goal: string;
  points: string[];
  /** Lezione che apre il dialogo; assente = dialogo sempre disponibile. */
  after?: DialogueCourseLink;
  turns: DialogueTurn[];
}

/**
 * La battuta come la vede il client: senza soluzione né varianti accettate.
 * Il `ko` di una battuta dello studente è la soluzione, quindi resta null
 * finché quella battuta non è stata superata.
 */
export type PublicDialogueTurn = Omit<DialogueTurn, 'answer' | 'ko'> & {
  ko: string | null;
  answer: { kind: DialogueAnswerKind; options?: string[]; hint?: string } | null;
};

/** Lezione che apre il dialogo: a dialogo finito, il link da seguire. */
export interface DialogueLink {
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

export interface DialogueSummary {
  id: string;
  slug: string;
  title: string;
  level: string;
  setting: string;
  goal: string;
  points: string[];
  /** Battute che richiedono una risposta. */
  totalTurns: number;
  answered: number;
  correct: number;
  completed: boolean;
  /** Lezione che apre il dialogo, se il curricolo ne indica una. */
  after: DialogueLink | null;
  /** Falso finché la lezione di riferimento non è chiusa. */
  locked: boolean;
}

export interface DialogueListResponse {
  dialogues: DialogueSummary[];
}

export interface DialogueDetail {
  dialogue: DialogueSummary;
  turns: PublicDialogueTurn[];
  /** Indice della prima battuta non ancora superata. */
  turnIndex: number;
}

export interface DialogueAnswerResponse {
  correct: boolean;
  /** Forma corretta: c'è se la risposta è giusta o dopo due errori. */
  expected: string | null;
  note: string | null;
  turnIndex: number;
  completed: boolean;
  correctCount: number;
  answered: number;
  total: number;
  /** Errori accumulati sulla battuta appena inviata. */
  wrong: number;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface UnitView extends Omit<Unit, 'lessons'> {
  lessons: LessonView[];
}

export interface CourseStats {
  lessons: number;
  passed: number;
  skipped: number;
  percent: number;
}

export interface CourseView extends Omit<Course, 'units'> {
  units: UnitView[];
  stats: CourseStats;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export interface ProgressSummary {
  lessonsPassed: number;
  lessonsSkipped: number;
  lessonsTotal: number;
  percent: number;
  streakDays: number;
  /** Esercizi sbagliati e non ancora rifatti: 0 quando la banca è vuota. */
  mistakesOpen: number;
  nextLesson: {
    courseSlug: string;
    lessonId: string;
    lessonTitle: string;
    state: LessonState;
  } | null;
}

export const LESSON_STATE_LABEL: Record<LessonState, string> = {
  locked: 'Bloccata',
  available: 'Da fare',
  in_progress: 'In corso',
  passed: 'Completata',
  skipped: 'Saltata',
};

/* ------------------------------------------------------------------------- *
 * Dizionario: il lessico del curricolo reso consultabile. Non è un corso, è
 * lo strumento che lo studente usa fra una lezione e l'altra.
 * ------------------------------------------------------------------------- */

export interface VocabEntry {
  ko: string;
  it: string;
  rr: string;
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

export interface VocabFilterOption {
  slug: string;
  title: string;
  count: number;
}

export interface VocabularyResponse {
  entries: VocabEntry[];
  /** Voci complessive che matchano, prima del limite di pagina. */
  total: number;
  /** Quante voci ha il curricolo in tutto. */
  curriculum: number;
  courses: VocabFilterOption[];
  query: string;
}

/* ------------------------------------------------------------------------- *
 * Il quaderno: testi scritti dallo studente, senza correzione automatica.
 * L'app non può giudicare un testo libero, quindi fa l'unica cosa onesta che
 * può fare: lo confronta con il modello e dice dove manca qualcosa. Il
 * giudizio finale resta allo studente, che è chi impara.
 * ------------------------------------------------------------------------- */

export type WritingVerdict = 'model' | 'close' | 'far';

/** Un testo da scrivere, legato alla lezione che insegna le parole che servono. */
export interface WritingPrompt {
  id: string;
  courseSlug: string;
  lessonId: string;
  title: string;
  /** La consegna, in italiano: che cosa bisogna scrivere. */
  task: string;
  /** Parole suggerite, da inserire con un clic. */
  words: string[];
  /** Forme che devono comparire: sono la lista che il controllo usa. */
  must: string[];
  model: string;
  /** Varianti altrettanto corrette del testo modello. */
  alt?: string[];
  /** Perché il modello è scritto così. */
  notes?: string;
}

export interface WritingCheck {
  verdict: WritingVerdict;
  /** Forme richieste che non compaiono nel testo. */
  missing: string[];
  /** Quanto il testo somiglia al modello, da 0 a 1. */
  similarity: number;
  model: string;
  notes?: string;
}

export interface WritingEntry {
  id: string;
  promptId: string;
  text: string;
  verdict: WritingVerdict;
  createdAt: string;
}

/**
 * La consegna come la vede il client: il modello e la lista delle forme
 * obbligatorie restano sul server finché lo studente non ha scritto, altrimenti
 * il quaderno diventerebbe un esercizio di copia.
 */
export interface WritingPromptView {
  id: string;
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  task: string;
  words: string[];
  /** Si apre dopo aver chiuso la lezione che insegna quelle parole. */
  unlocked: boolean;
  last: WritingEntry | null;
}

export interface WritingStats {
  /** Testi scritti almeno una volta, sul totale disponibile. */
  done: number;
  total: number;
  /** Consegne già aperte: le altre aspettano la loro lezione. */
  unlocked: number;
}

export interface WritingResponse {
  prompts: WritingPromptView[];
  stats: WritingStats;
}

export interface WritingCheckResponse {
  check: WritingCheck;
  entry: WritingEntry;
  stats: WritingStats;
}

/* ------------------------------------------------------------------------- *
 * Profilo dello studente: una lettura d'insieme di ciò che ha fatto, per
 * capirci qualcosa senza dover aprire ogni corso.
 * ------------------------------------------------------------------------- */

export interface DayActivity {
  day: string;
  exercises: number;
  correct: number;
  lessonsCompleted: number;
  /** Ripassi di parole fatti quel giorno: contano come studio. */
  reviews: number;
  /** Testi scritti nel quaderno: anche scrivere è una giornata di studio. */
  writing: number;
}

export interface SrsStats {
  /** Card create (uno incontro = una card). */
  cards: number;
  /** Parole distinte: la stessa parola in due lezioni conta una volta. */
  words: number;
  due: number;
  /** Card con almeno un ripasso già fatto. */
  reviewed: number;
  /** Card che tornano a distanza di una settimana o più. */
  mature: number;
}

export interface CourseSlice {
  slug: string;
  title: string;
  level: string;
  stats: CourseStats;
}

export interface DialogueStats {
  total: number;
  completed: number;
  answered: number;
  correct: number;
}

/** Numeri di carriera: ciò che lo studente ha fatto dall'iscrizione a oggi. */
export interface CareerTotals {
  attempts: number;
  exercises: number;
  correct: number;
  /** Risposte giuste sul totale, in percentuale; 0 se non ha ancora fatto nulla. */
  accuracy: number;
}

/** Una cosa da fare oggi, con il link dove farla. */
export interface PlanTask {
  key: 'lesson' | 'reviews' | 'dialogue';
  label: string;
  detail: string;
  href: string;
}

/**
 * Il piano della giornata: le cose in programma, più lo stato dell'obiettivo
 * settimanale (giorni di studio su `goal`). È fatto dal server, così la pagina
 * non deve indovinare niente: mostra e basta.
 */
export interface StudyPlan {
  /** Giorno a cui il piano si riferisce, `YYYY-MM-DD`. */
  day: string;
  /** Lunedì della settimana in corso, `YYYY-MM-DD`. */
  weekStart: string;
  /** Giorni di studio da raggiungere nella settimana (1-7). */
  goal: number;
  /** Giorni già studiati in questa settimana. */
  daysStudied: number;
  /** Giorni che mancano alla fine della settimana, oggi compreso. */
  daysLeft: number;
  goalMet: boolean;
  streakDays: number;
  tasks: PlanTask[];
  /** Frase di stato: giornata libera, obiettivo raggiunto, recupero. */
  note: string;
}


export interface ProfileResponse {
  user: SessionUser;
  memberSince: string;
  summary: ProgressSummary;
  totals: CareerTotals;
  courses: CourseSlice[];
  srs: SrsStats;
  activity: DayActivity[];
  /** Giorni di studio da raggiungere ogni settimana (1-7). */
  weeklyGoal: number;
  dialogues: DialogueStats;
  /** Quante voci del dizionario del curricolo sono già state incontrate. */
  vocabulary: { seen: number; total: number };
}

