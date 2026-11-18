import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type {
  LessonState,
  WritingCheckResponse,
  WritingEntry,
  WritingPrompt,
  WritingPromptView,
  WritingResponse,
  WritingStats,
} from '@ciaocorea/shared';
import { checkWriting } from '@ciaocorea/engine';
import { courseLessons, getCourse, getWritingPrompt, getWritingPrompts } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import {
  countWrittenPrompts,
  listWritingEntries,
  saveWritingEntry,
} from '../repo/writing';
import { getProgress } from '../repo/progress';

const bodySchema = z.object({
  text: z.string().min(1).max(400),
});

/**
 * Il quaderno si apre lezione per lezione: una consegna chiede parole che
 * arrivano da una lezione precisa, e scriverle prima di averle incontrate è
 * dettato, non scrittura. Chi salta un corso trova il quaderno già aperto,
 * perché anche saltare è aver visto quelle parole.
 */
function lessonStates(ctx: Ctx, userId: string, courseSlug: string): Map<string, LessonState> {
  const states = new Map<string, LessonState>();
  for (const row of getProgress(ctx.db, userId, courseSlug)) {
    states.set(row.lesson_id, row.state);
  }
  return states;
}

/** Una lezione chiusa, passata o saltata, apre quello che insegna. */
function isClosed(state: LessonState | undefined): boolean {
  return state === 'passed' || state === 'skipped';
}

function isUnlocked(ctx: Ctx, userId: string, prompt: WritingPrompt): boolean {
  return isClosed(lessonStates(ctx, userId, prompt.courseSlug).get(prompt.lessonId));
}

export async function registerWritingRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  const build = (userId: string): WritingResponse => {
    const prompts = getWritingPrompts();
    const entries = listWritingEntries(ctx.db, userId);
    const lastByPrompt = new Map<string, WritingEntry>();
    for (const entry of entries) {
      if (!lastByPrompt.has(entry.promptId)) lastByPrompt.set(entry.promptId, entry);
    }

    // Lo stato delle lezioni si legge una volta per corso: le consegne sono
    // poche, ma ripetere la query per ognuna sarebbe solo rumore.
    const statesByCourse = new Map<string, Map<string, LessonState>>();
    const views: WritingPromptView[] = [];

    for (const prompt of prompts) {
      const course = getCourse(prompt.courseSlug);
      const lesson = course ? courseLessons(course).find((item) => item.id === prompt.lessonId) : undefined;

      let states = statesByCourse.get(prompt.courseSlug);
      if (!states) {
        states = lessonStates(ctx, userId, prompt.courseSlug);
        statesByCourse.set(prompt.courseSlug, states);
      }

      const state = states.get(prompt.lessonId);
      views.push({
        id: prompt.id,
        courseSlug: prompt.courseSlug,
        courseTitle: course?.title ?? prompt.courseSlug,
        lessonId: prompt.lessonId,
        lessonTitle: lesson?.title ?? prompt.lessonId,
        title: prompt.title,
        task: prompt.task,
        words: prompt.words,
        unlocked: isClosed(state),
        last: lastByPrompt.get(prompt.id) ?? null,
      });
    }

    const stats: WritingStats = {
      done: countWrittenPrompts(ctx.db, userId),
      total: prompts.length,
      unlocked: views.filter((view) => view.unlocked).length,
    };

    return { prompts: views, stats };
  };

  app.get('/api/writing', { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request as AuthedRequest;
    return reply.send(build(user.id));
  });

  app.post(
    '/api/writing/:promptId',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;
      const { promptId } = request.params as { promptId: string };

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_body', message: 'Scrivi almeno una parola, al massimo 400 caratteri.' });
      }

      const prompt = getWritingPrompt(promptId);
      if (!prompt) {
        return reply.code(404).send({ error: 'not_found', message: 'Consegna inesistente.' });
      }

      if (!isUnlocked(ctx, user.id, prompt)) {
        return reply.code(403).send({
          error: 'writing_locked',
          message: 'Questa consegna si apre dopo aver chiuso la lezione che insegna quelle parole.',
        });
      }

      const text = parsed.data.text.trim();
      if (text.length === 0) {
        return reply.code(400).send({ error: 'empty_text', message: 'Scrivi almeno una parola.' });
      }

      const check = checkWriting(prompt, text);
      const entry = saveWritingEntry(ctx.db, {
        userId: user.id,
        promptId: prompt.id,
        courseSlug: prompt.courseSlug,
        text,
        verdict: check.verdict,
      });

      const body: WritingCheckResponse = { check, entry, stats: build(user.id).stats };
      return reply.send(body);
    },
  );
}
