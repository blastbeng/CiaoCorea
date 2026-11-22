import { LocalApp } from './router';
import type { Ctx } from './context';
import { registerAnalysisRoutes } from '../routes/analysis';
import { registerAuthRoutes } from '../routes/auth';
import { registerChallengeRoutes } from '../routes/challenge';
import { registerDialogueRoutes } from '../routes/dialogues';
import { registerGrammarRoutes } from '../routes/grammar';
import { registerLessonRoutes } from '../routes/lessons';
import { registerMistakeRoutes } from '../routes/mistakes';
import { registerProfileRoutes } from '../routes/profile';
import { registerReadingRoutes } from '../routes/readings';
import { registerSyncRoutes } from '../routes/sync';
import { registerVocabularyRoutes } from '../routes/vocabulary';
import { registerWritingRoutes } from '../routes/writing';

/**
 * Le stesse rotte del server, montate su un router che vive nella scheda. Non
 * c'è nulla da ascoltare su una porta: le chiamate arrivano da `store.call`,
 * che è l'unico punto in cui il client tocca il database.
 */
export async function buildStoreApp(ctx: Ctx): Promise<LocalApp> {
  const app = new LocalApp();

  await registerAuthRoutes(app, ctx);
  await registerLessonRoutes(app, ctx);
  await registerReadingRoutes(app, ctx);
  await registerChallengeRoutes(app, ctx);
  await registerDialogueRoutes(app, ctx);
  await registerVocabularyRoutes(app, ctx);
  await registerAnalysisRoutes(app, ctx);
  await registerGrammarRoutes(app, ctx);
  await registerWritingRoutes(app, ctx);
  await registerMistakeRoutes(app, ctx);
  await registerProfileRoutes(app, ctx);
  await registerSyncRoutes(app, ctx);

  return app;
}
