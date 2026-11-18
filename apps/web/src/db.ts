import { createStore, type Store } from '@ciaocorea/store';
// Vite copia il wasm fra gli asset e ne riscrive l'URL col nome con l'hash:
// senza questo import il browser cercherebbe un file che nel pacchetto non c'è.
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

/**
 * Un solo database per scheda. `createStore` è asincrono perché deve caricare
 * SQLite e rileggere i byte da IndexedDB; la promessa si condivide, così due
 * componenti che partono insieme non aprono due database.
 */
let opening: Promise<Store> | null = null;

export function getStore(): Promise<Store> {
  if (!opening) {
    opening = createStore({ wasmUrl }).catch((error: unknown) => {
      // Un avvio fallito non deve restare in cache: ricaricare la pagina deve
      // poter riprovare.
      opening = null;
      throw error;
    });
  }
  return opening;
}
