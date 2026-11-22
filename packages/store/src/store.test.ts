import { beforeEach, describe, expect, it } from 'vitest';
import {
  courseLessons,
  findExercise,
  findLesson,
  getCourse,
  getVocabulary,
  getWritingPrompts,
} from '@ciaocorea/curriculum';
import { sampleResponse } from '@ciaocorea/engine';
import { USERNAME_MAX } from '@ciaocorea/shared';
import type {
  AttemptResponse,
  ChallengeResponse,
  ChallengeResultResponse,
  CourseListResponse,
  CourseSkipResponse,
  CourseSkipTest,
  CourseView,
  DialogueListResponse,
  DueCountResponse,
  LessonDetail,
  MistakesResponse,
  ProfileResponse,
  ReadingsResponse,
  ReviewCard,
  ReviewResponse,
  VocabularyResponse,
  WordLookupResponse,
  WritingCheckResponse,
  WritingResponse,
} from '@ciaocorea/shared';
import { openDb, todayIso } from './db/client';
import { createStore, type Store } from './store';
import type { AccountsResponse } from './types';

/**
 * Il vecchio server aveva una suite di integrazione che parlava HTTP: qui la
 * stessa sostanza passa da `store.call`, l'unico modo in cui il browser tocca
 * il database. Se questi test restano verdi, la logica portata nel pacchetto è
 * quella che girava dietro Fastify.
 */

import { USERNAME_SHAPE } from './auth/usernames';

let store: Store;

beforeEach(async () => {
  store = await createStore({ storage: 'memory' });
});

function lessonAnswers(
  slug: string,
  lessonId: string,
): Array<{ exerciseId: string; response: string }> {
  const course = getCourse(slug);
  const lesson = course ? findLesson(course, lessonId) : undefined;
  expect(lesson, `lezione ${lessonId}`).toBeDefined();
  return (lesson?.exercises ?? []).map((exercise) => ({
    exerciseId: exercise.id,
    response: sampleResponse(exercise),
  }));
}

async function passLesson(slug: string, lessonId: string): Promise<AttemptResponse> {
  return store.call<AttemptResponse>(
    'POST',
    `/api/courses/${slug}/lessons/${lessonId}/attempts`,
    { mode: 'lesson', answers: lessonAnswers(slug, lessonId), durationMs: 30_000 },
  );
}

async function reviewCards(): Promise<ReviewResponse> {
  return store.call<ReviewResponse>('GET', '/api/review');
}

/** Due letture e la carta torna oggi: è così che diventa una carta da scrivere. */
async function makeWritable(cardId: string): Promise<ReviewCard> {
  await store.call('POST', `/api/review/${cardId}`, { grade: 1 });
  await store.call('POST', `/api/review/${cardId}`, { grade: 1 });
  store.db.prepare('UPDATE srs_cards SET due_at = ? WHERE id = ?').run(todayIso(), cardId);
  const card = (await reviewCards()).cards.find((item) => item.id === cardId);
  expect(card, 'carta tornata in scadenza').toBeDefined();
  expect(card?.direction).toBe('write');
  return card as ReviewCard;
}

describe('profili nel browser', () => {
  it('al primo avvio nasce un profilo e ci si entra dentro', async () => {
    const user = await store.bootstrap();

    // Il nome è generato: aggettivo + animale + numero, come su Reddit.
    expect(user.username).toMatch(USERNAME_SHAPE);
    expect(user.usernameChosen).toBe(false);

    expect((await store.session())?.id).toBe(user.id);

    const body = await store.accounts();
    expect(body.currentUserId).toBe(user.id);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toMatchObject({ username: user.username, hasSession: true });
  });

  it('riaprire il sito riprende lo stesso profilo', async () => {
    const first = await store.bootstrap();
    const again = await store.bootstrap();

    expect(again.id).toBe(first.id);
    expect((await store.accounts()).accounts).toHaveLength(1);
  });

  it('tiene più profili e passa dall’uno all’altro con un clic', async () => {
    const blast = await store.bootstrap();
    const mina = await store.addProfile();

    // Aggiungere un profilo ha già cambiato quello aperto.
    expect((await store.session())?.id).toBe(mina.id);

    const body: AccountsResponse = await store.accounts();
    expect(body.accounts).toHaveLength(2);
    expect(new Set(body.accounts.map((account) => account.username)).size).toBe(2);
    expect(body.currentUserId).toBe(mina.id);

    const back = await store.switchUser(blast.id);
    expect(back?.id).toBe(blast.id);
    expect((await store.session())?.id).toBe(blast.id);
  });

  it('sostituisce il nome utente generato con uno scelto', async () => {
    const user = await store.bootstrap();
    expect(user.usernameChosen).toBe(false);

    const changed = await store.changeUsername('Blast');
    // Un nome solo: lo stesso che il portale usa per parlarti e quello
    // dell'elenco dei profili.
    expect(changed).toMatchObject({ id: user.id, username: 'Blast', usernameChosen: true });
    expect(await store.session()).toMatchObject({ username: 'Blast', usernameChosen: true });
    expect((await store.accounts()).accounts[0]?.username).toBe('Blast');
  });

  it('un nome utente scelto non si porta via quello di un altro profilo', async () => {
    const first = await store.bootstrap();
    const second = await store.addProfile();

    // `Marco` e `marco` si leggono uguali nell'elenco dei profili.
    await expect(store.changeUsername(first.username.toUpperCase())).rejects.toMatchObject({
      status: 409,
      code: 'username_taken',
    });

    expect((await store.session())?.username).toBe(second.username);
  });

  it('rifiuta i nomi utente fuori forma', async () => {
    await store.bootstrap();

    for (const bad of ['x', 'con spazio', '-inizio', 'a'.repeat(USERNAME_MAX + 1)]) {
      await expect(store.changeUsername(bad)).rejects.toMatchObject({
        status: 400,
        code: 'invalid_username',
      });
    }
  });

  it('senza sessione non si cambia nome utente', async () => {
    await expect(store.changeUsername('Blast')).rejects.toMatchObject({ status: 401 });
  });

  it('riapre un profilo la cui sessione è scaduta', async () => {
    const blast = await store.bootstrap();
    await store.addProfile();

    // La sessione di blast è scaduta: la sua riga non c'è più nel database.
    store.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(blast.id);

    // Non c'è una password da inserire: il profilo si riapre e basta.
    const reopened = await store.switchUser(blast.id);
    expect(reopened?.id).toBe(blast.id);
    expect((await store.session())?.id).toBe(blast.id);
  });

  it('non riapre profili che non esistono', async () => {
    await expect(
      store.call('POST', '/api/auth/reactivate', { userId: 'inesistente-123' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('tiene separati i progressi di due studenti', async () => {
    const blast = await store.bootstrap();
    await passLesson('hangul', 'hangul-01');

    await store.addProfile();
    const fresh = await store.call<CourseListResponse>('GET', '/api/courses');
    expect(fresh.courses[0]?.stats.passed).toBe(0);
    expect(fresh.summary.lessonsPassed).toBe(0);

    await store.switchUser(blast.id);
    const mine = await store.call<CourseListResponse>('GET', '/api/courses');
    expect(mine.courses[0]?.stats.passed).toBe(1);
  });

  it('senza sessione le rotte dello studente rispondono 401', async () => {
    await expect(store.call('GET', '/api/courses')).rejects.toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
    expect(await store.session()).toBeNull();
  });
});

describe('curricolo e progresso', () => {
  beforeEach(async () => {
    await store.bootstrap();
  });

  it('apre la prima lezione e non manda soluzioni al client', async () => {
    const body = await store.call<CourseListResponse>('GET', '/api/courses');
    const course = body.courses[0];
    expect(course?.slug).toBe('hangul');
    expect(course?.units[0]?.lessons[0]?.state).toBe('available');
    expect(course?.units[0]?.lessons[1]?.state).toBe('locked');
    expect(body.summary.nextLesson?.lessonId).toBe('hangul-01');
    expect(JSON.stringify(body)).not.toContain('"answer"');
  });

  it('serve gli esercizi senza la soluzione', async () => {
    const detail = await store.call<LessonDetail>('GET', '/api/courses/hangul/lessons/hangul-01');
    expect(detail.exercises.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(detail)).not.toContain('"answer"');
  });

  it('blocca le lezioni non sbloccate', async () => {
    await expect(store.call('GET', '/api/courses/hangul/lessons/hangul-05')).rejects.toMatchObject({
      status: 403,
      code: 'lesson_locked',
    });
  });

  it('corregge, promuove e sblocca la lezione successiva', async () => {
    const body = await passLesson('hangul', 'hangul-01');
    expect(body.attempt.score).toBe(100);
    expect(body.attempt.passed).toBe(true);
    expect(body.course.stats.passed).toBe(1);
    expect(body.course.units[0]?.lessons[1]?.state).toBe('available');
    expect(body.summary.lessonsPassed).toBe(1);
  });

  it('una prova senza risposte lascia la lezione in corso', async () => {
    const body = await store.call<AttemptResponse>(
      'POST',
      '/api/courses/hangul/lessons/hangul-01/attempts',
      { mode: 'lesson', answers: [] },
    );
    expect(body.attempt.passed).toBe(false);
    expect(body.course.units[0]?.lessons[0]?.state).toBe('in_progress');
    expect(body.course.units[0]?.lessons[1]?.state).toBe('locked');
  });

  it('salta un corso intero rispondendo bene al test', async () => {
    const test = await store.call<CourseSkipTest>('GET', '/api/courses/hangul/skip-test');
    expect(test.exercises.length).toBeGreaterThan(0);

    const course = getCourse('hangul');
    const answers = new Map<string, string>();
    for (const lesson of course ? courseLessons(course) : []) {
      for (const exercise of lesson.exercises) answers.set(exercise.id, sampleResponse(exercise));
    }

    const body = await store.call<CourseSkipResponse>('POST', '/api/courses/hangul/skip', {
      answers: test.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        response: answers.get(exercise.id) ?? '',
      })),
      durationMs: 60_000,
    });
    expect(body.attempt.passed).toBe(true);
    expect(body.lessonsSkipped).toBeGreaterThan(0);
    expect(body.course.stats.skipped).toBe(body.lessonsSkipped);
  });

  it('non inventa carte di ripasso', async () => {
    const review = await reviewCards();
    expect(review).toEqual({ cards: [], dueCards: 0 });
    await expect(store.call('POST', '/api/review/card-inesistente', { grade: 1 })).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it('mette in coda i ripassi dopo una lezione', async () => {
    await passLesson('hangul', 'hangul-01');
    const counts = await store.call<DueCountResponse>('GET', '/api/progress/due');
    expect(counts.dueCards).toBeGreaterThan(0);

    const review = await reviewCards();
    const card = review.cards[0];
    expect(card?.prompt).toBeTruthy();
    expect(card?.answer).toBeTruthy();
  });

  it('chiude una carta di lettura con l’autogiudizio', async () => {
    await passLesson('hangul', 'hangul-01');
    const first = (await reviewCards()).cards[0];
    expect(first).toBeDefined();

    const body = await store.call<{ correct: boolean | null; dueCards: number }>(
      'POST',
      `/api/review/${first?.id ?? ''}`,
      { grade: 2 },
    );
    expect(body.correct).toBeNull();
  });

  it('una parola letta due volte si chiede scritta, senza regalare il coreano', async () => {
    await passLesson('hangul', 'hangul-01');
    const first = (await reviewCards()).cards[0];
    expect(first?.direction).toBe('read');
    const korean = first?.prompt;
    const italian = first?.answer;

    const card = await makeWritable(first?.id ?? '');
    expect(card.prompt).toBe(italian);
    expect(card.answer).toBeNull();
    expect(card.hint).toBeNull();
    expect(JSON.stringify(card)).not.toContain(korean);
  });

  it('scritta bene chiude la carta, sbagliata la riporta a leggere', async () => {
    await passLesson('hangul', 'hangul-01');
    const first = (await reviewCards()).cards[0];
    const korean = first?.prompt;

    const card = await makeWritable(first?.id ?? '');
    const missing = await store.call<{ correct: boolean | null; answer: string | null }>(
      'POST',
      `/api/review/${card.id}`,
      { response: 'sbagliata' },
    );
    expect(missing.correct).toBe(false);
    expect(missing.answer).toBe(korean);

    store.db.prepare('UPDATE srs_cards SET due_at = ? WHERE id = ?').run(todayIso(), card.id);
    const again = (await reviewCards()).cards.find((item) => item.id === card.id);
    expect(again?.direction).toBe('read');

    const right = await store.call<{ correct: boolean | null; card: ReviewCard }>(
      'POST',
      `/api/review/${(await makeWritable(card.id)).id}`,
      { response: korean ?? '' },
    );
    expect(right.correct).toBe(true);
    expect(right.card.dueAt > todayIso()).toBe(true);
  });

  it('racconta la giornata e l’obiettivo della settimana', async () => {
    const body = await store.call<CourseListResponse>('GET', '/api/courses');
    expect(body.plan.tasks[0]?.key).toBe('lesson');
    expect(body.plan.goal).toBeGreaterThanOrEqual(1);

    await store.call('POST', '/api/profile/goal', { goal: 3 });
    const after = await store.call<CourseListResponse>('GET', '/api/courses');
    expect(after.plan.goal).toBe(3);

    const profile = await store.call<ProfileResponse>('GET', '/api/profile');
    expect(profile.user.username).toMatch(USERNAME_SHAPE);
    expect(profile.weeklyGoal).toBe(3);
    expect(profile.vocabulary.total).toBeGreaterThan(0);
  });
});

describe('errori, quaderno e dizionario', () => {
  beforeEach(async () => {
    await store.bootstrap();
  });

  it('un errore entra in banca e si cancella azzeccandolo', async () => {
    const course = getCourse('hangul');
    const lesson = course ? findLesson(course, 'hangul-01') : undefined;
    const exercise = lesson?.exercises[0];
    expect(exercise).toBeDefined();

    const answers = (lesson?.exercises ?? []).map((item) => ({
      exerciseId: item.id,
      response: item.id === exercise?.id ? 'sbagliata' : sampleResponse(item),
    }));
    await store.call('POST', '/api/courses/hangul/lessons/hangul-01/attempts', {
      mode: 'lesson',
      answers,
    });

    const mistakes = await store.call<MistakesResponse>('GET', '/api/mistakes');
    expect(mistakes.stats.total).toBe(1);
    const item = mistakes.items[0];
    expect(item?.exercise.id).toBe(exercise?.id);
    expect(JSON.stringify(item)).not.toContain('"answer"');

    const right = await store.call<{ wrongCount: number | null }>(
      'POST',
      `/api/mistakes/${exercise?.id ?? ''}`,
      { response: exercise ? sampleResponse(exercise) : '' },
    );
    expect(right.wrongCount).toBeNull();
    expect((await store.call<MistakesResponse>('GET', '/api/mistakes')).stats.total).toBe(0);
  });

  it('il quaderno parte chiuso e si apre con la lezione giusta', async () => {
    const closed = await store.call<WritingResponse>('GET', '/api/writing');
    expect(closed.stats.unlocked).toBe(0);
    expect(closed.prompts.every((prompt) => !prompt.unlocked)).toBe(true);
    expect(JSON.stringify(closed)).not.toContain('"model"');

    await passLesson('hangul', 'hangul-01');
    await passLesson('hangul', 'hangul-02');
    const open = await store.call<WritingResponse>('GET', '/api/writing');
    const prompt = open.prompts.find((item) => item.unlocked);
    expect(prompt, 'consegna aperta').toBeDefined();

    const model = getWritingPrompts().find((item) => item.id === prompt?.id)?.model;
    expect(model).toBeTruthy();

    const check = await store.call<WritingCheckResponse>(
      'POST',
      `/api/writing/${prompt?.id ?? ''}`,
      { text: model ?? '' },
    );
    expect(check.check.verdict).toBe('model');
    expect(check.entry.promptId).toBe(prompt?.id);
  });

  it('cerca nel dizionario per coreano e per italiano', async () => {
    const entry = getVocabulary()[0];
    expect(entry).toBeDefined();

    const korean = await store.call<VocabularyResponse>(
      'GET',
      `/api/vocabulary?q=${encodeURIComponent(entry?.ko ?? '')}`,
    );
    expect(korean.total).toBeGreaterThan(0);

    const italian = await store.call<VocabularyResponse>(
      'GET',
      `/api/vocabulary?q=${encodeURIComponent(entry?.it ?? '')}`,
    );
    expect(italian.total).toBeGreaterThan(0);

    const empty = await store.call<VocabularyResponse>('GET', '/api/vocabulary?q=zzzzzz');
    expect(empty.entries).toEqual([]);
    expect(empty.total).toBe(0);
  });

  it('risolve la parola cliccata in un brano, anche con la particella', async () => {
    const entry = getVocabulary().find((item) => item.ko.length > 1);
    expect(entry).toBeDefined();

    const exact = await store.call<WordLookupResponse>(
      'GET',
      `/api/vocabulary/lookup?w=${encodeURIComponent(entry?.ko ?? '')}`,
    );
    expect(exact.match?.ko).toBe(entry?.ko);
    expect(exact.match?.via).toBe('exact');

    // La stessa voce con una particella attaccata: il dizionario la ritrova.
    const glued = await store.call<WordLookupResponse>(
      'GET',
      `/api/vocabulary/lookup?w=${encodeURIComponent(`${entry?.ko ?? ''}에`)}`,
    );
    expect(glued.match?.ko).toBe(entry?.ko);

    const unknown = await store.call<WordLookupResponse>('GET', '/api/vocabulary/lookup?w=zzzz');
    expect(unknown.match).toBeNull();
  });

  it('elenca i dialoghi con le battute', async () => {
    const list = await store.call<DialogueListResponse>('GET', '/api/dialogues');
    expect(list.dialogues.length).toBeGreaterThan(0);
    expect(list.dialogues[0]?.totalTurns).toBeGreaterThan(0);
  });
});

describe('sfida mista', () => {
  it('si apre solo con una lezione chiusa e non tocca il progresso', async () => {
    await store.bootstrap();

    const empty = await store.call<ChallengeResponse>('GET', '/api/challenge');
    expect(empty.exercises).toEqual([]);
    expect(empty.availableLessons).toBe(0);

    await passLesson('hangul', 'hangul-01');

    const before = await store.call<CourseListResponse>('GET', '/api/courses');
    const hangulBefore = before.courses.find((course) => course.slug === 'hangul');
    expect(hangulBefore).toBeDefined();

    const challenge = await store.call<ChallengeResponse>('GET', '/api/challenge');
    expect(challenge.availableLessons).toBe(1);
    expect(challenge.exercises.length).toBeGreaterThan(0);
    expect(challenge.exercises.length).toBeLessThanOrEqual(12);
    expect(challenge.exercises.every((item) => item.course.slug === 'hangul')).toBe(true);

    // Stessa data e stesso profilo: la sfida non cambia fra due aperture.
    const again = await store.call<ChallengeResponse>('GET', '/api/challenge');
    expect(again.exercises.map((item) => item.id)).toEqual(
      challenge.exercises.map((item) => item.id),
    );

    const answers = challenge.exercises.map((item) => ({
      exerciseId: item.id,
      response: sampleResponse(findExercise(item.id)!.exercise),
    }));
    const result = await store.call<ChallengeResultResponse>('POST', '/api/challenge', {
      answers,
    });
    expect(result.total).toBe(challenge.exercises.length);
    expect(result.score).toBe(100);
    expect(result.wrong).toBe(0);

    const after = await store.call<CourseListResponse>('GET', '/api/courses');
    const hangulAfter = after.courses.find((course) => course.slug === 'hangul')!;
    expect(hangulAfter.stats).toEqual(hangulBefore!.stats);
  });

  it('una risposta sbagliata entra nella banca degli errori', async () => {
    await store.bootstrap();
    await passLesson('hangul', 'hangul-01');

    const challenge = await store.call<ChallengeResponse>('GET', '/api/challenge');
    const first = challenge.exercises[0]!;

    const answers = challenge.exercises.map((item) => ({
      exerciseId: item.id,
      response:
        item.id === first.id
          ? 'risposta sbagliata'
          : sampleResponse(findExercise(item.id)!.exercise),
    }));
    const result = await store.call<ChallengeResultResponse>('POST', '/api/challenge', {
      answers,
    });
    expect(result.wrong).toBe(1);

    const mistakes = await store.call<{ items: { exercise: { id: string } }[] }>(
      'GET',
      '/api/mistakes',
    );
    expect(mistakes.items.some((item) => item.exercise.id === first.id)).toBe(true);
  });
});

describe('sala di lettura', () => {
  it('raccoglie tutti i brani e nasconde la traduzione finché la lezione è aperta', async () => {
    await store.bootstrap();

    const all = await store.call<ReadingsResponse>('GET', '/api/readings');
    expect(all.readings.length).toBeGreaterThan(30);
    expect(all.withTranslation).toBe(0);
    expect(all.readings.every((reading) => reading.translation === '')).toBe(true);
    expect(new Set(all.readings.map((reading) => reading.id)).size).toBe(all.readings.length);

    // I livelli del percorso ci sono tutti, e i conteggi tornano col totale.
    const levels = all.levels.map((entry) => entry.level);
    expect(levels).toContain('pre-A1');
    expect(levels).toContain('B2');
    expect(all.levels.reduce((sum, entry) => sum + entry.count, 0)).toBe(all.readings.length);

    // hangul-06 porta un brano: chiusa la lezione, la sua traduzione arriva.
    // Le lezioni si aprono una dopo l'altra, quindi si chiudono in ordine.
    for (const id of ['hangul-01', 'hangul-02', 'hangul-03', 'hangul-04', 'hangul-05', 'hangul-06']) {
      await passLesson('hangul', id);
    }
    const after = await store.call<ReadingsResponse>('GET', '/api/readings');
    const own = after.readings.filter((reading) => reading.lesson.id === 'hangul-06');
    expect(own).toHaveLength(1);
    expect(own[0]!.translation.length).toBeGreaterThan(0);
    expect(after.withTranslation).toBe(all.withTranslation + 1);
  });

  it('non lascia uscire la traduzione nemmeno dalla vista del corso', async () => {
    await store.bootstrap();

    const course = (await store.call<{ course: CourseView }>('GET', '/api/courses/hangul')).course;
    const lessons = course.units
      .flatMap((unit) => unit.lessons)
      .filter((lesson) => (lesson.passages ?? []).length > 0);
    expect(lessons.length).toBeGreaterThan(0);
    for (const lesson of lessons) {
      for (const passage of lesson.passages ?? []) expect(passage.translation).toBe('');
    }

    for (const id of ['hangul-01', 'hangul-02', 'hangul-03', 'hangul-04', 'hangul-05', 'hangul-06']) {
      await passLesson('hangul', id);
    }
    const after = (await store.call<{ course: CourseView }>('GET', '/api/courses/hangul')).course;
    const closed = after.units
      .flatMap((unit) => unit.lessons)
      .find((lesson) => lesson.id === 'hangul-06');
    expect(closed?.passages?.[0]?.translation.length).toBeGreaterThan(0);
  });
});

describe('persistenza', () => {
  it('riapre i byte esportati con dentro studenti e progressi', async () => {
    const user = await store.bootstrap();
    await passLesson('hangul', 'hangul-01');

    const bytes = store.db.exportBytes();
    expect(bytes.length).toBeGreaterThan(0);

    const reopened = await openDb({ bytes });
    const row = reopened
      .prepare('SELECT COUNT(*) AS n FROM users WHERE username = ?')
      .get(user.username) as { n: number };
    expect(row.n).toBe(1);

    const progress = reopened
      .prepare('SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id = ? AND state = ?')
      .get(user.id, 'passed') as { n: number };
    expect(progress.n).toBe(1);
    reopened.close();
  });
});
