import type { Exercise } from '@ciaocorea/shared';

/**
 * Un esercizio con la sua provenienza: la sfida mescola lezioni e corsi, e la
 * pagina deve poter dire da dove viene la domanda e riportare lo studente alla
 * lezione quando sbaglia.
 */
export interface ChallengeSource {
  exercise: Exercise;
  courseSlug: string;
  courseTitle: string;
  level: string;
  lessonId: string;
  lessonTitle: string;
}

export interface ChallengePickOptions {
  /** Quante domande in tutto. */
  count?: number;
  /** Quante domande al massimo dalla stessa lezione. */
  perLesson?: number;
  /** Seme stabile: stesso seme, stessa sfida; seme diverso, altra sfida. */
  seed?: string;
}

/** FNV-1a a 32 bit: basta per ordinare in modo stabile senza dipendenze. */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

function byHash<T>(items: readonly T[], seed: string, key: (item: T) => string): T[] {
  return [...items].sort((left, right) => {
    const difference = hash(`${seed}:${key(left)}`) - hash(`${seed}:${key(right)}`);
    if (difference !== 0) return difference;
    return key(left).localeCompare(key(right));
  });
}

/**
 * La sfida del giorno: un campione misto delle lezioni già chiuse.
 *
 * Non è un esame e non tocca il progresso: serve a riprendere in mano cose
 * vecchie senza sapere quale corso uscirà. La selezione è deterministica per
 * seme (la data e il profilo), così due consegne della stessa giornata
 * correggono le stesse domande, e non si può ripetere finché non esce quella
 * facile. Le domande sono distribuite: al massimo `perLesson` per lezione, e le
 * lezioni entrano a turno invece di lasciare che un corso lungo occupi tutto.
 */
export function pickChallenge(
  sources: readonly ChallengeSource[],
  options: ChallengePickOptions = {},
): ChallengeSource[] {
  const count = Math.max(1, options.count ?? 12);
  const perLesson = Math.max(1, options.perLesson ?? 2);
  const seed = options.seed ?? '';

  const seen = new Set<string>();
  const groups = new Map<string, ChallengeSource[]>();
  for (const source of sources) {
    if (seen.has(source.exercise.id)) continue;
    seen.add(source.exercise.id);
    const key = `${source.courseSlug}/${source.lessonId}`;
    const group = groups.get(key) ?? [];
    group.push(source);
    groups.set(key, group);
  }

  const keys = byHash([...groups.keys()], seed, (key) => `lesson:${key}`);
  for (const key of keys) {
    const group = groups.get(key)!;
    groups.set(key, byHash(group, seed, (source) => source.exercise.id));
  }

  const picked: ChallengeSource[] = [];
  for (let round = 0; round < perLesson && picked.length < count; round += 1) {
    for (const key of keys) {
      if (picked.length >= count) break;
      const candidate = groups.get(key)?.[round];
      if (candidate) picked.push(candidate);
    }
  }

  // Poche lezioni chiuse: si riempie con quello che resta, senza il tetto per
  // lezione. Meglio una sfida più concentrata che una sfida vuota.
  if (picked.length < count) {
    const used = new Set(picked.map((source) => source.exercise.id));
    const rest = byHash(
      sources.filter((source) => !used.has(source.exercise.id)),
      seed,
      (source) => source.exercise.id,
    );
    for (const source of rest) {
      if (picked.length >= count) break;
      if (!used.has(source.exercise.id)) {
        used.add(source.exercise.id);
        picked.push(source);
      }
    }
  }

  return picked;
}
