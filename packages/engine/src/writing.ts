import type { WritingCheck, WritingPrompt } from '@ciaocorea/shared';
import { compact } from './normalize';

/**
 * Un testo libero non ha una risposta giusta da confrontare: si può solo dire
 * quanto somiglia al modello e che cosa manca. Sotto questa soglia il testo è
 * troppo lontano perché il confronto dica qualcosa di utile, e conviene
 * rileggere il modello invece di contare le differenze.
 */
export const WRITING_CLOSE_RATIO = 0.6;

/** Distanza di Levenshtein fra due stringhe, carattere per carattere. */
export function editDistance(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/** Somiglianza fra due testi, da 0 a 1; 1 significa identici. */
export function similarity(a: string, b: string): number {
  const left = compact(a);
  const right = compact(b);
  const longest = Math.max(Array.from(left).length, Array.from(right).length);
  if (longest === 0) return 0;
  return 1 - editDistance(left, right) / longest;
}

/**
 * Il confronto con il modello. Le forme obbligatorie si cercano dentro il
 * testo: se ne manca una, dirlo è più utile che dare una percentuale.
 */
export function checkWriting(prompt: WritingPrompt, answer: string): WritingCheck {
  const versions = [prompt.model, ...(prompt.alt ?? [])];
  const written = compact(answer);

  const missing = prompt.must.filter((token) => !written.includes(compact(token)));

  let best = 0;
  for (const version of versions) {
    best = Math.max(best, similarity(answer, version));
  }

  const verdict: WritingCheck['verdict'] =
    written.length === 0
      ? 'far'
      : versions.some((version) => compact(version) === written)
        ? 'model'
        : missing.length === 0 && best >= WRITING_CLOSE_RATIO
          ? 'close'
          : 'far';

  return {
    verdict,
    missing,
    similarity: Math.round(best * 100) / 100,
    model: prompt.model,
    notes: prompt.notes,
  };
}
