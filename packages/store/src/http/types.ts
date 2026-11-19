/**
 * La fetta di Fastify che le rotte usano davvero. Non è un clone del
 * framework: sono i campi della richiesta e i metodi della risposta che
 * compaiono nelle rotte portate nel browser. Tenerli espliciti è ciò che
 * permette a quei file di restare identici a quelli del server.
 */

/**
 * Nel browser il cookie di sessione non esiste: lo store ne legge il valore e
 * lo traduce nella sessione locale. Resta solo `path`, l'unica opzione che le
 * rotte passano.
 */
export interface CookieOptions {
  path?: string;
}

export type Headers = Record<string, string | undefined>;

export interface Logger {
  error: (error: unknown, message?: string) => void;
}

export interface FastifyRequest {
  params: unknown;
  query: unknown;
  body: unknown;
  headers: Headers;
  log: Logger;
}

export interface FastifyReply {
  code: (status: number) => FastifyReply;
  send: (body?: unknown) => FastifyReply;
  setCookie: (name: string, value: string, options?: CookieOptions) => FastifyReply;
  clearCookie: (name: string, options?: CookieOptions) => FastifyReply;
}

export type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => unknown | Promise<unknown>;

export type PreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => unknown | Promise<unknown>;

export interface RouteOptions {
  preHandler?: PreHandler | PreHandler[];
}

export interface FastifyInstance {
  get: {
    (path: string, handler: RouteHandler): void;
    (path: string, options: RouteOptions, handler: RouteHandler): void;
  };
  post: {
    (path: string, handler: RouteHandler): void;
    (path: string, options: RouteOptions, handler: RouteHandler): void;
  };
}
