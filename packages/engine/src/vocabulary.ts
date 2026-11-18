import type { VocabEntry, VocabFilterOption } from '@ciaocorea/shared';
import { foldItalian, foldRomanization, normalizeHangul } from './normalize';

/**
 * Ricerca nel dizionario del curricolo.
 *
 * Lo studente cerca una parola come la ricorderebbe a voce: in coreano se la
 * ricorda scritta, in romanizzazione se la ricorda a orecchio, in italiano se
 * sta cercando il contrario. I tre canali hanno pesi diversi perché un match
 * sul coreano è più selettivo di una sottostringa italiana.
 */

export interface VocabSearchOptions {
  query?: string;
  courseSlug?: string | null;
  limit?: number;
  offset?: number;
}

export interface VocabSearchResult {
  /** Voce ordinata per pertinenza, tagliata alla pagina richiesta. */
  entries: VocabEntry[];
  /** Voci che matchano, prima del taglio di pagina. */
  total: number;
}

/** Piccole parole che non qualificano una ricerca: "il caffè", "un treno". */
const STOPWORDS = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'the', 'a', 'an']);

interface Haystack {
  ko: string;
  it: string;
  rr: string;
}

function haystackOf(entry: VocabEntry): Haystack {
  return {
    ko: normalizeHangul(entry.ko),
    it: foldItalian(entry.it),
    rr: foldRomanization(entry.rr),
  };
}

/**
 * Punteggio di un singolo token sui tre canali; null se il token non matcha.
 * Ogni canale confronta la propria forma piegata: il coreano non deve matchare
 * una stringa latina, e una romanizzazione non deve matchare un significato.
 */
function tokenScore(haystack: Haystack, token: string): number | null {
  const ko = normalizeHangul(token);
  const rr = foldRomanization(token);
  const it = foldItalian(token);

  let best = 0;

  if (haystack.ko === ko) best = 12;
  else if (haystack.ko.startsWith(ko)) best = 9;
  else if (haystack.ko.includes(ko)) best = 6;

  if (haystack.rr === rr) best = Math.max(best, 12);
  else if (haystack.rr.startsWith(rr)) best = Math.max(best, 8);
  else if (haystack.rr.includes(rr)) best = Math.max(best, 5);

  if (haystack.it === it) best = Math.max(best, 12);
  else if (haystack.it.startsWith(it)) best = Math.max(best, 7);
  else if (haystack.it.includes(it)) best = Math.max(best, 4);

  return best === 0 ? null : best;
}

export function searchVocabulary(
  entries: readonly VocabEntry[],
  options: VocabSearchOptions = {},
): VocabSearchResult {
  const limit = Math.max(1, Math.min(options.limit ?? 60, 300));
  const offset = Math.max(0, options.offset ?? 0);
  const courseSlug = options.courseSlug && options.courseSlug.length > 0 ? options.courseSlug : null;

  const rawTokens = (options.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const kept = rawTokens.filter((token) => !STOPWORDS.has(token));
  const tokens = kept.length > 0 ? kept : rawTokens;

  const scoped = courseSlug ? entries.filter((entry) => entry.courseSlug === courseSlug) : entries;

  let matches: Array<{ entry: VocabEntry; score: number }>;
  if (tokens.length === 0) {
    matches = scoped.map((entry) => ({ entry, score: 0 }));
  } else {
    matches = [];
    for (const entry of scoped) {
      const haystack = haystackOf(entry);
      let score = 0;
      let matched = true;
      for (const token of tokens) {
        const value = tokenScore(haystack, token);
        if (value === null) {
          matched = false;
          break;
        }
        score += value;
      }
      if (matched) matches.push({ entry, score });
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.ko !== b.entry.ko) return a.entry.ko < b.entry.ko ? -1 : 1;
    if (a.entry.courseSlug !== b.entry.courseSlug) return a.entry.courseSlug < b.entry.courseSlug ? -1 : 1;
    return a.entry.lessonId < b.entry.lessonId ? -1 : 1;
  });

  return {
    entries: matches.slice(offset, offset + limit).map((match) => match.entry),
    total: matches.length,
  };
}

/**
 * Conteggi per corso, nell'ordine in cui il curricolo li elenca: sono le
 * etichette dei filtri della pagina dizionario.
 */
export function vocabFacets(entries: readonly VocabEntry[]): VocabFilterOption[] {
  const order: string[] = [];
  const counts = new Map<string, VocabFilterOption>();

  for (const entry of entries) {
    const known = counts.get(entry.courseSlug);
    if (known) {
      known.count += 1;
      continue;
    }
    counts.set(entry.courseSlug, {
      slug: entry.courseSlug,
      title: entry.courseTitle,
      count: 1,
    });
    order.push(entry.courseSlug);
  }

  return order.map((slug) => counts.get(slug)!);
}
