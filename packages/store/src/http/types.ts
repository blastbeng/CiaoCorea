/**
 * La fetta di Fastify che le rotte usano davvero. Non è un clone del
 * framework: sono i quattro campi della richiesta e i quattro metodi della
 * risposta che compaiono nelle rotte portate nel browser. Tenerli espliciti è
 * ciò che permette a quei file di restare identici a quelli del server.
 */

export interface CookieOptions {
  path?: string;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  expires?: Date;
  maxAge?: number;
}

export type Headers = Record<string, string | undefined>;

export interface Logger {
  error: (error: unknown, message?: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
}

export interface FastifyRequest {
  method: string;
  url: string;
  params: unknown;
  query: unknown;
  body: unknown;
  headers: Headers;
  ip: string;
  log: Logger;
}

export interface FastifyReply {
  code: (status: number) => FastifyReply;
  header: (name: string, value: string) => FastifyReply;
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
