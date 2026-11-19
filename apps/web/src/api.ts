import type {
  AttemptResponse,
  CourseListResponse,
  CourseSkipResponse,
  CourseSkipTest,
  CourseView,
  DialogueAnswerResponse,
  DueCountResponse,
  DialogueDetail,
  DialogueListResponse,
  FragileResponse,
  FragileRetryResponse,
  LessonDetail,
  ProfileResponse,
  MistakeAnswerResponse,
  MistakesResponse,
  ReviewCheckResponse,
  ReviewResponse,
  SessionUser,
  VocabularyResponse,
  WordLookupResponse,
  WritingCheckResponse,
  WritingResponse,
} from '@ciaocorea/shared';
import { ApiError, type AccountsResponse } from '@ciaocorea/store';
import { getStore } from './db';

/**
 * Il portale non ha un server: le stesse rotte che prima rispondevano su HTTP
 * girano nella scheda, sopra SQLite in wasm. Questa è l'unica differenza che le
 * pagine vedono — le firme restano quelle di prima.
 */
export { ApiError };

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const store = await getStore();
  return store.call<T>(method, url, body);
}

/**
 * I badge della shell (ripassi in scadenza, errori da rifare) non vivono nella
 * pagina che li consuma: quando una pagina chiude una carta o un errore lo dice
 * qui, e la shell rilegge i conteggi. I due numeri si muovono insieme spesso,
 * quindi basta un evento solo: "è cambiato quello che mi aspetta".
 */
export const PENDING_CHANGED = 'ciaocorea:pending-changed';

export function announcePending(): void {
  window.dispatchEvent(new Event(PENDING_CHANGED));
}

interface SubmitAnswer {
  exerciseId: string;
  response: string;
}

export const api = {
  session: () => request<{ user: SessionUser | null }>('GET', '/api/auth/session'),

  /** I profili creati su questo browser, con quello attivo. */
  accounts: async (): Promise<AccountsResponse> => (await getStore()).accounts(),

  /** Passa a un profilo senza password; null se la sua sessione è scaduta. */
  switchUser: async (userId: string): Promise<SessionUser | null> =>
    (await getStore()).switchUser(userId),

  /** L'apertura del sito: riprende l'ultimo profilo, o apre il primo. */
  bootstrap: async (): Promise<SessionUser> => (await getStore()).bootstrap(),

  /** Un profilo in più su questo browser, e diventa quello aperto. */
  addProfile: async (): Promise<SessionUser> => (await getStore()).addProfile(),

  /** L'unico nome del profilo: unico fra i profili di questo computer. */
  changeUsername: async (username: string): Promise<SessionUser> =>
    (await getStore()).changeUsername(username),

  dashboard: () => request<CourseListResponse>('GET', '/api/courses'),

  course: (slug: string) => request<{ course: CourseView }>('GET', `/api/courses/${slug}`),

  /** La prova che chiude un corso intero: una domanda per lezione, sempre le stesse. */
  skipTest: (slug: string) => request<CourseSkipTest>('GET', `/api/courses/${slug}/skip-test`),

  skipCourse: (slug: string, answers: SubmitAnswer[], durationMs: number) =>
    request<CourseSkipResponse>('POST', `/api/courses/${slug}/skip`, { answers, durationMs }),

  lesson: (courseSlug: string, lessonId: string) =>
    request<LessonDetail>('GET', `/api/courses/${courseSlug}/lessons/${lessonId}`),

  submit: (
    courseSlug: string,
    lessonId: string,
    mode: 'lesson' | 'skip',
    answers: SubmitAnswer[],
    durationMs: number,
  ) =>
    request<AttemptResponse>('POST', `/api/courses/${courseSlug}/lessons/${lessonId}/attempts`, {
      mode,
      answers,
      durationMs,
    }),

  /** Solo il numero dei ripassi in scadenza, per il badge nella shell. */
  due: () => request<DueCountResponse>('GET', '/api/progress/due'),

  review: () => request<ReviewResponse>('GET', '/api/review'),

  /** Le parole che hanno ceduto più volte: si possono riprendere subito. */
  fragileWords: () => request<FragileResponse>('GET', '/api/review/fragile'),

  retryFragile: (cardId: string) =>
    request<FragileRetryResponse>('POST', `/api/review/fragile/${cardId}`),

  gradeCard: (cardId: string, grade: 0 | 1 | 2) =>
    request<ReviewCheckResponse>('POST', `/api/review/${cardId}`, { grade }),

  /** Le carte da scrivere si correggono dentro la scheda: qui si manda la parola. */
  answerCard: (cardId: string, response: string) =>
    request<ReviewCheckResponse>('POST', `/api/review/${cardId}`, { response }),

  dialogues: () => request<DialogueListResponse>('GET', '/api/dialogues'),

  dialogue: (slug: string) => request<DialogueDetail>('GET', `/api/dialogues/${slug}`),

  answerDialogue: (slug: string, response: string) =>
    request<DialogueAnswerResponse>('POST', `/api/dialogues/${slug}/answer`, { response }),

  restartDialogue: (slug: string) =>
    request<DialogueDetail>('POST', `/api/dialogues/${slug}/restart`),

  vocabulary: (query: string, course: string, offset = 0, limit = 40) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (course) params.set('course', course);
    if (offset > 0) params.set('offset', String(offset));
    params.set('limit', String(limit));
    return request<VocabularyResponse>('GET', `/api/vocabulary?${params.toString()}`);
  },

  /** La scheda di una parola cliccata dentro un brano. */
  lookupWord: (word: string) =>
    request<WordLookupResponse>('GET', `/api/vocabulary/lookup?w=${encodeURIComponent(word)}`),

  /** Le consegne del quaderno: il modello arriva solo dopo aver scritto. */
  writing: () => request<WritingResponse>('GET', '/api/writing'),

  submitWriting: (promptId: string, text: string) =>
    request<WritingCheckResponse>('POST', `/api/writing/${promptId}`, { text }),

  /** La banca degli errori: gli esercizi sbagliati e non ancora rifatti. */
  mistakes: () => request<MistakesResponse>('GET', '/api/mistakes'),

  answerMistake: (exerciseId: string, response: string) =>
    request<MistakeAnswerResponse>('POST', `/api/mistakes/${exerciseId}`, { response }),

  profile: () => request<ProfileResponse>('GET', '/api/profile'),

  /** Quanti giorni di studio lo studente vuole fare in una settimana. */
  setGoal: (goal: number) =>
    request<{ weeklyGoal: number }>('POST', '/api/profile/goal', { goal }),
};
