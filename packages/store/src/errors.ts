/**
 * Lo stesso errore che il client riceveva dal server: status, codice e
 * messaggio in italiano. Le pagine mostrano `message` e usano `code` solo per
 * distinguere i casi che vanno trattati (sessione scaduta, lezione chiusa).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  const parsed = (body ?? {}) as { error?: string; message?: string };
  return new ApiError(status, parsed.error ?? 'error', parsed.message ?? `Errore ${status}`);
}
