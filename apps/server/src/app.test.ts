import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  courseLessons,
  findExercise,
  findLesson,
  getCourses,
  getCourse,
  getDialogue,
  getVocabulary,
  getWritingPrompts,
} from '@ciaocorea/curriculum';
import type {
  CourseListResponse,
  CourseSkipResponse,
  CourseSkipTest,
  DialogueAnswerResponse,
  DialogueDetail,
  DialogueListResponse,
  DueCountResponse,
  LessonDetail,
  MistakeAnswerResponse,
  MistakesResponse,
  ProfileResponse,
  ReviewResponse,
  VocabularyResponse,
  WritingCheckResponse,
  WritingResponse,
} from '@ciaocorea/shared';
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDb, todayIso, type Db } from './db/client';
import { streakDays, studyDaysSince } from './repo/progress';
import { saveWritingEntry } from './repo/writing';
import { ensureSeedUser } from './seed/bootstrap';

const EMAIL = 'blast@example.test';
const PASSWORD = '2fa74lovz';

let tmpDir: string;
let db: Db;
let app: FastifyInstance;

async function login(email = EMAIL, password = PASSWORD): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies[0];
  expect(cookie?.name).toBe('cc_session');
  expect(cookie?.httpOnly).toBe(true);
  return `cc_session=${cookie?.value ?? ''}`;
}

function coursePayload(body: string): CourseListResponse {
  return JSON.parse(body) as CourseListResponse;
}

/**
 * Chiude una lezione rispondendo bene: le soluzioni si prendono dal curricolo,
 * perché il client non le riceve mai. Serve per arrivare a lezioni che stanno
 * più avanti nel percorso (sblocco, dialoghi collegati).
 */
async function passLesson(cookie: string, slug: string, lessonId: string): Promise<void> {
  const course = getCourse(slug);
  const lesson = course ? findLesson(course, lessonId) : undefined;
  expect(lesson, `lezione ${lessonId}`).toBeDefined();

  const answers = (lesson?.exercises ?? []).map((exercise) => ({
    exerciseId: exercise.id,
    response: (exercise as { answer: string }).answer,
  }));

  const response = await app.inject({
    method: 'POST',
    url: `/api/courses/${slug}/lessons/${lessonId}/attempts`,
    headers: { cookie },
    payload: { mode: 'lesson', answers, durationMs: 60000 },
  });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { attempt: { passed: boolean; score: number } };
  expect(body.attempt.passed, `${lessonId} promossa?`).toBe(true);
}

/**
 * Un tentativo di lezione con le prime `wrong` risposte sbagliate apposta. Le
 * soluzioni delle altre arrivano dal curricolo: serve a riempire la banca degli
 * errori senza dover indovinare quali domande cadono.
 */
async function attemptWithWrong(
  cookie: string,
  slug: string,
  lessonId: string,
  wrong: number,
): Promise<string[]> {
  const course = getCourse(slug);
  const lesson = course ? findLesson(course, lessonId) : undefined;
  expect(lesson, `lezione ${lessonId}`).toBeDefined();

  const exercises = lesson?.exercises ?? [];
  const wrongIds = exercises.slice(0, wrong).map((exercise) => exercise.id);
  const answers = exercises.map((exercise) => ({
    exerciseId: exercise.id,
    response: wrongIds.includes(exercise.id) ? 'risposta-sbagliata' : exercise.answer,
  }));

  const response = await app.inject({
    method: 'POST',
    url: `/api/courses/${slug}/lessons/${lessonId}/attempts`,
    headers: { cookie },
    payload: { mode: 'lesson', answers, durationMs: 30000 },
  });
  expect(response.statusCode).toBe(200);
  return wrongIds;
}

/**
 * Salta un corso intero rispondendo bene a tutte le domande del test: come per
 * le lezioni, le soluzioni arrivano dal curricolo e non dal server.
 */
async function passCourseSkip(cookie: string, slug: string): Promise<CourseSkipResponse> {
  const test = await app.inject({
    method: 'GET',
    url: `/api/courses/${slug}/skip-test`,
    headers: { cookie },
  });
  expect(test.statusCode, `test di salto per ${slug}`).toBe(200);
  const body = test.json() as CourseSkipTest;

  const course = getCourse(slug);
  const answers = new Map<string, string>();
  for (const lesson of course ? courseLessons(course) : []) {
    for (const exercise of lesson.exercises) answers.set(exercise.id, exercise.answer);
  }

  const response = await app.inject({
    method: 'POST',
    url: `/api/courses/${slug}/skip`,
    headers: { cookie },
    payload: {
      answers: body.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        response: answers.get(exercise.id) ?? '',
      })),
      durationMs: 60000,
    },
  });
  expect(response.statusCode).toBe(200);
  const skipped = response.json() as CourseSkipResponse;
  expect(skipped.attempt.passed, `salto di ${slug} promosso?`).toBe(true);
  return skipped;
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciaocorea-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: tmpDir,
    WEB_DIST: path.join(tmpDir, 'web-dist-assente'),
    SESSION_DAYS: '30',
  });
  db = openDb(config.databaseFile);
  await ensureSeedUser(db, { email: EMAIL, password: PASSWORD, displayName: 'Blast' });
  app = await buildApp({ db, config });
});

afterEach(async () => {
  await app.close();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('health e accesso', () => {
  it('espone /api/health senza autenticazione', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: 'ciaocorea' });
  });

  it('rifiuta i corsi senza sessione', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/courses' });
    expect(response.statusCode).toBe(401);
  });

  it('tiene le iscrizioni chiuse di default, con la rotta già pronta', async () => {
    const info = await app.inject({ method: 'GET', url: '/api/auth/registration' });
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ mode: 'closed', closed: true, needsCode: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Anna', email: 'anna@example.test', password: 'sopralatavola' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'registration_closed' });
  });

  it('accetta la password iniziale e restituisce lo studente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL.toUpperCase(), password: PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { email: EMAIL, displayName: 'Blast' } });
  });

  it('rifiuta credenziali sbagliate senza distinguere email inesistente', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL, password: 'sbagliata' },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nessuno@example.test', password: 'sbagliata' },
    });

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it('blocca dopo troppi tentativi', async () => {
    let last = 0;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: EMAIL, password: 'sbagliata' },
      });
      last = response.statusCode;
    }
    expect(last).toBe(429);
  });

  it('logout invalida la sessione', async () => {
    const cookie = await login();
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });
});

describe('curricolo e progresso', () => {
  it('elenca i corsi con la prima lezione aperta e nessuna soluzione', async () => {
    const cookie = await login();
    const response = await app.inject({ method: 'GET', url: '/api/courses', headers: { cookie } });
    expect(response.statusCode).toBe(200);

    const payload = coursePayload(response.body);
    const course = payload.courses[0];
    expect(course?.slug).toBe('hangul');
    expect(course?.stats).toEqual({ lessons: 8, passed: 0, skipped: 0, percent: 0 });
    expect(course?.units[0]?.lessons[0]?.state).toBe('available');
    expect(course?.units[0]?.lessons[1]?.state).toBe('locked');
    expect(payload.summary.nextLesson?.lessonId).toBe('hangul-01');

    const serialized = response.body;
    expect(serialized).not.toContain('"answer"');
    expect(serialized).not.toContain('"exercises"');
  });

  it('serve gli esercizi senza la soluzione', async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'GET',
      url: '/api/courses/hangul/lessons/hangul-01',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);

    const detail = response.json() as LessonDetail;
    expect(detail.exercises.length).toBeGreaterThanOrEqual(4);
    expect(detail.skipTest.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(detail)).not.toContain('"answer"');
    expect(detail.lesson.vocab.length).toBeGreaterThan(0);
  });

  it('blocca le lezioni non ancora sbloccate', async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'GET',
      url: '/api/courses/hangul/lessons/hangul-05',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'lesson_locked' });
  });

  it('corregge sul server, promuove e sblocca la lezione successiva', async () => {
    const cookie = await login();
    const course = getCourse('hangul');
    const lesson = course?.units[0]?.lessons[0];
    expect(lesson).toBeDefined();

    const answers = (lesson?.exercises ?? []).map((exercise) => ({
      exerciseId: exercise.id,
      response: exercise.answer,
    }));

    // Punteggio inventato dal client: deve essere ignorato, conta la correzione.
    const response = await app.inject({
      method: 'POST',
      url: '/api/courses/hangul/lessons/hangul-01/attempts',
      headers: { cookie },
      payload: { mode: 'lesson', answers, score: 0, durationMs: 120000 },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      attempt: { score: number; passed: boolean; results: unknown[] };
      course: { stats: { passed: number }; units: Array<{ lessons: Array<{ id: string; state: string }> }> };
    };
    expect(body.attempt.score).toBe(100);
    expect(body.attempt.passed).toBe(true);
    expect(body.course.stats.passed).toBe(1);
    expect(body.course.units[0]?.lessons[1]?.state).toBe('available');
  });

  it('una prova senza risposte non chiude la lezione', async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/api/courses/hangul/lessons/hangul-01/attempts',
      headers: { cookie },
      payload: { mode: 'lesson', answers: [] },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      attempt: { score: number; passed: boolean };
      course: { units: Array<{ lessons: Array<{ id: string; state: string }> }> };
    };
    expect(body.attempt.passed).toBe(false);
    expect(body.course.units[0]?.lessons[0]?.state).toBe('in_progress');
    expect(body.course.units[0]?.lessons[1]?.state).toBe('locked');
  });

  it('il test di salto chiude la lezione come "saltata" solo sopra soglia', async () => {
    const cookie = await login();
    const course = getCourse('hangul');
    const lesson = course?.units[0]?.lessons[0];
    const skipAnswers = (lesson?.exercises ?? []).slice(0, 2).map((exercise) => ({
      exerciseId: exercise.id,
      response: exercise.answer,
    }));

    const failed = await app.inject({
      method: 'POST',
      url: '/api/courses/hangul/lessons/hangul-01/attempts',
      headers: { cookie },
      payload: { mode: 'skip', answers: skipAnswers },
    });
    const failedBody = failed.json() as { attempt: { passed: boolean }; course: { units: Array<{ lessons: Array<{ state: string }> }> } };
    expect(failedBody.attempt.passed).toBe(false);
    expect(failedBody.course.units[0]?.lessons[0]?.state).toBe('in_progress');
  });

  it('protegge i ripassi e non inventa card', async () => {
    const cookie = await login();
    const review = await app.inject({ method: 'GET', url: '/api/review', headers: { cookie } });
    expect(review.statusCode).toBe(200);
    expect(review.json()).toEqual({ cards: [], dueCards: 0 });

    const grade = await app.inject({
      method: 'POST',
      url: '/api/review/card-inesistente',
      headers: { cookie },
      payload: { grade: 1 },
    });
    expect(grade.statusCode).toBe(404);
  });
});

describe('conversazione', () => {
  const ANSWER_URL = '/api/dialogues/primo-incontro/answer';

  async function detail(cookie: string): Promise<DialogueDetail> {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dialogues/primo-incontro',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as DialogueDetail;
  }

  it('richiede la sessione', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/dialogues' });
    expect(response.statusCode).toBe(401);
  });

  it('elenca i dialoghi con il numero di battute', async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'GET',
      url: '/api/dialogues',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as DialogueListResponse;
    expect(body.dialogues.length).toBeGreaterThanOrEqual(3);
    expect(body.dialogues[0]).toMatchObject({ answered: 0, completed: false });
    expect(body.dialogues[0]?.totalTurns).toBeGreaterThan(2);
  });

  it('non manda al client il coreano delle battute non ancora recitate', async () => {
    const cookie = await login();
    const dialogue = getDialogue('primo-incontro');
    const hidden = dialogue?.turns.find((turn) => turn.id === 's-2');
    expect(hidden).toBeDefined();

    const body = await detail(cookie);
    const turn = body.turns.find((item) => item.id === 's-2');
    expect(turn?.ko).toBeNull();
    // La consegna italiana resta: serve a sapere cosa dire.
    expect(turn?.it).toBe(hidden?.it);
    expect(JSON.stringify(body)).not.toContain(hidden?.ko ?? '###');
  });

  it('dopo due errori rivela la forma senza far avanzare', async () => {
    const cookie = await login();

    const first = await app.inject({
      method: 'POST',
      url: ANSWER_URL,
      headers: { cookie },
      payload: { response: '안녕히 계세요' },
    });
    const one = first.json() as DialogueAnswerResponse;
    expect(one.correct).toBe(false);
    expect(one.expected).toBeNull();
    expect(one.turnIndex).toBe(0);

    const second = await app.inject({
      method: 'POST',
      url: ANSWER_URL,
      headers: { cookie },
      payload: { response: '잘 먹겠습니다' },
    });
    const two = second.json() as DialogueAnswerResponse;
    expect(two.correct).toBe(false);
    expect(two.expected).toBe('안녕하세요.');
    expect(two.wrong).toBe(2);
    expect(two.turnIndex).toBe(0);

    expect((await detail(cookie)).turnIndex).toBe(0);
  });

  it('completa il dialogo e mette le frasi nei ripassi', async () => {
    const cookie = await login();
    const dialogue = getDialogue('primo-incontro');
    const answers = dialogue?.turns.filter((turn) => turn.answer) ?? [];
    expect(answers.length).toBeGreaterThanOrEqual(3);

    for (const turn of answers) {
      const response = await app.inject({
        method: 'POST',
        url: ANSWER_URL,
        headers: { cookie },
        payload: { response: turn.ko },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ correct: true });
    }

    const finished = await detail(cookie);
    expect(finished.dialogue.completed).toBe(true);
    expect(finished.dialogue.correct).toBe(answers.length);
    expect(finished.turnIndex).toBe(dialogue?.turns.length);

    const review = await app.inject({ method: 'GET', url: '/api/review', headers: { cookie } });
    const body = review.json() as ReviewResponse;
    expect(body.dueCards).toBeGreaterThanOrEqual(dialogue?.turns.length ?? 0);

    const restart = await app.inject({
      method: 'POST',
      url: '/api/dialogues/primo-incontro/restart',
      headers: { cookie },
    });
    expect(restart.statusCode).toBe(200);
    const clean = restart.json() as DialogueDetail;
    expect(clean.turnIndex).toBe(0);
    expect(clean.dialogue).toMatchObject({ completed: false, answered: 0, correct: 0 });
  });

  it('rifiuta una battuta di un dialogo inesistente', async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/api/dialogues/non-esiste/answer',
      headers: { cookie },
      payload: { response: '안녕하세요' },
    });
    expect(response.statusCode).toBe(404);
  });
});

/* ------------------------------------------------------------------------- *
 * Dizionario, progressi, cambio password, dialoghi legati al percorso.
 * ------------------------------------------------------------------------- */

describe('dizionario', () => {
  it('richiede la sessione', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/vocabulary' });
    expect(response.statusCode).toBe(401);
  });

  it('trova una voce per coreano, per romanizzazione e per italiano', async () => {
    const cookie = await login();
    const probe = getVocabulary()[0];
    expect(probe).toBeDefined();

    for (const term of [probe?.ko ?? '', probe?.rr ?? '', probe?.it ?? '']) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/vocabulary?q=${encodeURIComponent(term)}`,
        headers: { cookie },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as VocabularyResponse;
      expect(body.entries.some((entry) => entry.ko === probe?.ko), `term=${term}`).toBe(true);
      expect(body.query).toBe(term);
    }
  });

  it('porta ogni voce con il corso e la lezione da cui viene', async () => {
    const cookie = await login();
    const response = await app.inject({ method: 'GET', url: '/api/vocabulary?limit=5', headers: { cookie } });
    expect(response.statusCode).toBe(200);

    const body = response.json() as VocabularyResponse;
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.curriculum).toBeGreaterThanOrEqual(body.entries.length);

    for (const entry of body.entries) {
      expect(entry.ko.length).toBeGreaterThan(0);
      expect(entry.it.length).toBeGreaterThan(0);
      expect(entry.rr.length).toBeGreaterThan(0);
      expect(entry.courseSlug).toBeTruthy();
      expect(entry.courseTitle).toBeTruthy();
      expect(entry.lessonId).toBeTruthy();
      expect(entry.lessonTitle).toBeTruthy();
    }
  });

  it('filtra per corso e i contaggi tornano con i risultati', async () => {
    const cookie = await login();
    const probe = getVocabulary()[0];
    const response = await app.inject({
      method: 'GET',
      url: `/api/vocabulary?course=${probe?.courseSlug}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as VocabularyResponse;
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.entries.every((entry) => entry.courseSlug === probe?.courseSlug)).toBe(true);

    const facets = new Map(body.courses.map((course) => [course.slug, course.count]));
    expect(facets.get(probe?.courseSlug ?? '')).toBe(body.total);
    expect(body.courses.reduce((sum, course) => sum + course.count, 0)).toBe(body.curriculum);
  });

  it('cerca anche le parole che compaiono solo nei brani di lettura', async () => {
    const cookie = await login();

    // Una parola che il gloss di un brano insegna ma che nessuna lezione porta
    // nel proprio elenco di vocaboli: è il caso del dizionario, perché è la
    // parola che si incontra leggendo e non si ricorda più.
    const courses = getCourses();
    const known = new Set<string>();
    for (const course of courses) {
      for (const lesson of courseLessons(course)) {
        for (const item of lesson.vocab) known.add(`${course.slug}\u0000${item.ko}`);
      }
    }

    let extra: { ko: string; courseSlug: string } | null = null;
    for (const course of courses) {
      for (const lesson of courseLessons(course)) {
        for (const passage of lesson.passages ?? []) {
          for (const item of passage.gloss) {
            if (!known.has(`${course.slug}\u0000${item.ko}`)) {
              extra = { ko: item.ko, courseSlug: course.slug };
              break;
            }
          }
          if (extra) break;
        }
        if (extra) break;
      }
      if (extra) break;
    }

    expect(extra, 'il curricolo deve avere parole viste solo nei brani').not.toBeNull();

    const response = await app.inject({
      method: 'GET',
      url: `/api/vocabulary?q=${encodeURIComponent(extra?.ko ?? '')}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as VocabularyResponse;
    const hit = body.entries.find((entry) => entry.ko === extra?.ko);
    expect(hit, `parola ${extra?.ko} cercata`).toBeDefined();
    expect(hit?.courseSlug).toBe(extra?.courseSlug);
    expect(hit?.lessonId.length).toBeGreaterThan(0);
  });

  it('una ricerca senza risultati non è un errore', async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'GET',
      url: '/api/vocabulary?q=zzzz-inesistente',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as VocabularyResponse;
    expect(body.total).toBe(0);
    expect(body.entries).toEqual([]);
  });
});

describe('progressi', () => {
  it('racconta corsi, ripassi, dialoghi e abitudine quotidiana', async () => {
    const cookie = await login();
    await passLesson(cookie, 'hangul', 'hangul-01');

    const response = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    expect(response.statusCode).toBe(200);

    const body = response.json() as ProfileResponse;
    expect(body.user.email).toBe(EMAIL);
    expect(Number.isNaN(Date.parse(body.memberSince))).toBe(false);

    expect(body.summary.lessonsPassed).toBe(1);
    expect(body.summary.lessonsTotal).toBeGreaterThanOrEqual(20);
    expect(body.summary.streakDays).toBe(1);
    expect(body.summary.nextLesson?.lessonId).toBe('hangul-02');

    expect(body.totals.exercises).toBeGreaterThanOrEqual(4);
    expect(body.totals.accuracy).toBe(100);

    const hangul = body.courses.find((course) => course.slug === 'hangul');
    expect(hangul?.stats.passed).toBe(1);
    expect(body.courses.length).toBeGreaterThanOrEqual(4);

    expect(body.srs.cards).toBeGreaterThanOrEqual(1);
    expect(body.srs.words).toBeGreaterThanOrEqual(1);
    expect(body.vocabulary.seen).toBeGreaterThanOrEqual(1);
    expect(body.vocabulary.seen).toBeLessThanOrEqual(body.vocabulary.total);

    expect(body.activity).toHaveLength(1);
    expect(body.activity[0]?.exercises).toBeGreaterThanOrEqual(4);

    expect(body.dialogues.total).toBeGreaterThanOrEqual(3);
    expect(body.dialogues.completed).toBe(0);
  });

  it('restituisce zeri a uno studente che non ha ancora studiato', async () => {
    const cookie = await login();
    const response = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    const body = response.json() as ProfileResponse;

    expect(body.summary.lessonsPassed).toBe(0);
    expect(body.summary.streakDays).toBe(0);
    expect(body.totals.exercises).toBe(0);
    expect(body.totals.accuracy).toBe(0);
    expect(body.srs.cards).toBe(0);
    expect(body.activity).toEqual([]);
  });
});

describe('cambio password', () => {
  it('chiede la password attuale e chiude le altre sessioni', async () => {
    const current = await login();
    const other = await login();
    const NEXT = 'nuova-password-2026';

    const anon = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      payload: { current: PASSWORD, next: NEXT },
    });
    expect(anon.statusCode).toBe(401);

    const short = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: current },
      payload: { current: PASSWORD, next: 'corta' },
    });
    expect(short.statusCode).toBe(400);

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: current },
      payload: { current: 'non-è-quella', next: NEXT },
    });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.json()).toMatchObject({ error: 'wrong_password' });

    const changed = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: current },
      payload: { current: PASSWORD, next: NEXT },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ ok: true, sessionsClosed: 1 });

    const oldPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL, password: PASSWORD },
    });
    expect(oldPassword.statusCode).toBe(401);

    const newPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL, password: NEXT },
    });
    expect(newPassword.statusCode).toBe(200);

    // La sessione che ha fatto il cambio resta in piedi, le altre cadono.
    const stale = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: other } });
    expect(stale.statusCode).toBe(401);
    const kept = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: current } });
    expect(kept.statusCode).toBe(200);
  });
});

describe('dialoghi legati al percorso', () => {
  it('blocca il dialogo finché non si chiude la lezione di riferimento', async () => {
    const cookie = await login();

    const list = await app.inject({ method: 'GET', url: '/api/dialogues', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    const body = list.json() as DialogueListResponse;

    const caffe = body.dialogues.find((dialogue) => dialogue.slug === 'caffe');
    const primo = body.dialogues.find((dialogue) => dialogue.slug === 'primo-incontro');
    expect(caffe?.after?.courseSlug).toBe('lessico');
    expect(caffe?.locked).toBe(true);
    // Il primo dialogo non ha prerequisiti: si può fare subito.
    expect(primo?.after).toBeNull();
    expect(primo?.locked).toBe(false);

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/dialogues/caffe/answer',
      headers: { cookie },
      payload: { response: '아이스 아메리카노 주세요' },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ error: 'dialogue_locked' });

    // Si arriva a less-03 chiudendo le lezioni che la aprono.
    await passLesson(cookie, 'lessico', 'less-01');
    await passLesson(cookie, 'lessico', 'less-02');
    await passLesson(cookie, 'lessico', 'less-03');

    const unlocked = await app.inject({ method: 'GET', url: '/api/dialogues', headers: { cookie } });
    const after = (unlocked.json() as DialogueListResponse).dialogues.find(
      (dialogue) => dialogue.slug === 'caffe',
    );
    expect(after?.locked).toBe(false);

    const dialogue = getDialogue('caffe');
    const firstTurn = dialogue?.turns.find((turn) => turn.answer);
    expect(firstTurn).toBeDefined();

    const answered = await app.inject({
      method: 'POST',
      url: '/api/dialogues/caffe/answer',
      headers: { cookie },
      payload: { response: firstTurn?.ko ?? '' },
    });
    expect(answered.statusCode).toBe(200);
    expect(answered.json()).toMatchObject({ correct: true });
  });
});

describe('brani di lettura', () => {
  it('porta il brano con il glossario, senza traduzione, finché la lezione è aperta', async () => {
    const cookie = await login();

    const response = await app.inject({
      method: 'GET',
      url: '/api/courses/b1/lessons/b1-01',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);

    const detail = response.json() as LessonDetail;
    expect(detail.lesson.kind).toBe('reading');

    const passages = detail.lesson.passages ?? [];
    expect(passages.length).toBeGreaterThan(0);

    const passage = passages[0];
    expect(passage).toBeDefined();
    expect(passage?.lines.length).toBeGreaterThan(1);
    expect(passage?.gloss.length).toBeGreaterThan(0);
    expect(passage?.gloss.some((item) => /[\uac00-\ud7a3]/.test(item.ko))).toBe(true);
    // La traduzione è l'ultima cosa che si vede: qui non c'è ancora.
    expect(passage?.translation).toBe('');
  });

  it('restituisce la traduzione quando la lezione è superata', async () => {
    const cookie = await login();
    await passLesson(cookie, 'b1', 'b1-01');

    const response = await app.inject({
      method: 'GET',
      url: '/api/courses/b1/lessons/b1-01',
      headers: { cookie },
    });
    const detail = response.json() as LessonDetail;

    expect(detail.lesson.state).toBe('passed');
    const translation = detail.lesson.passages?.[0]?.translation ?? '';
    expect(translation.length).toBeGreaterThan(10);
  });

  it("apre il dialogo dell'ufficio solo dopo la lezione di lettura giusta", async () => {
    const cookie = await login();

    const before = await app.inject({ method: 'GET', url: '/api/dialogues', headers: { cookie } });
    const ufficio = (before.json() as DialogueListResponse).dialogues.find(
      (dialogue) => dialogue.slug === 'ufficio',
    );
    expect(ufficio?.after).toMatchObject({ courseSlug: 'b1', lessonId: 'b1-03' });
    expect(ufficio?.locked).toBe(true);

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/dialogues/ufficio/answer',
      headers: { cookie },
      payload: { response: '네, 괜찮아요.' },
    });
    expect(blocked.statusCode).toBe(409);

    await passLesson(cookie, 'b1', 'b1-01');
    await passLesson(cookie, 'b1', 'b1-02');
    await passLesson(cookie, 'b1', 'b1-03');

    const after = await app.inject({ method: 'GET', url: '/api/dialogues', headers: { cookie } });
    const unlocked = (after.json() as DialogueListResponse).dialogues.find(
      (dialogue) => dialogue.slug === 'ufficio',
    );
    expect(unlocked?.locked).toBe(false);
  });
});

describe('piano di studio', () => {
  it('ordina la giornata: prima la lezione, poi i ripassi in scadenza', async () => {
    const cookie = await login();

    const vuoto = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    expect(vuoto.statusCode).toBe(200);
    const vuotoBody = vuoto.json() as CourseListResponse;
    const piano = vuotoBody.plan;

    // Nessuno studio ancora: il piano c'è, la settimana no.
    expect(piano.goal).toBe(5);
    expect(piano.daysStudied).toBe(0);
    expect(piano.goalMet).toBe(false);
    expect(piano.streakDays).toBe(0);
    expect(piano.weekStart <= piano.day).toBe(true);
    expect(piano.daysLeft).toBeGreaterThanOrEqual(1);
    // Senza carte in scadenza c'è posto anche per un dialogo.
    expect(piano.tasks.map((task) => task.key)).toEqual(['lesson', 'dialogue']);
    expect(piano.tasks[0]?.key).toBe('lesson');
    expect(piano.tasks[0]?.href).toBe(
      `/corso/${vuotoBody.summary.nextLesson?.courseSlug}/lezione/${vuotoBody.summary.nextLesson?.lessonId}`,
    );
    expect(piano.note).toContain('0 giorni su 5');

    await passLesson(cookie, 'hangul', 'hangul-01');

    const dopo = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    const dopoBody = dopo.json() as CourseListResponse;
    const studiato = dopoBody.plan;

    expect(studiato.daysStudied).toBe(1);
    expect(studiato.streakDays).toBe(1);
    expect(studiato.goalMet).toBe(false);
    // Lezione nuova prima, ripasso dopo: la parola si rivede, il percorso avanza.
    expect(studiato.tasks.map((task) => task.key)).toEqual(['lesson', 'reviews']);
    expect(studiato.tasks[1]?.detail).toMatch(/parol/);
    expect(dopoBody.dueCards).toBeGreaterThan(0);
    // Il titolo del corso sta nel dettaglio, così si capisce dove si va a finire.
    expect(studiato.tasks[0]?.detail).toContain(' · ');
  });

  it('mette un dialogo quando non c’è nulla da ripassare', async () => {
    const cookie = await login();

    // Nessun card creata: le uniche cose da fare sono una lezione e un dialogo.
    const response = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    const body = response.json() as CourseListResponse;
    expect(body.dueCards).toBe(0);
    expect(body.plan.tasks.map((task) => task.key)).toEqual(['lesson', 'dialogue']);
    expect(body.plan.tasks[1]?.href.startsWith('/dialoghi/')).toBe(true);
  });

  it('tiene aggiornato il solo conteggio dei ripassi per la shell', async () => {
    const cookie = await login();

    const anonimo = await app.inject({ method: 'GET', url: '/api/progress/due' });
    expect(anonimo.statusCode).toBe(401);

    const vuoto = await app.inject({ method: 'GET', url: '/api/progress/due', headers: { cookie } });
    expect(vuoto.statusCode).toBe(200);
    // Il badge chiede una cifra: niente carte, niente elenco.
    expect(vuoto.json()).toEqual({ dueCards: 0, mistakes: 0 });

    await passLesson(cookie, 'hangul', 'hangul-01');

    const dopo = await app.inject({ method: 'GET', url: '/api/progress/due', headers: { cookie } });
    expect((dopo.json() as DueCountResponse).dueCards).toBeGreaterThan(0);
  });

  it('un corso saltato è studio a tutti gli effetti: la settimana lo conta', async () => {
    const cookie = await login();

    const prima = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    const primaBody = prima.json() as CourseListResponse;
    expect(primaBody.plan.daysStudied).toBe(0);
    expect(primaBody.dueCards).toBe(0);

    const saltato = await passCourseSkip(cookie, 'messaggi');
    expect(saltato.lessonsSkipped).toBe(5);
    // Chi salta non perde il lessico: entra tutto nei ripassi.
    expect(saltato.reviewsCreated).toBeGreaterThan(0);

    const dopo = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    const dopoBody = dopo.json() as CourseListResponse;

    // Il giorno della prova vale come giorno di studio, come una lezione.
    expect(dopoBody.plan.daysStudied).toBe(1);
    expect(dopoBody.plan.streakDays).toBe(1);
    expect(dopoBody.dueCards).toBe(saltato.reviewsCreated);

    // Con i ripassi in scadenza il dialogo lascia il posto alla ripetizione.
    expect(dopoBody.plan.tasks.map((task) => task.key)).toEqual(['lesson', 'reviews']);

    // Il corso saltato resta nel percorso, chiuso ma visibile.
    const messaggi = dopoBody.courses.find((course) => course.slug === 'messaggi');
    expect(messaggi?.stats.skipped).toBe(5);
    expect(messaggi?.stats.lessons).toBe(5);

    // Saltato il corso, il percorso propone la lezione successiva, non una sua.
    expect(dopoBody.summary.nextLesson?.courseSlug).not.toBe('messaggi');
  });

  it('conta il ripasso come giorno di studio', async () => {
    const cookie = await login();
    await passLesson(cookie, 'hangul', 'hangul-01');

    const review = await app.inject({ method: 'GET', url: '/api/review', headers: { cookie } });
    const cards = (review.json() as ReviewResponse).cards;
    expect(cards.length).toBeGreaterThan(0);

    const graded = await app.inject({
      method: 'POST',
      url: `/api/review/${cards[0]?.id}`,
      headers: { cookie },
      payload: { grade: 2 },
    });
    expect(graded.statusCode).toBe(200);

    const profile = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    const body = profile.json() as ProfileResponse;
    expect(body.activity).toHaveLength(1);
    expect(body.activity[0]?.reviews).toBeGreaterThanOrEqual(1);
  });

  it('lascia scegliere allo studente l’obiettivo della settimana', async () => {
    const cookie = await login();

    const anonimo = await app.inject({ method: 'POST', url: '/api/profile/goal', payload: { goal: 3 } });
    expect(anonimo.statusCode).toBe(401);

    const accettato = await app.inject({
      method: 'POST',
      url: '/api/profile/goal',
      headers: { cookie },
      payload: { goal: 3 },
    });
    expect(accettato.statusCode).toBe(200);
    expect(accettato.json()).toMatchObject({ weeklyGoal: 3 });

    const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    expect((dashboard.json() as CourseListResponse).plan.goal).toBe(3);

    const profilo = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    expect((profilo.json() as ProfileResponse).weeklyGoal).toBe(3);

    for (const goal of [0, 8, 2.5, 'tre', null]) {
      const rifiutato = await app.inject({
        method: 'POST',
        url: '/api/profile/goal',
        headers: { cookie },
        payload: { goal },
      });
      expect(rifiutato.statusCode, `goal ${String(goal)}`).toBe(400);
      expect(rifiutato.json()).toMatchObject({ error: 'invalid_goal' });
    }
  });
});

describe('quaderno di scrittura', () => {
  it('richiede la sessione', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/writing' });
    expect(response.statusCode).toBe(401);
  });

  it('parte chiuso e non manda la forma giusta al client', async () => {
    const cookie = await login();
    const response = await app.inject({ method: 'GET', url: '/api/writing', headers: { cookie } });
    expect(response.statusCode).toBe(200);

    const body = response.json() as WritingResponse;
    expect(body.prompts).toHaveLength(getWritingPrompts().length);
    expect(body.stats).toEqual({ done: 0, total: getWritingPrompts().length, unlocked: 0 });
    expect(body.prompts.every((prompt) => prompt.unlocked === false)).toBe(true);

    // Il modello è la risposta: uscire adesso vorrebbe dire dettato, non scrittura.
    expect(response.body).not.toContain('저는 학생이에요');

    const locked = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: { text: '저는 학생이에요.' },
    });
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toMatchObject({ error: 'writing_locked' });
  });

  it('dopo la lezione la consegna si apre e la forma esatta vale "model"', async () => {
    const cookie = await login();
    await passLesson(cookie, 'grammatica', 'gram-01');

    const list = await app.inject({ method: 'GET', url: '/api/writing', headers: { cookie } });
    const body = list.json() as WritingResponse;
    const prompt = body.prompts.find((item) => item.id === 'w-gram-01');
    expect(prompt?.unlocked).toBe(true);
    expect(prompt?.courseTitle).toBe(getCourse('grammatica')?.title);
    expect(prompt?.last).toBeNull();
    // Il corso ha due consegne: solo quella della lezione chiusa si apre.
    expect(body.stats.unlocked).toBe(1);

    const written = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: { text: '저는 학생이에요.' },
    });
    expect(written.statusCode).toBe(200);

    const result = written.json() as WritingCheckResponse;
    expect(result.check.verdict).toBe('model');
    expect(result.check.missing).toEqual([]);
    expect(result.check.similarity).toBe(1);
    expect(result.check.model).toBe('저는 학생이에요.');
    expect(result.entry.text).toBe('저는 학생이에요.');
    expect(result.stats.done).toBe(1);

    const again = await app.inject({ method: 'GET', url: '/api/writing', headers: { cookie } });
    const dopo = again.json() as WritingResponse;
    expect(dopo.prompts.find((item) => item.id === 'w-gram-01')?.last?.verdict).toBe('model');
    expect(dopo.stats.done).toBe(1);
  });

  it('accetta le varianti e dice che cosa manca quando la frase è un’altra', async () => {
    const cookie = await login();
    await passLesson(cookie, 'grammatica', 'gram-01');

    const variante = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: { text: '학생이에요.' },
    });
    expect((variante.json() as WritingCheckResponse).check.verdict).toBe('model');

    const sbagliata = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: { text: '저는 선생님이에요.' },
    });
    expect(sbagliata.statusCode).toBe(200);
    const check = (sbagliata.json() as WritingCheckResponse).check;
    expect(check.verdict).toBe('far');
    expect(check.missing).toContain('학생');
    expect(check.similarity).toBeGreaterThan(0);
    expect(check.similarity).toBeLessThan(1);
  });

  it('una sillaba sbagliata resta vicina, senza dire che è giusta', async () => {
    const cookie = await login();
    await passLesson(cookie, 'grammatica', 'gram-01');

    const response = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: { text: '저는 학생이어요.' },
    });
    expect(response.statusCode).toBe(200);

    const check = (response.json() as WritingCheckResponse).check;
    expect(check.verdict).toBe('close');
    expect(check.missing).toEqual([]);
    expect(check.similarity).toBeGreaterThan(0.8);
    expect(check.similarity).toBeLessThan(1);
  });

  it('rifiuta una consegna inesistente e un testo vuoto', async () => {
    const cookie = await login();

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/writing/w-non-esiste',
      headers: { cookie },
      payload: { text: '바다' },
    });
    expect(unknown.statusCode).toBe(404);

    await passLesson(cookie, 'grammatica', 'gram-01');

    const empty = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: { text: '   ' },
    });
    expect(empty.statusCode).toBe(400);
    expect(empty.json()).toMatchObject({ error: 'empty_text' });

    const noBody = await app.inject({
      method: 'POST',
      url: '/api/writing/w-gram-01',
      headers: { cookie },
      payload: {},
    });
    expect(noBody.statusCode).toBe(400);
  });

  it('scrivere è una giornata di studio anche senza esercizi', async () => {
    const cookie = await login();
    const profile = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    const userId = (profile.json() as ProfileResponse).user.id;

    saveWritingEntry(db, {
      userId,
      promptId: 'w-hangul-02',
      courseSlug: 'hangul',
      text: '바다',
      verdict: 'model',
    });

    const day = todayIso();
    expect(streakDays(db, userId)).toBe(1);
    expect(studyDaysSince(db, userId, day)).toEqual([day]);

    const dopo = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    const body = dopo.json() as ProfileResponse;
    expect(body.activity).toHaveLength(1);
    expect(body.activity[0]?.writing).toBe(1);
    expect(body.activity[0]?.exercises).toBe(0);
    expect(body.summary.streakDays).toBe(1);

    const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });
    expect(coursePayload(dashboard.body).plan.daysStudied).toBe(1);
  });
});

describe('banca degli errori', () => {
  it('chiede la sessione', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/mistakes' });
    expect(response.statusCode).toBe(401);
  });

  it('un errore di lezione entra in banca, senza portarsi dietro la soluzione', async () => {
    const cookie = await login();
    const [wrongId] = await attemptWithWrong(cookie, 'hangul', 'hangul-01', 1);

    const response = await app.inject({ method: 'GET', url: '/api/mistakes', headers: { cookie } });
    expect(response.statusCode).toBe(200);

    const body = response.json() as MistakesResponse;
    expect(body.stats).toEqual({ total: 1, lessons: 1 });
    expect(body.items[0]?.exercise.id).toBe(wrongId);
    expect(body.items[0]?.wrongCount).toBe(1);
    expect(body.items[0]?.courseTitle).toBeTruthy();
    expect(body.items[0]?.lessonTitle).toBeTruthy();

    // L'esercizio torna com'era nella lezione, cioè senza risposta: la
    // correzione avviene sul server anche qui.
    expect(response.body).not.toContain('"answer"');
    expect(response.body).not.toContain('"accept"');
  });

  it('sbagliarlo di nuovo alza il conto, azzeccarlo lo toglie dalla banca', async () => {
    const cookie = await login();
    const [wrongId] = await attemptWithWrong(cookie, 'hangul', 'hangul-01', 1);
    const found = findExercise(wrongId ?? '');
    expect(found).toBeDefined();

    const again = await app.inject({
      method: 'POST',
      url: `/api/mistakes/${wrongId}`,
      headers: { cookie },
      payload: { response: 'ancora-sbagliata' },
    });
    expect(again.statusCode).toBe(200);
    const retry = again.json() as MistakeAnswerResponse;
    expect(retry.result.correct).toBe(false);
    expect(retry.wrongCount).toBe(2);
    expect(retry.result.expected).toBe(found?.exercise.answer);
    expect(retry.stats.total).toBe(1);

    const right = await app.inject({
      method: 'POST',
      url: `/api/mistakes/${wrongId}`,
      headers: { cookie },
      payload: { response: found?.exercise.answer ?? '' },
    });
    expect(right.statusCode).toBe(200);
    const fixed = right.json() as MistakeAnswerResponse;
    expect(fixed.result.correct).toBe(true);
    expect(fixed.wrongCount).toBeNull();
    expect(fixed.stats.total).toBe(0);

    const empty = await app.inject({ method: 'GET', url: '/api/mistakes', headers: { cookie } });
    expect((empty.json() as MistakesResponse).items).toEqual([]);
  });

  it('rifare gli errori è studiare e la sintesi lo racconta', async () => {
    const cookie = await login();
    const [wrongId] = await attemptWithWrong(cookie, 'hangul', 'hangul-01', 2);

    const before = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    const beforeBody = before.json() as ProfileResponse;
    expect(beforeBody.summary.mistakesOpen).toBe(2);

    const found = findExercise(wrongId ?? '');
    await app.inject({
      method: 'POST',
      url: `/api/mistakes/${wrongId}`,
      headers: { cookie },
      payload: { response: found?.exercise.answer ?? '' },
    });

    const after = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });
    const afterBody = after.json() as ProfileResponse;
    expect(afterBody.summary.mistakesOpen).toBe(1);
    // L'esercizio rifatto conta fra gli esercizi fatti, altrimenti una serata
    // passata a correggersi non farebbe avanzare l'abitudine.
    expect(afterBody.totals.exercises).toBe(beforeBody.totals.exercises + 1);
  });

  it('una lezione rifatta tutta bene svuota la banca', async () => {
    const cookie = await login();
    await attemptWithWrong(cookie, 'hangul', 'hangul-01', 1);

    await passLesson(cookie, 'hangul', 'hangul-01');

    const response = await app.inject({ method: 'GET', url: '/api/mistakes', headers: { cookie } });
    expect((response.json() as MistakesResponse).stats.total).toBe(0);
  });

  it('il test di salto non riempie la banca', async () => {
    const cookie = await login();
    const test = await app.inject({
      method: 'GET',
      url: '/api/courses/hangul/skip-test',
      headers: { cookie },
    });
    expect(test.statusCode).toBe(200);
    const body = test.json() as CourseSkipTest;

    const attempt = await app.inject({
      method: 'POST',
      url: '/api/courses/hangul/skip',
      headers: { cookie },
      payload: {
        answers: body.exercises.map((exercise) => ({
          exerciseId: exercise.id,
          response: 'risposta-sbagliata',
        })),
        durationMs: 20000,
      },
    });
    expect(attempt.statusCode).toBe(200);

    const mistakes = await app.inject({
      method: 'GET',
      url: '/api/mistakes',
      headers: { cookie },
    });
    expect((mistakes.json() as MistakesResponse).stats.total).toBe(0);
  });

  it("non si risponde a un esercizio che non è in banca", async () => {
    const cookie = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/api/mistakes/hangul-01-e1',
      headers: { cookie },
      payload: { response: 'ㄱ' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });
});
