import type { GrammarEntry, VocabFilterOption } from '@ciaocorea/shared';

/**
 * Il repertorio grammaticale è il curricolo letto per punti invece che per
 * lezioni: ogni spiegazione diventa una voce cercabile. Serve a rispondere a
 * «dove l'avevo letto?» senza riaprire i corsi uno per uno.
 *
 * La ricerca è volutamente ingenua: tutte le parole cercate devono comparire
 * nella voce. Non è un motore semantico, è un indice — e per un indice la
 * prevedibilità conta più della potenza.
 */

export interface GrammarSearchOptions {
  query?: string;
  courseSlug?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 40;

/** Testo confrontabile: minuscole, spazi normalizzati. */
function plain(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Le parole cercate: spazi e trattini non distinguono una forma dall'altra. */
function terms(query: string): string[] {
  return plain(query)
    .split(/[\s,;]+/)
    .map((term) => term.replace(/^[-–—]+|[-–—]+$/g, ''))
    .filter((term) => term.length > 0);
}

function haystack(entry: GrammarEntry): string {
  return plain(
    [entry.point, entry.lessonTitle, entry.lessonTitleKo, entry.courseTitle, ...entry.keywords].join(' \n '),
  );
}

export function searchGrammar(
  entries: readonly GrammarEntry[],
  options: GrammarSearchOptions = {},
): { entries: GrammarEntry[]; total: number } {
  const wanted = terms(options.query ?? '');
  const course = options.courseSlug?.trim() ?? '';

  const matched = entries.filter((entry) => {
    if (course && entry.courseSlug !== course) return false;
    if (wanted.length === 0) return true;
    const text = haystack(entry);
    return wanted.every((term) => text.includes(term));
  });

  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);

  return { entries: matched.slice(offset, offset + limit), total: matched.length };
}

/** Quante voci porta ogni corso: le etichette dei filtri devono dire la verità. */
export function grammarFacets(entries: readonly GrammarEntry[]): VocabFilterOption[] {
  const counts = new Map<string, VocabFilterOption>();
  for (const entry of entries) {
    const current = counts.get(entry.courseSlug);
    if (current) {
      current.count += 1;
    } else {
      counts.set(entry.courseSlug, {
        slug: entry.courseSlug,
        title: entry.courseTitle,
        count: 1,
      });
    }
  }
  return [...counts.values()];
}
