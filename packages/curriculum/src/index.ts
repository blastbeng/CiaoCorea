import type { Course, Dialogue, Lesson, VocabEntry, WritingPrompt } from '@ciaocorea/shared';
import hangulRaw from '../data/courses/hangul.json';
import grammaticaRaw from '../data/courses/grammatica.json';
import lessicoRaw from '../data/courses/lessico.json';
import messaggiRaw from '../data/courses/messaggi.json';
import a2Raw from '../data/courses/a2.json';
import b1Raw from '../data/courses/b1.json';
import dialoguesRaw from '../data/dialogues.json';
import writingRaw from '../data/writing.json';
import { courseSchema, validateCourse, type CurriculumProblem } from './schema';
import { dialogueSchema, validateDialogue } from './dialogue-schema';
import { validateWriting, writingPromptSchema } from './writing-schema';

interface RawCourse {
  source: string;
  raw: unknown;
}

/**
 * I corsi sono importati staticamente: finiscono dentro il bundle del server e
 * non dipendono da percorsi su disco (che in container cambiano sempre).
 * Aggiungere un corso = aggiungere un JSON qui e ri-eseguire i test.
 */
const RAW_COURSES: RawCourse[] = [
  { source: 'hangul.json', raw: hangulRaw },
  { source: 'grammatica.json', raw: grammaticaRaw },
  { source: 'lessico.json', raw: lessicoRaw },
  { source: 'messaggi.json', raw: messaggiRaw },
  { source: 'a2.json', raw: a2Raw },
  { source: 'b1.json', raw: b1Raw },
];

export class CurriculumError extends Error {
  constructor(message: string, readonly problems: string[]) {
    super(message);
    this.name = 'CurriculumError';
  }
}

let cached: Course[] | null = null;

export function getCourses(): Course[] {
  if (cached) return cached;

  const problems = RAW_COURSES.flatMap(({ source, raw }) => validateCourse(raw, source));
  const slugs = new Set<string>();
  for (const { raw } of RAW_COURSES) {
    const parsed = courseSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (slugs.has(parsed.data.slug)) {
      problems.push({ where: parsed.data.slug, message: 'slug corso duplicato' });
    }
    slugs.add(parsed.data.slug);
  }

  if (problems.length > 0) {
    throw new CurriculumError(
      'Curricolo non valido:\n' + problems.map((p) => `  - ${p.where}: ${p.message}`).join('\n'),
      problems.map((p) => `${p.where}: ${p.message}`),
    );
  }

  cached = RAW_COURSES.map(({ raw }) => courseSchema.parse(raw) as Course);
  return cached;
}

export function getCourse(slugOrId: string): Course | undefined {
  return getCourses().find((course) => course.slug === slugOrId || course.id === slugOrId);
}

export function courseLessons(course: Course): Lesson[] {
  return course.units.flatMap((unit) => unit.lessons);
}

export function findLesson(course: Course, lessonId: string): Lesson | undefined {
  return courseLessons(course).find((lesson) => lesson.id === lessonId || lesson.slug === lessonId);
}

/**
 * I dialoghi stanno in un file separato perché non sono lezioni: non hanno
 * esercizi né stato di sblocco, ma una sequenza di battute da recitare. Tenerli
 * fuori dal curricolo evita di piegare lo schema delle lezioni a un caso che
 * non gli appartiene.
 */
let cachedDialogues: Dialogue[] | null = null;

export function getDialogues(): Dialogue[] {
  if (cachedDialogues) return cachedDialogues;

  const raws: unknown[] = Array.isArray(dialoguesRaw) ? dialoguesRaw : [dialoguesRaw];
  const problems: CurriculumProblem[] = [];
  const slugs = new Set<string>();
  const dialogues: Dialogue[] = [];

  raws.forEach((raw, index) => {
    const source = `dialogues.json[${index}]`;
    problems.push(...validateDialogue(raw, source));

    const parsed = dialogueSchema.safeParse(raw);
    if (!parsed.success) return;

    if (slugs.has(parsed.data.slug)) {
      problems.push({ where: parsed.data.slug, message: 'slug dialogo duplicato' });
    }
    slugs.add(parsed.data.slug);
    dialogues.push(parsed.data as Dialogue);
  });

  // Un dialogo che promette di aprire una lezione deve puntare a una lezione
  // che esiste: un link rotto qui significherebbe un'interfaccia che mente.
  for (const dialogue of dialogues) {
    if (!dialogue.after) continue;
    const course = getCourse(dialogue.after.courseSlug);
    if (!course) {
      problems.push({ where: dialogue.slug, message: `after: corso inesistente '${dialogue.after.courseSlug}'` });
      continue;
    }
    if (!findLesson(course, dialogue.after.lessonId)) {
      problems.push({
        where: dialogue.slug,
        message: `after: lezione inesistente '${dialogue.after.lessonId}' in '${dialogue.after.courseSlug}'`,
      });
    }
  }

  if (problems.length > 0) {
    throw new CurriculumError(
      'Dialoghi non validi:\n' + problems.map((p) => `  - ${p.where}: ${p.message}`).join('\n'),
      problems.map((p) => `${p.where}: ${p.message}`),
    );
  }

  cachedDialogues = dialogues;
  return cachedDialogues;
}

export function getDialogue(slug: string): Dialogue | undefined {
  return getDialogues().find((dialogue) => dialogue.slug === slug || dialogue.id === slug);
}

/**
 * Le consegne del quaderno stanno fuori dal corso: non hanno esercizi né stato
 * di sblocco, ma una consegna da svolgere e un modello con cui confrontarsi.
 * Ogni consegna punta alla lezione che insegna le parole che servono: è quella
 * a decidere quando il quaderno si apre.
 */
let cachedWriting: WritingPrompt[] | null = null;

export function getWritingPrompts(): WritingPrompt[] {
  if (cachedWriting) return cachedWriting;

  const raws: unknown[] = Array.isArray(writingRaw) ? writingRaw : [writingRaw];
  const problems: CurriculumProblem[] = [];
  const prompts: WritingPrompt[] = [];
  const ids = new Set<string>();

  raws.forEach((raw, index) => {
    const source = `writing.json[${index}]`;
    problems.push(...validateWriting(raw, source));

    const parsed = writingPromptSchema.safeParse(raw);
    if (!parsed.success) return;

    if (ids.has(parsed.data.id)) {
      problems.push({ where: parsed.data.id, message: 'id consegna duplicato' });
    }
    ids.add(parsed.data.id);

    // Una consegna che punta a una lezione inesistente non si aprirebbe mai:
    // meglio scoprirlo qui che davanti a un quaderno vuoto.
    const course = getCourse(parsed.data.courseSlug);
    if (!course) {
      problems.push({
        where: parsed.data.id,
        message: `corso inesistente '${parsed.data.courseSlug}'`,
      });
    } else if (!findLesson(course, parsed.data.lessonId)) {
      problems.push({
        where: parsed.data.id,
        message: `lezione inesistente '${parsed.data.lessonId}' in '${parsed.data.courseSlug}'`,
      });
    }

    prompts.push(parsed.data as WritingPrompt);
  });

  if (problems.length > 0) {
    throw new CurriculumError(
      'Consegne non valide:\n' + problems.map((p) => `  - ${p.where}: ${p.message}`).join('\n'),
      problems.map((p) => `${p.where}: ${p.message}`),
    );
  }

  cachedWriting = prompts;
  return cachedWriting;
}

export function getWritingPrompt(id: string): WritingPrompt | undefined {
  return getWritingPrompts().find((prompt) => prompt.id === id);
}

/**
 * Il lessico del curricolo, piatto: ogni voce porta con sé da quale corso e
 * quale lezione viene. È la base del dizionario consultabile, così lo studente
 * può cercare una parola trovata in una lezione senza doverla ricordare a
 * memoria. La deduplica tiene la prima comparsa: la stessa parola in due
 * lezioni non ha bisogno di due schede.
 *
 * Ci sono anche le parole dei gloss dei brani di lettura: sono parole che si
 * incontrano leggendo, e cercare quelle è esattamente ciò che si fa con un
 * dizionario.
 */
let cachedVocabulary: VocabEntry[] | null = null;

export function getVocabulary(): VocabEntry[] {
  if (cachedVocabulary) return cachedVocabulary;

  const entries: VocabEntry[] = [];
  const seen = new Set<string>();

  for (const course of getCourses()) {
    for (const lesson of courseLessons(course)) {
      // Il dizionario copre anche i gloss dei brani: sono parole che si
      // incontrano leggendo, e cercarle è ciò che si fa con un dizionario.
      const words = [...lesson.vocab, ...(lesson.passages ?? []).flatMap((passage) => passage.gloss)];
      for (const item of words) {
        const key = `${course.slug}\u0000${item.ko}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({
          ko: item.ko,
          it: item.it,
          rr: item.rr,
          courseSlug: course.slug,
          courseTitle: course.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
      }
    }
  }

  cachedVocabulary = entries;
  return entries;
}
