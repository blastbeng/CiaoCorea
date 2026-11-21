import { z } from 'zod';
import { CLOZE_MARKER } from '@ciaocorea/shared';

/**
 * Il curricolo è un dato, non codice: qui sta il contratto che ogni corso
 * deve rispettare. Se un file JSON non passa questa validazione l'app non parte,
 * così un contenuto rotto non arriva mai agli studenti.
 */

export const vocabItemSchema = z.object({
  ko: z.string().min(1, 'la forma coreana è obbligatoria'),
  it: z.string().min(1, 'il significato italiano è obbligatorio'),
  rr: z.string().min(1, 'la romanizzazione è obbligatoria'),
});

const exerciseBase = {
  id: z.string().min(2).regex(/^[a-z0-9-]+$/, 'id esercizio: solo minuscole, cifre e trattini'),
  prompt: z.string().min(5),
  hint: z.string().min(3).optional(),
  explain: z.string().min(5).optional(),
};

export const exerciseSchema = z.discriminatedUnion('type', [
  z.object({
    ...exerciseBase,
    type: z.literal('jamo_choice'),
    options: z.array(z.string().min(1)).min(2).max(6),
    answer: z.string().min(1),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('block_build'),
    parts: z.array(z.string().min(1)).min(2).max(4),
    answer: z.string().min(1),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('type_hangul'),
    answer: z.string().min(1),
    accept: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('listen_type'),
    speak: z.string().min(1),
    answer: z.string().min(1),
    accept: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('reading_mcq'),
    options: z.array(z.string().min(1)).min(2).max(6),
    answer: z.string().min(1),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('type_meaning'),
    answer: z.string().min(1),
    accept: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('type_reading'),
    /** Il testo coreano da leggere: è la consegna, non la soluzione. */
    text: z.string().min(1),
    answer: z.string().min(1),
    accept: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('order_words'),
    words: z.array(z.string().min(1)).min(2).max(8),
    answer: z.string().min(3),
  }),
  z.object({
    ...exerciseBase,
    type: z.literal('fill_blank'),
    text: z.string().min(5),
    options: z.array(z.string().min(1)).min(2).max(6).optional(),
    answer: z.string().min(1),
    accept: z.array(z.string().min(1)).optional(),
  }),
]);

/**
 * Il brano di una lezione di lettura: testo coreano, glossario delle parole
 * difficili, traduzione. La traduzione è nel dato perché il brano è materiale
 * di studio, non soluzione; è l'interfaccia a tenerla chiusa fino a che la
 * lezione non è stata affrontata.
 */
export const passageSchema = z.object({
  title: z.string().min(3),
  lines: z.array(z.string().min(3)).min(2).max(14),
  gloss: z.array(vocabItemSchema).min(1).max(14),
  translation: z.string().min(20),
});

export const lessonSchema = z.object({
  id: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'id lezione: solo minuscole, cifre e trattini'),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'slug: solo minuscole, cifre e trattini'),
  title: z.string().min(3),
  titleKo: z.string().min(1),
  kind: z.enum(['letters', 'syllables', 'reading', 'grammar', 'vocab', 'review']),
  goal: z.string().min(10),
  durationMin: z.number().int().min(1).max(120),
  points: z.array(z.string().min(10)).min(2).max(8),
  vocab: z.array(vocabItemSchema).min(1).max(20),
  passages: z.array(passageSchema).min(1).max(3).optional(),
  exercises: z.array(exerciseSchema).min(4).max(24),
});

export const unitSchema = z.object({
  id: z.string().min(2).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  purpose: z.string().min(10),
  lessons: z.array(lessonSchema).min(1),
});

export const courseSchema = z.object({
  id: z.string().min(2).regex(/^[a-z0-9-]+$/),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  subtitle: z.string().min(3),
  level: z.string().min(2),
  description: z.string().min(10),
  units: z.array(unitSchema).min(1),
});

export type CourseInput = z.infer<typeof courseSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type UnitInput = z.infer<typeof unitSchema>;

export interface CurriculumProblem {
  where: string;
  message: string;
}

/**
 * Oltre allo schema controlla le regole che zod non può esprimere:
 * identificativi unici, niente sillabe duplicate, coerenza degli slug.
 */
export function validateCourse(raw: unknown, source: string): CurriculumProblem[] {
  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      where: `${source}:${issue.path.join('.') || '(radice)'}`,
      message: issue.message,
    }));
  }

  const course = parsed.data;
  const problems: CurriculumProblem[] = [];
  const lessonIds = new Set<string>();
  const lessonSlugs = new Set<string>();
  const unitIds = new Set<string>();
  const exerciseIds = new Set<string>();

  for (const unit of course.units) {
    if (unitIds.has(unit.id)) {
      problems.push({ where: `${source}:${unit.id}`, message: 'unità duplicata' });
    }
    unitIds.add(unit.id);

    for (const lesson of unit.lessons) {
      if (lessonIds.has(lesson.id)) {
        problems.push({ where: `${source}:${lesson.id}`, message: 'id lezione duplicato' });
      }
      if (lessonSlugs.has(lesson.slug)) {
        problems.push({ where: `${source}:${lesson.slug}`, message: 'slug lezione duplicato' });
      }
      lessonIds.add(lesson.id);
      lessonSlugs.add(lesson.slug);

      if (!/\p{Script=Hangul}/u.test(lesson.titleKo)) {
        problems.push({
          where: `${source}:${lesson.id}.titleKo`,
          message: 'il titolo coreano deve contenere Hangul',
        });
      }

      for (const item of lesson.vocab) {
        if (!/\p{Script=Hangul}/u.test(item.ko)) {
          problems.push({
            where: `${source}:${lesson.id}.vocab.${item.ko}`,
            message: 'la voce coreana deve contenere Hangul',
          });
        }
      }

      if (lesson.kind === 'reading' && !lesson.passages) {
        problems.push({
          where: `${source}:${lesson.id}`,
          message: 'una lezione di lettura deve portare almeno un brano',
        });
      }

      (lesson.passages ?? []).forEach((passage, index) => {
        const where = `${source}:${lesson.id}.passages[${index}]`;

        for (const line of passage.lines) {
          if (!/\p{Script=Hangul}/u.test(line)) {
            problems.push({ where, message: 'ogni riga del brano deve contenere Hangul' });
            break;
          }
        }

        for (const item of passage.gloss) {
          if (!/\p{Script=Hangul}/u.test(item.ko)) {
            problems.push({ where, message: 'il glossario del brano deve essere in Hangul' });
            break;
          }
        }
      });

      for (const exercise of lesson.exercises) {
        if (exerciseIds.has(exercise.id)) {
          problems.push({
            where: `${source}:${lesson.id}.exercises.${exercise.id}`,
            message: 'id esercizio duplicato (deve essere unico in tutto il curricolo)',
          });
        }
        exerciseIds.add(exercise.id);

        if (exercise.type === 'jamo_choice' || exercise.type === 'reading_mcq') {
          if (!exercise.options.includes(exercise.answer)) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'la risposta corretta deve comparire fra le opzioni',
            });
          }
          if (new Set(exercise.options).size !== exercise.options.length) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'opzioni duplicate',
            });
          }
        }

        if (exercise.type === 'block_build') {
          if (!/\p{Script=Hangul}/u.test(exercise.answer)) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'la soluzione deve essere in Hangul',
            });
          }
          if (!exercise.parts.every((part) => /\p{Script=Hangul}/u.test(part))) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'i pezzi da comporre devono essere jamo Hangul',
            });
          }
        }

        if (exercise.type === 'type_hangul' && !/\p{Script=Hangul}/u.test(exercise.answer)) {
          problems.push({
            where: `${source}:${exercise.id}`,
            message: 'la soluzione attesa deve essere in Hangul',
          });
        }

        if (exercise.type === 'listen_type') {
          if (!/\p{Script=Hangul}/u.test(exercise.speak)) {
            problems.push({
              where: `${source}:${exercise.id}.speak`,
              message: 'il testo da ascoltare deve contenere Hangul',
            });
          }
          if (!/\p{Script=Hangul}/u.test(exercise.answer)) {
            problems.push({
              where: `${source}:${exercise.id}.answer`,
              message: 'la soluzione attesa deve essere in Hangul',
            });
          }
        }

        if (exercise.type === 'order_words') {
          const tiles = [...exercise.words].sort();
          const sentence = exercise.answer.split(/\s+/).filter(Boolean).sort();
          if (tiles.join('|') !== sentence.join('|')) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'la frase corretta deve usare esattamente le tessere date',
            });
          }
          if (!exercise.words.every((word) => /\p{Script=Hangul}/u.test(word))) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'le tessere devono essere parole in Hangul',
            });
          }
        }

        if (exercise.type === 'fill_blank') {
          if (!exercise.text.includes(CLOZE_MARKER)) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: `il testo del buco deve contenere "${CLOZE_MARKER}"`,
            });
          }
          if (!/\p{Script=Hangul}/u.test(exercise.answer)) {
            problems.push({
              where: `${source}:${exercise.id}`,
              message: 'la parola da inserire deve essere in Hangul',
            });
          }
          if (exercise.options) {
            if (!exercise.options.includes(exercise.answer)) {
              problems.push({
                where: `${source}:${exercise.id}`,
                message: 'la risposta deve comparire fra le opzioni',
              });
            }
            if (new Set(exercise.options).size !== exercise.options.length) {
              problems.push({ where: `${source}:${exercise.id}`, message: 'opzioni duplicate' });
            }
          }
        }
      }
    }
  }

  return problems;
}
