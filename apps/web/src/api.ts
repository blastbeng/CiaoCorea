import type {
  AttemptResponse,
  CourseListResponse,
  CourseView,
  DialogueAnswerResponse,
  DueCountResponse,
  DialogueDetail,
  DialogueListResponse,
  LessonDetail,
  ProfileResponse,
  ProgressSummary,
  ReviewResponse,
  SessionUser,
  VocabularyResponse,
  WritingCheckResponse,
  WritingResponse,
} from '@ciaocorea/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: init.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });

  if (!response.ok) {
    let code = 'error';
    let message = `Errore ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      code = body.error ?? code;
      message = body.message ?? message;
    } catch {
      // corpo non JSON: si tiene il messaggio generico
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Il badge dei ripassi vive nella shell e non nella pagina: quando una pagina
 * consuma una carta lo dice qui, invece di costringere la shell a ricaricare.
 */
export const DUE_CHANGED = 'ciaocorea:due-changed';

export function announceDue(dueCards: number): void {
  window.dispatchEvent(new CustomEvent<number>(DUE_CHANGED, { detail: dueCards }));
}

export interface SubmitAnswer {
  exerciseId: string;
  response: string;
}

export const api = {
  session: () => request<{ user: SessionUser | null }>('/api/auth/session'),

  login: (email: string, password: string) =>
    request<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /** Come è aperta l'iscrizione: chiuso, con codice, o libera. */
  registration: () =>
    request<{ mode: 'closed' | 'invite' | 'open'; closed: boolean; needsCode: boolean }>(
      '/api/auth/registration',
    ),

  register: (input: { displayName: string; email: string; password: string; code?: string }) =>
    request<{ user: SessionUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  dashboard: () => request<CourseListResponse>('/api/dashboard'),

  course: (slug: string) => request<{ course: CourseView }>(`/api/courses/${slug}`),

  lesson: (courseSlug: string, lessonId: string) =>
    request<LessonDetail>(`/api/courses/${courseSlug}/lessons/${lessonId}`),

  submit: (
    courseSlug: string,
    lessonId: string,
    mode: 'lesson' | 'skip',
    answers: SubmitAnswer[],
    durationMs: number,
  ) =>
    request<AttemptResponse>(`/api/courses/${courseSlug}/lessons/${lessonId}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ mode, answers, durationMs }),
    }),

  summary: () => request<ProgressSummary>('/api/progress/summary'),

  /** Solo il numero dei ripassi in scadenza, per il badge nella shell. */
  due: () => request<DueCountResponse>('/api/progress/due'),

  review: () => request<ReviewResponse>('/api/review'),

  gradeCard: (cardId: string, grade: 0 | 1 | 2) =>
    request<{ dueCards: number }>(`/api/review/${cardId}`, {
      method: 'POST',
      body: JSON.stringify({ grade }),
    }),

  dialogues: () => request<DialogueListResponse>('/api/dialogues'),

  dialogue: (slug: string) => request<DialogueDetail>(`/api/dialogues/${slug}`),

  answerDialogue: (slug: string, response: string) =>
    request<DialogueAnswerResponse>(`/api/dialogues/${slug}/answer`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    }),

  restartDialogue: (slug: string) =>
    request<DialogueDetail>(`/api/dialogues/${slug}/restart`, { method: 'POST' }),

  vocabulary: (query: string, course: string, offset = 0, limit = 40) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (course) params.set('course', course);
    if (offset > 0) params.set('offset', String(offset));
    params.set('limit', String(limit));
    return request<VocabularyResponse>(`/api/vocabulary?${params.toString()}`);
  },

  /** Le consegne del quaderno: il modello arriva solo dopo aver scritto. */
  writing: () => request<WritingResponse>('/api/writing'),

  submitWriting: (promptId: string, text: string) =>
    request<WritingCheckResponse>(`/api/writing/${promptId}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  profile: () => request<ProfileResponse>('/api/profile'),

  /** Quanti giorni di studio lo studente vuole fare in una settimana. */
  setGoal: (goal: number) =>
    request<{ weeklyGoal: number }>('/api/profile/goal', {
      method: 'POST',
      body: JSON.stringify({ goal }),
    }),

  changePassword: (current: string, next: string) =>
    request<{ ok: boolean; sessionsClosed: number }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    }),
};
