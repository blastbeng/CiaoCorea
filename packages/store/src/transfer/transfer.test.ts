import { describe, expect, it } from 'vitest';
import { createStore, type Store } from '../store';
import { checksumOf, parseBundle, TransferError, type TransferBundle } from './bundle';
import { decodeCompact } from './compact';

/**
 * Il trasferimento è la parte dell'app che tocca i dati di qualcun altro: un
 * file può arrivare da un altro dispositivo, da un backup di un mese fa o da
 * una mano che l'ha modificato. Questi test tengono ferme le tre promesse:
 * niente si perde, niente torna indietro, importare due volte non cambia nulla.
 */

async function memoryStore(): Promise<Store> {
  return createStore({ storage: 'memory' });
}

function seed(db: Store['db'], userId: string): void {
  const day = '2026-02-01';
  db.prepare(
    `INSERT INTO lesson_progress(user_id, course_slug, lesson_id, state, best_score, attempts,
                                updated_at, completed_at)
     VALUES (?, 'coreano-base', 'l01', 'passed', 90, 3, ?, ?)`,
  ).run(userId, `${day}T10:00:00.000Z`, `${day}T10:00:00.000Z`);

  db.prepare(
    `INSERT INTO attempts(id, user_id, course_slug, lesson_id, mode, score, correct, total,
                          duration_ms, created_at)
     VALUES ('attempt-1', ?, 'coreano-base', 'l01', 'lesson', 90, 9, 10, 42000, ?)`,
  ).run(userId, `${day}T10:00:00.000Z`);

  db.prepare(
    `INSERT INTO srs_cards(id, user_id, course_slug, lesson_id, item_id, front, back, hint,
                           ease, interval_days, reps, lapses, grade, due_at, created_at, updated_at)
     VALUES ('card-1', ?, 'coreano-base', 'l01', 'l01:안녕', '안녕', 'ciao', 'annyeong',
             2.5, 6, 4, 1, 2, ?, ?, ?)`,
  ).run(userId, `${day}T10:00:00.000Z`, `${day}T10:00:00.000Z`, `${day}T10:00:00.000Z`);

  db.prepare(
    `INSERT INTO daily_stats(user_id, day, lessons_completed, exercises, correct, reviews, writing)
     VALUES (?, ?, 1, 10, 9, 3, 1)`,
  ).run(userId, day);

  db.prepare(
    `INSERT INTO dialogue_progress(user_id, dialogue_slug, turn_index, correct, answered,
                                   wrong_on_turn, completed_at, updated_at)
     VALUES (?, 'caffe', 4, 3, 4, 1, ?, ?)`,
  ).run(userId, `${day}T11:00:00.000Z`, `${day}T11:00:00.000Z`);

  db.prepare(
    `INSERT INTO writing_entries(id, user_id, prompt_id, course_slug, text, verdict, created_at)
     VALUES ('writing-1', ?, 'p01', 'coreano-base', '안녕하세요', 'close', ?)`,
  ).run(userId, `${day}T12:00:00.000Z`);

  db.prepare(
    `INSERT INTO exercise_mistakes(user_id, exercise_id, course_slug, lesson_id, wrong_count,
                                   created_at, last_wrong_at)
     VALUES (?, 'ex-1', 'coreano-base', 'l01', 2, ?, ?)`,
  ).run(userId, `${day}T10:00:00.000Z`, `${day}T10:00:00.000Z`);
}

function countOf(store: Store, table: string, userId: string): number {
  const row = store.db
    .prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id = ?`)
    .get(userId) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

describe('esportazione', () => {
  it('mette in un file solo il profilo chiesto, con tutto quello che serve', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);

    const bundle = await source.exportTransfer('profile');

    expect(bundle.format).toBe('ciaocorea.profile');
    expect(bundle.profiles).toHaveLength(1);

    const profile = bundle.profiles[0]!;
    expect(profile.user.id).toBe(user.id);
    expect(profile.lessons).toHaveLength(1);
    expect(profile.cards).toHaveLength(1);
    expect(profile.attempts).toHaveLength(1);
    expect(profile.days).toHaveLength(1);
    expect(profile.dialogues).toHaveLength(1);
    expect(profile.writing).toHaveLength(1);
    expect(profile.mistakes).toHaveLength(1);
  });

  it('il backup completo porta tutti i profili del browser', async () => {
    const source = await memoryStore();
    await source.bootstrap();
    await source.addProfile();

    const bundle = await source.exportTransfer('all');
    expect(bundle.profiles).toHaveLength(2);
  });
});

describe('importazione', () => {
  it('porta il profilo su un altro dispositivo e lo apre', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();

    const result = await target.importTransfer(bundle, 'merge');

    expect(result.user.id).toBe(user.id);
    expect(result.user.username).toBe(user.username);
    expect(countOf(target, 'lesson_progress', user.id)).toBe(1);
    expect(countOf(target, 'attempts', user.id)).toBe(1);
    expect(countOf(target, 'srs_cards', user.id)).toBe(1);

    const lesson = target.db
      .prepare('SELECT state, best_score, attempts FROM lesson_progress WHERE user_id = ?')
      .get(user.id) as { state: string; best_score: number; attempts: number };
    expect(lesson).toEqual({ state: 'passed', best_score: 90, attempts: 3 });
  });

  it('l’anteprima racconta cosa succede senza toccare il database', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();
    const before = countOf(target, 'lesson_progress', user.id);

    const preview = await target.previewTransfer(bundle);

    expect(preview.profiles[0]?.username).toBe(user.username);
    expect(preview.outcome.profiles[0]?.lessons.added).toBe(1);
    expect(preview.outcome.profiles[0]?.attempts).toBe(1);
    expect(countOf(target, 'lesson_progress', user.id)).toBe(before);
  });

  it('importarlo due volte non cambia niente la seconda', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();
    await target.importTransfer(bundle, 'merge');

    const second = await target.importTransfer(bundle, 'merge');
    const summary = second.outcome.profiles[0]!;

    expect(summary.lessons).toEqual({ added: 0, updated: 0 });
    expect(summary.cards).toEqual({ added: 0, updated: 0 });
    expect(summary.attempts).toBe(0);
    expect(summary.writing).toBe(0);
    expect(summary.mistakes.added).toBe(0);
  });

  it('una lezione promossa non torna indietro, e il punteggio più alto vince', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();
    await target.importTransfer(bundle, 'merge');

    const older = structuredClone(bundle);
    const lesson = older.profiles[0]!.lessons[0]!;
    lesson.state = 'in_progress';
    lesson.bestScore = 40;
    lesson.updatedAt = '2026-03-01T00:00:00.000Z';
    // Il checksum va rifatto: il file è stato modificato dopo essere stato
    // scritto, e senza questo il parser lo tratterebbe come danneggiato.
    older.checksum = checksumOf(older.profiles);

    await target.importTransfer(older, 'merge');

    const row = target.db
      .prepare('SELECT state, best_score FROM lesson_progress WHERE user_id = ?')
      .get(user.id) as { state: string; best_score: number };
    expect(row.state).toBe('passed');
    expect(row.best_score).toBe(90);
  });

  it('i contatori di un giorno non si sommano: vince il massimo', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();
    await target.importTransfer(bundle, 'merge');
    await target.importTransfer(bundle, 'merge');

    const row = target.db
      .prepare('SELECT exercises, reviews FROM daily_stats WHERE user_id = ?')
      .get(user.id) as { exercises: number; reviews: number };
    expect(row).toEqual({ exercises: 10, reviews: 3 });
  });

  it('un errore corretto altrove non torna in banca', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();
    await target.importTransfer(bundle, 'merge');

    // Sul dispositivo di destinazione lo studente lo ha rifatto e azzeccato:
    // la riga sparisce e resta il segnaposto, più recente del backup.
    target.db.prepare('DELETE FROM exercise_mistakes WHERE user_id = ?').run(user.id);
    target.db
      .prepare(
        `INSERT INTO sync_tombstones(user_id, kind, key, at) VALUES (?, 'mistake', 'ex-1', ?)`,
      )
      .run(user.id, '2026-04-01T00:00:00.000Z');

    await target.importTransfer(bundle, 'merge');

    expect(countOf(target, 'exercise_mistakes', user.id)).toBe(0);
  });

  it('due profili con lo stesso nome restano due profili', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    source.db.prepare('UPDATE users SET username = ?, display_name = ? WHERE id = ?').run(
      'Marco',
      'Marco',
      user.id,
    );
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    const local = await target.bootstrap();
    target.db.prepare('UPDATE users SET username = ?, display_name = ? WHERE id = ?').run(
      'Marco',
      'Marco',
      local.id,
    );

    const result = await target.importTransfer(bundle, 'merge');
    const summary = result.outcome.profiles[0]!;

    expect(summary.renamedFrom).toBe('Marco');
    expect(summary.username).toBe('Marco-2');
    expect(result.user.id).toBe(user.id);
  });

  it('“sostituisci” lascia esattamente il profilo del file', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = await source.exportTransfer('profile');

    const target = await memoryStore();
    await target.bootstrap();
    await target.importTransfer(bundle, 'merge');

    // Un tentativo che nel file non c'è: con "sostituisci" deve sparire.
    target.db
      .prepare(
        `INSERT INTO attempts(id, user_id, course_slug, lesson_id, mode, score, correct, total,
                              duration_ms, created_at)
         VALUES ('attempt-local', ?, 'coreano-base', 'l01', 'lesson', 50, 5, 10, 1000, ?)`,
      )
      .run(user.id, '2026-05-01T00:00:00.000Z');

    const result = await target.importTransfer(bundle, 'replace');

    expect(result.outcome.profiles[0]?.attempts).toBe(1);
    const ids = (
      target.db.prepare('SELECT id FROM attempts WHERE user_id = ?').all(user.id) as unknown as {
        id: string;
      }[]
    ).map((row) => row.id);
    expect(ids).toEqual(['attempt-1']);
  });
});

describe('codice veloce', () => {
  it('porta lezioni, ripassi e giorni senza la cronologia', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);

    const compact = await source.transferCode();
    expect(compact.code.startsWith('CC1')).toBe(true);
    expect(compact.lessons).toBe(1);
    expect(compact.cards).toBe(1);
    expect(compact.chars).toBe(compact.code.length);

    const bundle = await decodeCompact(compact.code);
    const profile = bundle.profiles[0]!;

    expect(profile.user.id).toBe(user.id);
    expect(profile.lessons).toHaveLength(1);
    expect(profile.lessons[0]?.state).toBe('passed');
    expect(profile.lessons[0]?.bestScore).toBe(90);
    expect(profile.cards).toHaveLength(1);
    expect(profile.cards[0]?.itemId).toBe('l01:안녕');
    expect(profile.cards[0]?.front).toBe('안녕');
    expect(profile.days).toHaveLength(1);
    expect(profile.dialogues).toHaveLength(1);

    // Quello che il codice lascia a casa, per scelta.
    expect(profile.attempts).toHaveLength(0);
    expect(profile.writing).toHaveLength(0);
    expect(profile.mistakes).toHaveLength(0);
  });

  it('si applica con lo stesso merge del file', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const compact = await source.transferCode();
    const bundle = await decodeCompact(compact.code);

    const target = await memoryStore();
    await target.bootstrap();
    const result = await target.importTransfer(bundle, 'merge');

    expect(result.user.id).toBe(user.id);
    expect(countOf(target, 'lesson_progress', user.id)).toBe(1);
    expect(countOf(target, 'srs_cards', user.id)).toBe(1);
    expect(countOf(target, 'daily_stats', user.id)).toBe(1);
  });

  it('rifiuta un codice che non è suo, o rovinato', async () => {
    await expect(decodeCompact('CC1z')).rejects.toThrow(TransferError);
    await expect(decodeCompact('buongiorno')).rejects.toThrow(/codice di trasferimento/);
    await expect(decodeCompact('CC1rzm9vZ2dpb3Jubw')).rejects.toThrow(TransferError);
  });
});

describe('file rotti o estranei', () => {
  it('rifiuta un JSON che non è di CiaoCorea', () => {
    expect(() => parseBundle('{"format":"altro"}')).toThrow(TransferError);
  });

  it('rifiuta un backup manomesso', async () => {
    const source = await memoryStore();
    const user = await source.bootstrap();
    seed(source.db, user.id);
    const bundle = (await source.exportTransfer('profile')) as TransferBundle;

    const tampered = JSON.parse(JSON.stringify(bundle)) as TransferBundle;
    tampered.profiles[0]!.lessons[0]!.bestScore = 100;

    expect(() => parseBundle(tampered)).toThrow(/danneggiato/);
  });
});
