import { z } from 'zod';
import type { CurriculumProblem } from './schema';

/**
 * Le consegne del quaderno: uno scrive, e il controllo confronta il testo con
 * il modello. Perché il confronto funzioni, il modello deve contenere tutte le
 * forme obbligatorie — se una manca, nessuno studente potrà mai passare, e
 * l'errore è dell'autore, non dello studente. Il validatore lo verifica qui.
 */

const HANGUL = /\p{Script=Hangul}/u;

/** Forma confrontabile: spazi e punteggiatura non distinguono le parole. */
const compact = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/[.,!?;:。、！？]+$/u, '');

export const writingPromptSchema = z.object({
  id: z.string().min(3).regex(/^[a-z0-9-]+$/, 'id consegna: solo minuscole, cifre e trattini'),
  courseSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'slug corso: solo minuscole, cifre e trattini'),
  lessonId: z.string().min(2).regex(/^[a-z0-9-]+$/, 'id lezione: solo minuscole, cifre e trattini'),
  title: z.string().min(3).max(80),
  task: z.string().min(10).max(300),
  words: z.array(z.string().min(1).max(40)).max(10).default([]),
  must: z.array(z.string().min(1).max(40)).max(8).default([]),
  model: z.string().min(1).max(300),
  alt: z.array(z.string().min(1).max(300)).max(5).optional(),
  notes: z.string().min(10).max(500).optional(),
});

export type WritingPromptInput = z.infer<typeof writingPromptSchema>;

export function validateWriting(raw: unknown, source: string): CurriculumProblem[] {
  const parsed = writingPromptSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      where: `${source}:${issue.path.join('.') || '(radice)'}`,
      message: issue.message,
    }));
  }

  const prompt = parsed.data;
  const problems: CurriculumProblem[] = [];

  const versions = [prompt.model, ...(prompt.alt ?? [])];
  for (const version of versions) {
    if (!HANGUL.test(version)) {
      problems.push({ where: `${source}:${prompt.id}.model`, message: 'il modello deve essere in Hangul' });
    }
  }

  const duplicated = duplicates(versions);
  for (const variant of prompt.alt ?? []) {
    if (duplicated.has(compact(variant))) {
      problems.push({ where: `${source}:${prompt.id}.alt`, message: `variante duplicata: ${variant}` });
    }
  }

  // Una forma obbligatoria che non compare in nessun modello rende la consegna
  // impossibile: chi scrive bene prenderebbe comunque un "manca".
  for (const token of prompt.must) {
    const present = versions.some((version) => compact(version).includes(compact(token)));
    if (!present) {
      problems.push({
        where: `${source}:${prompt.id}.must`,
        message: `la forma «${token}» non compare nel modello`,
      });
    }
  }

  for (const word of prompt.words) {
    if (!HANGUL.test(word)) {
      problems.push({
        where: `${source}:${prompt.id}.words`,
        message: `parola suggerita non in Hangul: ${word}`,
      });
    }
  }

  return problems;
}

/** Le forme che compaiono più di una volta: due modelli identici sono un doppione. */
function duplicates(versions: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const version of versions) {
    const key = compact(version);
    if (seen.has(key)) duplicated.add(key);
    seen.add(key);
  }
  return duplicated;
}
