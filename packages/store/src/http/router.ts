import type {
  CookieOptions,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  PreHandler,
  RouteHandler,
  RouteOptions,
} from './types';

/**
 * Un router da poche centinaia di righe che parla la stessa lingua delle rotte:
 * `app.get('/api/courses/:slug', { preHandler }, handler)`. Le rotte sono state
 * portate dal server senza riscriverle, e questo è il prezzo minimo per farlo:
 * un matcher di percorsi e una risposta con `code`/`send`.
 */

export interface RouteResult {
  status: number;
  body: unknown;
  /** I cookie scritti dalla rotta: il client li traduce in sessione locale. */
  cookies: Map<string, string | null>;
}

const NO_LOG = {
  error: () => undefined,
};

class StoreReply implements FastifyReply {
  status = 200;
  body: unknown = undefined;
  sent = false;
  readonly cookies = new Map<string, string | null>();

  code(status: number): FastifyReply {
    this.status = status;
    return this;
  }

  send(body?: unknown): FastifyReply {
    this.body = body;
    this.sent = true;
    return this;
  }

  setCookie(name: string, value: string, _options?: CookieOptions): FastifyReply {
    this.cookies.set(name, value);
    return this;
  }

  clearCookie(name: string, _options?: CookieOptions): FastifyReply {
    this.cookies.set(name, null);
    return this;
  }
}

interface CompiledRoute {
  method: 'GET' | 'POST';
  segments: string[];
  handler: RouteHandler;
  preHandlers: PreHandler[];
}

function compile(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

/** Percorso della richiesta senza query string, in segmenti. */
function requestSegments(url: string): string[] {
  const withoutQuery = url.split('?')[0] ?? '';
  return compile(withoutQuery);
}

function match(route: CompiledRoute, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i += 1) {
    const expected = route.segments[i]!;
    const actual = segments[i]!;

    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }

  return params;
}

function queryOf(url: string): Record<string, string> {
  const index = url.indexOf('?');
  if (index === -1) return {};

  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(url.slice(index + 1))) query[key] = value;
  return query;
}

export class LocalApp implements FastifyInstance {
  private readonly routes: CompiledRoute[] = [];

  get(path: string, handlerOrOptions: RouteHandler | RouteOptions, handler?: RouteHandler): void {
    this.add('GET', path, handlerOrOptions, handler);
  }

  post(path: string, handlerOrOptions: RouteHandler | RouteOptions, handler?: RouteHandler): void {
    this.add('POST', path, handlerOrOptions, handler);
  }

  private add(
    method: 'GET' | 'POST',
    path: string,
    handlerOrOptions: RouteHandler | RouteOptions,
    handler?: RouteHandler,
  ): void {
    const options = typeof handlerOrOptions === 'function' ? undefined : handlerOrOptions;
    const routeHandler = typeof handlerOrOptions === 'function' ? handlerOrOptions : handler;

    if (!routeHandler) throw new Error(`Rotta ${method} ${path} senza handler`);

    const preHandlers = options?.preHandler
      ? Array.isArray(options.preHandler)
        ? options.preHandler
        : [options.preHandler]
      : [];

    this.routes.push({ method, segments: compile(path), handler: routeHandler, preHandlers });
  }

  async handle(input: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string | undefined>;
  }): Promise<RouteResult> {
    const method = input.method.toUpperCase() as 'GET' | 'POST';
    const segments = requestSegments(input.url);
    const reply = new StoreReply();

    const request: FastifyRequest = {
      params: {},
      query: queryOf(input.url),
      body: input.body ?? null,
      headers: input.headers ?? {},
      log: NO_LOG,
    };

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = match(route, segments);
      if (!params) continue;

      request.params = params;

      try {
        for (const preHandler of route.preHandlers) {
          await preHandler(request, reply);
          if (reply.sent) return { status: reply.status, body: reply.body, cookies: reply.cookies };
        }

        const result = await route.handler(request, reply);
        if (reply.sent) return { status: reply.status, body: reply.body, cookies: reply.cookies };

        return { status: result === undefined ? 204 : 200, body: result, cookies: reply.cookies };
      } catch (error) {
        // Un 500 qui è un bug, non un caso previsto: il chiamante riceve lo
        // stesso corpo uniforme del server e la console dice il resto.
        console.error('Errore nella rotta', method, input.url, error);
        return {
          status: 500,
          body: { error: 'internal_error', message: 'Errore interno del portale.' },
          cookies: reply.cookies,
        };
      }
    }

    return {
      status: 404,
      body: { error: 'not_found', message: 'Risorsa inesistente.' },
      cookies: reply.cookies,
    };
  }
}
