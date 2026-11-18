import type { FastifyInstance, FastifyReply, FastifyRequest } from '../http/types';
import { z } from 'zod';
import type {
  Dialogue,
  DialogueAnswerResponse,
  DialogueDetail,
  DialogueLink,
  DialogueListResponse,
  DialogueSummary,
} from '@ciaocorea/shared';
import {
  checkDialogueTurn,
  countAnswerTurns,
  nextAnswerIndex,
  publicTurns,
} from '@ciaocorea/engine';
import { findLesson, getCourse, getDialogue, getDialogues } from '@ciaocorea/curriculum';
import type { Ctx } from '../http/context';
import { requireAuth, type AuthedRequest } from '../auth/guard';
import { isLessonClosed } from '../repo/progress';
import {
  collectDialoguePhrases,
  getDialogueProgress,
  listDialogueProgress,
  restartDialogue,
  saveDialogueProgress,
  type DialogueProgress,
} from '../repo/dialogues';

const answerSchema = z.object({
  response: z.string().max(300),
});

/** Quanti errori sulla stessa battuta prima di rivelare la forma corretta. */
const REVEAL_AFTER = 2;

/**
 * La lezione che apre il dialogo, con i titoli da mostrare. Il curricolo viene
 * validato all'avvio, quindi un link che non resolve è un bug di dati: si
 * restituisce null invece di far cadere la richiesta.
 */
function linkOf(dialogue: Dialogue): DialogueLink | null {
  if (!dialogue.after) return null;
  const course = getCourse(dialogue.after.courseSlug);
  const lesson = course ? findLesson(course, dialogue.after.lessonId) : undefined;
  if (!course || !lesson) return null;
  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
  };
}

function summarize(dialogue: Dialogue, progress: DialogueProgress, locked: boolean): DialogueSummary {
  const totalTurns = countAnswerTurns(dialogue.turns);
  return {
    id: dialogue.id,
    slug: dialogue.slug,
    title: dialogue.title,
    level: dialogue.level,
    setting: dialogue.setting,
    goal: dialogue.goal,
    points: dialogue.points,
    totalTurns,
    answered: progress.answered,
    correct: progress.correct,
    completed: progress.completedAt !== null,
    after: linkOf(dialogue),
    locked,
  };
}

function isLocked(ctx: Ctx, userId: string, dialogue: Dialogue): boolean {
  if (!dialogue.after) return false;
  return !isLessonClosed(ctx.db, userId, dialogue.after.courseSlug, dialogue.after.lessonId);
}

const EMPTY_PROGRESS: DialogueProgress = {
  turnIndex: 0,
  correct: 0,
  answered: 0,
  wrongOnTurn: 0,
  completedAt: null,
};

export async function registerDialogueRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  const auth = requireAuth(ctx);

  app.get('/api/dialogues', { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request as AuthedRequest;
    const progress = listDialogueProgress(ctx.db, user.id);

    const body: DialogueListResponse = {
      dialogues: getDialogues().map((dialogue) =>
        summarize(
          dialogue,
          progress.get(dialogue.slug) ?? EMPTY_PROGRESS,
          isLocked(ctx, user.id, dialogue),
        ),
      ),
    };
    return reply.send(body);
  });

  app.get(
    '/api/dialogues/:slug',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;
      const { slug } = request.params as { slug: string };

      const dialogue = getDialogue(slug);
      if (!dialogue) {
        return reply.code(404).send({ error: 'not_found', message: 'Dialogo inesistente.' });
      }

      const progress = getDialogueProgress(ctx.db, user.id, dialogue.slug);
      const body: DialogueDetail = {
        dialogue: summarize(dialogue, progress, isLocked(ctx, user.id, dialogue)),
        // Tutto ciò che sta prima di turnIndex è già stato recitato: può
        // tornare al client con il coreano. Il resto resta muto.
        turns: publicTurns(dialogue.turns, progress.turnIndex),
        turnIndex: progress.turnIndex,
      };
      return reply.send(body);
    },
  );

  app.post(
    '/api/dialogues/:slug/answer',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;
      const { slug } = request.params as { slug: string };

      const parsed = answerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', message: 'Risposta non valida.' });
      }

      const dialogue = getDialogue(slug);
      if (!dialogue) {
        return reply.code(404).send({ error: 'not_found', message: 'Dialogo inesistente.' });
      }

      if (isLocked(ctx, user.id, dialogue)) {
        const link = linkOf(dialogue);
        return reply.code(409).send({
          error: 'dialogue_locked',
          message: link
            ? `Serve prima la lezione «${link.lessonTitle}» del corso ${link.courseTitle}.`
            : 'Dialogo ancora non disponibile.',
        });
      }

      const progress = getDialogueProgress(ctx.db, user.id, dialogue.slug);
      const total = countAnswerTurns(dialogue.turns);
      const answerIndex = nextAnswerIndex(dialogue.turns, progress.turnIndex);

      // Dialogo già finito: non si riscrive il passato, si riparte da capo.
      if (answerIndex >= dialogue.turns.length) {
        const done: DialogueAnswerResponse = {
          correct: false,
          expected: null,
          note: null,
          turnIndex: progress.turnIndex,
          completed: true,
          correctCount: progress.correct,
          answered: progress.answered,
          total,
          wrong: 0,
        };
        return reply.send(done);
      }

      const turn = dialogue.turns[answerIndex]!;
      const correct = checkDialogueTurn(turn, parsed.data.response);

      let next: DialogueProgress;
      if (correct) {
        // Primo colpo pulito = battuta "saputa"; con errori resta superata ma
        // non conta nel punteggio, così il numero dice qualcosa di vero.
        next = {
          turnIndex: answerIndex + 1,
          correct: progress.correct + (progress.wrongOnTurn === 0 ? 1 : 0),
          answered: progress.answered + 1,
          wrongOnTurn: 0,
          completedAt: progress.completedAt,
        };
        // Il dialogo finisce quando non restano battute da recitare: dopo
        // l'ultima risposta possono ancora esserci battute del personaggio.
        if (nextAnswerIndex(dialogue.turns, next.turnIndex) >= dialogue.turns.length) {
          // A dialogo finito il cursore sta in fondo: tutte le battute, comprese
          // le ultime del personaggio, tornano visibili al reload.
          next.turnIndex = dialogue.turns.length;
          next.completedAt = new Date().toISOString();
        }
      } else {
        next = {
          ...progress,
          wrongOnTurn: progress.wrongOnTurn + 1,
        };
      }

      saveDialogueProgress(ctx.db, user.id, dialogue.slug, next);

      if (!progress.completedAt && next.completedAt) {
        collectDialoguePhrases(ctx.db, user.id, dialogue);
      }

      const body: DialogueAnswerResponse = {
        correct,
        // La forma corretta esce solo quando serve: risposta giusta o troppi
        // errori sulla stessa battuta.
        expected: correct || next.wrongOnTurn >= REVEAL_AFTER ? turn.ko : null,
        note: correct || next.wrongOnTurn >= REVEAL_AFTER ? (turn.note ?? null) : null,
        turnIndex: next.turnIndex,
        completed: next.completedAt !== null,
        correctCount: next.correct,
        answered: next.answered,
        total,
        wrong: next.wrongOnTurn,
      };
      return reply.send(body);
    },
  );

  app.post(
    '/api/dialogues/:slug/restart',
    { preHandler: auth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user } = request as AuthedRequest;
      const { slug } = request.params as { slug: string };

      const dialogue = getDialogue(slug);
      if (!dialogue) {
        return reply.code(404).send({ error: 'not_found', message: 'Dialogo inesistente.' });
      }

      restartDialogue(ctx.db, user.id, dialogue.slug);
      const body: DialogueDetail = {
        dialogue: summarize(dialogue, EMPTY_PROGRESS, isLocked(ctx, user.id, dialogue)),
        turns: publicTurns(dialogue.turns, 0),
        turnIndex: 0,
      };
      return reply.send(body);
    },
  );
}
