import type { FastifyInstance, FastifyReply, FastifyRequest } from '../http/types';
import { z } from 'zod';
import type { GrammarEntry, GrammarResponse } from '@ciaocorea/shared';
import { courseLessons, getCourses } from '@ciaocorea/curriculum';
import { grammarFacets, searchGrammar } from '@ciaocorea/engine';
import type { Ctx } from '../http/context';
import { requireAuth } from '../auth/guard';

const querySchema = z.object({
  q: z.string().max(80).optional().default(''),
  course: z.string().max(60).optional().default(''),
  limit: z.coerce.number().int().min(1).max(200).optional().default(40),
  offset: z.coerce.number().int().min(0).max(5000).optional().default(0),
});

/**
 * Le forme coreane citate dentro un punto: sono quelle che lo studente
 * ricorda e cerca. Si estrae tutto ciò che è Hangul (con parentesi e trattini,
 * che nelle forme grammaticali contano), si scartano le parole italiane.
 */
function keywords(point: string): string[] {
  const chunks = point.split(/[^\p{Script=Hangul}\s()\-/–]+/u);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const chunk of chunks) {
    const value = chunk.replace(/\s+/g, ' ').trim().replace(/^[-–]+|[-–]+$/g, '');
    if (!/\p{Script=Hangul}/u.test(value)) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

/**
 * Il repertorio si costruisce dal curricolo, una volta sola: nessuno scrive a
 * mano le voci, quindi ciò che si trova cercando è esattamente ciò che le
 * lezioni dicono. Se una spiegazione cambia, cambia anche il repertorio.
 */
let cached: GrammarEntry[] | null = null;

export function grammarEntries(): GrammarEntry[] {
  if (cached) return cached;

  cached = getCourses().flatMap((course) =>
    courseLessons(course).flatMap((lesson) =>
      lesson.points.map((point, index) => ({
        id: `${lesson.id}#${index + 1}`,
        point,
        courseSlug: course.slug,
        courseTitle: course.title,
        level: course.level,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonTitleKo: lesson.titleKo,
        keywords: keywords(point),
      })),
    ),
  );
  return cached;
}

export async function registerGrammarRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.get('/api/grammar', { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', message: 'Parametri di ricerca non validi.' });
    }

    const { q, course, limit, offset } = parsed.data;
    const entries = grammarEntries();

    // I contaggi dei filtri si calcolano senza il filtro di corso: devono dire
    // quante risposte dà ogni corso con la ricerca in corso.
    const unscoped = searchGrammar(entries, { query: q, limit: 5000 });
    const found = searchGrammar(entries, { query: q, courseSlug: course, limit, offset });

    const body: GrammarResponse = {
      entries: found.entries,
      total: found.total,
      curriculum: entries.length,
      courses: grammarFacets(unscoped.entries),
      query: q,
    };
    return reply.send(body);
  });
}
