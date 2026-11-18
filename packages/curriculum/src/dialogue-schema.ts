import { z } from 'zod';
import type { CurriculumProblem } from './schema';

/**
 * I dialoghi sono copioni: ogni battuta è già scritta, il motore si limita a
 * verificare che la risposta dello studente sia una delle forme accettate.
 * Un dialogo generato a runtime non passerebbe mai da qui, ed è voluto.
 */

const HANGUL = /\p{Script=Hangul}/u;

/**
 * Forma confrontabile di una battuta: punto finale e spazi non devono
 * distinguere l'opzione dalla soluzione, altrimenti l'autore scrive la stessa
 * frase in due modi e il validatore lo tratta come un errore.
 */
const form = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:。、！？]+$/u, '')
    .trim();

export const dialogueAnswerSchema = z.object({
  kind: z.enum(['choice', 'type']),
  accept: z.array(z.string().min(1).max(120)).max(8).optional(),
  options: z.array(z.string().min(1).max(120)).min(2).max(6).optional(),
  hint: z.string().min(3).max(160).optional(),
});

export const dialogueTurnSchema = z.object({
  id: z.string().min(2).regex(/^[a-z0-9-]+$/, 'id battuta: solo minuscole, cifre e trattini'),
  speaker: z.string().min(1).max(40),
  ko: z.string().min(1).max(200),
  it: z.string().min(1).max(200),
  note: z.string().min(5).max(400).optional(),
  answer: dialogueAnswerSchema.optional(),
});

/** Lezione che apre il dialogo: è il legame fra Conversazione e Percorso. */
export const dialogueLinkSchema = z.object({
  courseSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'slug corso: solo minuscole, cifre e trattini'),
  lessonId: z.string().min(2).regex(/^[a-z0-9-]+$/, 'id lezione: solo minuscole, cifre e trattini'),
});

export const dialogueSchema = z.object({
  id: z.string().min(3).regex(/^[a-z0-9-]+$/, 'id dialogo: solo minuscole, cifre e trattini'),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'slug dialogo: solo minuscole, cifre e trattini'),
  title: z.string().min(3),
  level: z.string().min(2),
  setting: z.string().min(10),
  goal: z.string().min(10),
  points: z.array(z.string().min(10)).min(2).max(6),
  after: dialogueLinkSchema.optional(),
  turns: z.array(dialogueTurnSchema).min(4).max(30),
});

export type DialogueInput = z.infer<typeof dialogueSchema>;
export type DialogueTurnInput = z.infer<typeof dialogueTurnSchema>;

/** Il nome convenzionale con cui una battuta appartiene allo studente. */
export const STUDENT_SPEAKER = 'Tu';

export function validateDialogue(raw: unknown, source: string): CurriculumProblem[] {
  const parsed = dialogueSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      where: `${source}:${issue.path.join('.') || '(radice)'}`,
      message: issue.message,
    }));
  }

  const dialogue = parsed.data;
  const problems: CurriculumProblem[] = [];
  const seen = new Set<string>();
  let answering = 0;

  for (const turn of dialogue.turns) {
    if (seen.has(turn.id)) {
      problems.push({ where: `${source}:${turn.id}`, message: 'id battuta duplicato' });
    }
    seen.add(turn.id);

    if (!HANGUL.test(turn.ko)) {
      problems.push({ where: `${source}:${turn.id}.ko`, message: 'la battuta deve essere in Hangul' });
    }

    const isStudent = turn.speaker === STUDENT_SPEAKER;
    if (isStudent && !turn.answer) {
      problems.push({
        where: `${source}:${turn.id}`,
        message: 'una battuta di "Tu" deve avere una risposta attesa',
      });
    }
    if (!isStudent && turn.answer) {
      problems.push({
        where: `${source}:${turn.id}`,
        message: 'solo le battute di "Tu" possono avere una risposta attesa',
      });
    }

    if (turn.answer) {
      answering += 1;

      if (!HANGUL.test(turn.ko)) {
        problems.push({
          where: `${source}:${turn.id}`,
          message: 'la risposta attesa deve essere in Hangul',
        });
      }

      if (turn.answer.kind === 'choice') {
        const options = turn.answer.options ?? [];
        if (options.length < 2) {
          problems.push({
            where: `${source}:${turn.id}.answer.options`,
            message: 'una scelta ha bisogno di almeno due opzioni',
          });
        }
        if (!options.some((option) => form(option) === form(turn.ko))) {
          problems.push({
            where: `${source}:${turn.id}.answer`,
            message: 'la forma corretta deve comparire fra le opzioni',
          });
        }
        if (new Set(options.map(form)).size !== options.length) {
          problems.push({
            where: `${source}:${turn.id}.answer.options`,
            message: 'opzioni duplicate',
          });
        }
      }

      for (const variant of turn.answer.accept ?? []) {
        if (!HANGUL.test(variant)) {
          problems.push({
            where: `${source}:${turn.id}.answer.accept`,
            message: `variante non in Hangul: ${variant}`,
          });
        }
      }
    }
  }

  if (answering < 3) {
    problems.push({
      where: `${source}`,
      message: 'un dialogo serve almeno tre battute dello studente',
    });
  }

  return problems;
}
