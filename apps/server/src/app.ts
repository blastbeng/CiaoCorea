import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { AppConfig } from './config';
import type { Db } from './db/client';
import type { Ctx } from './http/context';
import { registerAuthRoutes } from './routes/auth';
import { registerDialogueRoutes } from './routes/dialogues';
import { registerLessonRoutes } from './routes/lessons';
import { registerProfileRoutes } from './routes/profile';
import { registerVocabularyRoutes } from './routes/vocabulary';

export interface BuildAppOptions {
  db: Db;
  config: AppConfig;
  logger?: boolean;
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

export async function buildApp({ db, config, logger = false }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ? { level: config.nodeEnv === 'production' ? 'info' : 'debug' } : false,
    trustProxy: true,
    bodyLimit: 128 * 1024,
  });

  const ctx: Ctx = { db, config };

  await app.register(cookie);

  app.addHook('onSend', async (_request, reply) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(name, value);
    }
    return undefined;
  });

  /**
   * Difesa CSRF senza token: i cookie sono SameSite=Lax, e qui si rifiuta
   * qualunque scrittura che arrivi da un'origine diversa dalla nostra.
   */
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return undefined;

    const origin = request.headers.origin;
    if (!origin) return undefined;

    const host = request.headers.host;
    try {
      if (host && new URL(origin).host !== host) {
        return reply.code(403).send({ error: 'bad_origin', message: 'Origine non consentita.' });
      }
    } catch {
      return reply.code(403).send({ error: 'bad_origin', message: 'Origine non valida.' });
    }
    return undefined;
  });

  app.get('/api/health', async (_request, reply) => {
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    return reply.send({
      ok: row?.ok === 1,
      service: 'ciaocorea',
      version: process.env.APP_VERSION ?? '0.1.0',
      time: new Date().toISOString(),
    });
  });

  await registerAuthRoutes(app, ctx);
  await registerLessonRoutes(app, ctx);
  await registerDialogueRoutes(app, ctx);
  await registerVocabularyRoutes(app, ctx);
  await registerProfileRoutes(app, ctx);

  const indexFile = path.join(config.webDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    await app.register(fastifyStatic, {
      root: config.webDist,
      prefix: '/',
      wildcard: false,
      index: ['index.html'],
      // Gli asset hanno l'hash nel nome: cache lunga, HTML mai in cache.
      setHeaders: (response, filePath) => {
        const isAsset = filePath.includes(`${path.sep}assets${path.sep}`);
        response.setHeader(
          'cache-control',
          isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found', message: 'Risorsa inesistente.' });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return reply.code(404).send({ error: 'not_found', message: 'Risorsa inesistente.' });
      }
      // SPA: qualunque percorso non-API torna l'app, che decide la pagina.
      reply.header('cache-control', 'no-cache');
      return reply.sendFile('index.html');
    });
  } else if (config.nodeEnv !== 'test') {
    app.log.warn(
      `Nessun file ${indexFile}: il server parte solo con le API (in sviluppo usa Vite con proxy).`,
    );
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (reply.sent) return reply;
    return reply.code(500).send({ error: 'internal_error', message: 'Errore interno del server.' });
  });

  return app;
}
