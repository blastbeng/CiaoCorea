/**
 * Pezzi di interfaccia che non hanno bisogno di React: si possono provare con
 * un test, come la composizione del Hangul.
 */
import type { MatchPairsExercise } from '@ciaocorea/shared';

/**
 * Le tessere ancora da toccare in un `order_words`: ogni parola già messa
 * nell'assembly ne consuma una, così le parole duplicate restano contate una
 * per una e non spariscono dalla fila. L'`index` è la posizione nella lista
 * originale, ed è quello che il client usa come chiave.
 */
export function remainingTiles(
  words: readonly string[],
  taken: readonly string[],
): { word: string; index: number }[] {
  const consumed = new Map<string, number>();
  for (const word of taken) consumed.set(word, (consumed.get(word) ?? 0) + 1);

  const left: { word: string; index: number }[] = [];
  words.forEach((word, index) => {
    const pending = consumed.get(word) ?? 0;
    if (pending > 0) {
      consumed.set(word, pending - 1);
      return;
    }
    left.push({ word, index });
  });
  return left;
}

/**
 * La frase di un `fill_blank` attorno al buco: prima e dopo. Un testo senza
 * marker finisce tutto nella prima parte, così la pagina non esplode su un
 * contenuto scritto male.
 */
export function splitCloze(text: string, marker: string): { before: string; after: string } {
  const at = text.indexOf(marker);
  if (at < 0) return { before: text, after: '' };
  return { before: text.slice(0, at), after: text.slice(at + marker.length) };
}

/** Una riga delle colonne di «collega», con l'indice della sua coppia. */
export interface MatchRow {
  index: number;
  ko: string;
  it: string;
}

/** Un seme dall'id dell'esercizio: lo stesso numero, sempre. */
function seedFrom(id: string): number {
  let hash = 2166136261;
  for (const char of id) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mescolata Fisher-Yates con un seme: deterministica, senza Math.random. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Le due colonne di un «collega»: quella fissa nell'ordine dei dati, l'altra
 * mescolata col seme dell'id. Due esercizi diversi escono in ordine diverso,
 * ma lo stesso esercizio esce sempre nello stesso ordine: una schermata che si
 * ricompone non deve spostare le righe sotto le dita, e chi riprova dopo un
 * errore non si trova la soluzione già scritta.
 *
 * Se la mescolata coincide con l'ordine dei dati le righe si ruotano di una:
 * la colonna mobile non dev'essere già la risposta.
 */
export function matchColumns(exercise: MatchPairsExercise): { fixed: MatchRow[]; movable: MatchRow[] } {
  const rows: MatchRow[] = exercise.pairs.map((pair, index) => ({ index, ko: pair.ko, it: pair.it }));
  let movable = shuffled(rows, seedFrom(exercise.id));
  if (movable.every((row, position) => row.index === position)) {
    movable = [...movable.slice(1), movable[0]];
  }
  return { fixed: rows, movable };
}
