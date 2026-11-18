import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './auth';

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: T; error: null };

/**
 * Caricamento con reload manuale. `deps` identifica la richiesta: quando
 * cambia si ricarica, senza ripetere in ogni pagina lo stesso stato
 * loading/error/ready.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', data: null, error: null });
    load()
      .then((data) => {
        if (active) setState({ status: 'ready', data, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
    // `load` è ricreata a ogni render; la chiave vera è deps + nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, reload };
}
