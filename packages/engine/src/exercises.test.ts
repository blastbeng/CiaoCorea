import { describe, expect, it } from 'vitest';
import type { Exercise, FillBlankExercise, ListenTypeExercise, OrderWordsExercise } from '@ciaocorea/shared';
import {
  PASS_THRESHOLD,
  gradeAttempt,
  gradeExercise,
  isCorrect,
  isWrittenExercise,
  pickSkipTest,
  stripExercise,
} from './exercises';
import { INITIAL_SRS, scheduleCard } from './srs';

const choice: Exercise = {
  id: 'e-choice',
  type: 'jamo_choice',
  prompt: 'Quale vocale si legge «a»?',
  options: ['ㅏ', 'ㅓ'],
  answer: 'ㅏ',
};

const build: Exercise = {
  id: 'e-build',
  type: 'block_build',
  prompt: 'Componi «na»',
  parts: ['ㄴ', 'ㅏ'],
  answer: '나',
};

const typed: Exercise = {
  id: 'e-typed',
  type: 'type_hangul',
  prompt: 'Scrivi «gang»',
  answer: '강',
};

const meaning: Exercise = {
  id: 'e-meaning',
  type: 'type_meaning',
  prompt: 'Che significa 밥?',
  answer: 'riso cotto',
  accept: ['riso', 'pasto'],
};

const ordering: OrderWordsExercise = {
  id: 'e-order',
  type: 'order_words',
  prompt: 'Rimetti in ordine: «Non ho amici».',
  words: ['없어요', '친구가', '저는'],
  answer: '저는 친구가 없어요',
};

const blank: FillBlankExercise = {
  id: 'e-blank',
  type: 'fill_blank',
  prompt: 'Completa: «Vado a scuola».',
  text: '학교___ 가요.',
  answer: '에',
};

const blankChoice: FillBlankExercise = {
  id: 'e-blank-choice',
  type: 'fill_blank',
  prompt: 'Scegli la particella del soggetto.',
  text: '책___ 있어요.',
  options: ['이', '가'],
  answer: '이',
};

const dictation: ListenTypeExercise = {
  id: 'e-listen',
  type: 'listen_type',
  prompt: 'Ascolta e scrivi in coreano.',
  speak: '학교에 가요.',
  answer: '학교에 가요',
  accept: ['학교에가요'],
};

describe('correzione', () => {
  it('accetta la scelta esatta e rifiuta quella sbagliata', () => {
    expect(isCorrect(choice, 'ㅏ')).toBe(true);
    expect(isCorrect(choice, 'ㅓ')).toBe(false);
  });

  it('accetta sillabe scritte con jamo di compatibilità', () => {
    // "나" composto da jamo separati invece che precomposto.
    expect(isCorrect(build, '\u1102\u1161')).toBe(true);
  });

  it('ignora spazi e punteggiatura finale nelle risposte hangul', () => {
    expect(isCorrect(typed, ' 강 ')).toBe(true);
    expect(isCorrect(typed, '강.')).toBe(true);
  });

  it('accetta sinonimi italiani senza accenti né maiuscole', () => {
    expect(isCorrect(meaning, 'Riso')).toBe(true);
    expect(isCorrect(meaning, 'PASTO')).toBe(true);
    expect(isCorrect(meaning, 'verdura')).toBe(false);
  });

  it('non fa trapelare la soluzione al client', () => {
    const pub = stripExercise(meaning) as Record<string, unknown>;
    expect(pub.answer).toBeUndefined();
    expect(pub.accept).toBeUndefined();
    expect(pub.prompt).toBe(meaning.prompt);
  });

  it('restituisce sempre una risposta attesa dopo la correzione', () => {
    expect(gradeExercise(typed, '강').expected).toBe('강');
    expect(gradeExercise(typed, '간')).toEqual({
      exerciseId: 'e-typed',
      correct: false,
      expected: '강',
      response: '간',
    });
  });

  it('corregge il dettato come una risposta scritta in coreano', () => {
    expect(isCorrect(dictation, '학교에 가요')).toBe(true);
    // Senza spazi è la stessa frase: lo spazio in coreano non è la punteggiatura.
    expect(isCorrect(dictation, '학교에가요')).toBe(true);
    expect(isCorrect(dictation, '학교에 가')).toBe(false);
    expect(isCorrect(dictation, '')).toBe(false);
  });

  it('manda al dettato la frase da ascoltare, non la soluzione', () => {
    const pub = stripExercise(dictation) as Record<string, unknown>;
    expect(pub.answer).toBeUndefined();
    expect(pub.accept).toBeUndefined();
    // Senza la frase da riprodurre l'esercizio non si può fare: resta pubblica.
    expect(pub.speak).toBe(dictation.speak);
  });
});

describe('frasi da rimettere in ordine e buchi', () => {
  it('vuole l’ordine giusto, non le stesse parole alla rinfusa', () => {
    expect(isCorrect(ordering, '저는 친구가 없어요')).toBe(true);
    // Lo studente può mettere uno spazio di troppo: la frase è la stessa.
    expect(isCorrect(ordering, '저는  친구가  없어요')).toBe(true);
    expect(isCorrect(ordering, '친구가 없어요')).toBe(false);
    expect(isCorrect(ordering, '친구가 저는 없어요')).toBe(false);
  });

  it('corregge il buco scritto in coreano', () => {
    expect(isCorrect(blank, '에')).toBe(true);
    expect(isCorrect(blank, ' 에서')).toBe(false);
  });

  it('corregge il buco con le opzioni come una scelta', () => {
    expect(isCorrect(blankChoice, '이')).toBe(true);
    expect(isCorrect(blankChoice, '가')).toBe(false);
  });

  it('non manda in soluzione né della frase né del buco', () => {
    const ordered = stripExercise(ordering) as Record<string, unknown>;
    expect(ordered.answer).toBeUndefined();
    expect(ordered.words).toEqual(ordering.words);

    const cloze = stripExercise(blank) as Record<string, unknown>;
    expect(cloze.answer).toBeUndefined();
    expect(cloze.text).toBe(blank.text);
  });

  it('conta come risposta scritta solo quando la frase la si scrive', () => {
    expect(isWrittenExercise(ordering)).toBe(true);
    expect(isWrittenExercise(blank)).toBe(true);
    expect(isWrittenExercise(blankChoice)).toBe(false);
    expect(isWrittenExercise(choice)).toBe(false);
    expect(isWrittenExercise(dictation)).toBe(true);
  });
});

describe('tentativo', () => {
  const exercises = [choice, build, typed, meaning];

  it('promuove sopra la soglia e calcola il punteggio', () => {
    const result = gradeAttempt(exercises, [
      { exerciseId: 'e-choice', response: 'ㅏ' },
      { exerciseId: 'e-build', response: '나' },
      { exerciseId: 'e-typed', response: '강' },
      { exerciseId: 'e-meaning', response: 'pasto' },
    ]);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.lessonState).toBe('passed');
  });

  it('sotto la soglia segna la lezione come in corso e conserva il record', () => {
    const result = gradeAttempt(
      exercises,
      [
        { exerciseId: 'e-choice', response: 'ㅏ' },
        { exerciseId: 'e-build', response: '나' },
        { exerciseId: 'e-typed', response: '간' },
        { exerciseId: 'e-meaning', response: 'verdura' },
      ],
      { previousBest: 90 },
    );
    expect(result.score).toBe(50);
    expect(PASS_THRESHOLD).toBe(0.8);
    expect(result.passed).toBe(false);
    expect(result.lessonState).toBe('in_progress');
    expect(result.bestScore).toBe(90);
  });

  it('ignora risposte con id inventati', () => {
    const result = gradeAttempt(exercises, [
      { exerciseId: 'inventato', response: 'qualcosa' },
    ]);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(4);
    expect(result.passed).toBe(false);
  });

  it('permette di assegnare lo stato "saltata" a una prova superata', () => {
    const result = gradeAttempt(
      exercises.map((exercise) => ({ ...exercise, answer: exercise.answer })),
      exercises.map((exercise) => ({ exerciseId: exercise.id, response: exercise.answer })),
      { passedState: 'skipped' },
    );
    expect(result.passed).toBe(true);
    expect(result.lessonState).toBe('skipped');
  });
});

describe('test di salto', () => {
  const many: Exercise[] = Array.from({ length: 12 }, (_, index) => ({
    id: `e-${index}`,
    type: index % 4 === 0 ? 'type_hangul' : 'reading_mcq',
    prompt: `domanda ${index}`,
    options: index % 4 === 0 ? undefined : ['a', 'b'],
    answer: index % 4 === 0 ? '가' : 'a',
  })) as Exercise[];

  it('sceglie cinque domande deterministiche e senza duplicati', () => {
    const first = pickSkipTest(many).map((exercise) => exercise.id);
    const second = pickSkipTest(many).map((exercise) => exercise.id);
    expect(first).toHaveLength(5);
    expect(new Set(first).size).toBe(5);
    expect(second).toEqual(first);
  });

  it('include almeno una risposta scritta', () => {
    const picked = pickSkipTest(many);
    expect(picked.some((exercise) => exercise.type === 'type_hangul')).toBe(true);
  });

  it('pesca per prime le frasi e i buchi da scrivere', () => {
    const pool: Exercise[] = [
      choice,
      blankChoice,
      ...Array.from({ length: 8 }, (_, index) => ({ ...choice, id: `q-${index}` })),
      ordering,
      blank,
    ];
    const picked = pickSkipTest(pool, 5);
    expect(picked.filter(isWrittenExercise).map((exercise) => exercise.id)).toEqual([
      'e-order',
      'e-blank',
    ]);
  });

  it('restituisce tutta la lezione quando è più corta del test', () => {
    expect(pickSkipTest([choice, build], 5)).toHaveLength(2);
  });
});

describe('ripetizione spaziata', () => {
  it('porta la prima risposta corretta a un giorno', () => {
    const next = scheduleCard(INITIAL_SRS, 1, new Date('2026-01-01T00:00:00Z'));
    expect(next.reps).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe('2026-01-02');
  });

  it('allunga progressivamente e non supera il limite di facilità', () => {
    let state = INITIAL_SRS;
    const days: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const next = scheduleCard(state, 1, new Date('2026-01-01T00:00:00Z'));
      days.push(next.intervalDays);
      state = { ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses };
    }
    expect(days[0]).toBe(1);
    expect(days[1]).toBe(3);
    expect(days[days.length - 1]).toBeGreaterThan(days[1] ?? 0);
    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('un errore riporta la card a domani e aumenta le dimenticanze', () => {
    const next = scheduleCard({ ease: 2.5, intervalDays: 20, reps: 4, lapses: 1 }, 0, new Date('2026-01-01T00:00:00Z'));
    expect(next.intervalDays).toBe(1);
    expect(next.reps).toBe(0);
    expect(next.lapses).toBe(2);
    expect(next.ease).toBeLessThan(2.5);
  });
});
