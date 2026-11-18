/**
 * Pezzi di interfaccia che non hanno bisogno di React: si possono provare con
 * un test, come la composizione del Hangul.
 */

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
  for (const [index, word] of words.entries()) {
    const pending = consumed.get(word) ?? 0;
    if (pending > 0) {
      consumed.set(word, pending - 1);
      continue;
    }
    left.push({ word, index });
  }
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
