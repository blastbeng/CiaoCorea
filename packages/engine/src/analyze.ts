import type { TextAnalysisResponse, TextToken, VocabEntry } from '@ciaocorea/shared';
import { lookupWord } from './lookup';
import { pronunciationRomanize } from './romanize';

/**
 * L'analisi di un testo che lo studente ha davanti: incolla una frase, un
 * cartello, una canzone, e ogni parola viene cercata nel dizionario del corso.
 *
 * Non è un traduttore: dice soltanto che cosa il corso conosce già e che cosa
 * ancora no, e come si legge tutto — anche quello che non conosce, perché la
 * lettura serve prima del significato.
 */

const HANGUL = /[가-힣]/u;

/**
 * I pezzi del testo: parole hangul, spazi e tutto il resto, nell'ordine. Una
 * cifra attaccata a una parola resta con lei (5층 è "il quinto piano", non il
 * numero 5 e la parola 층), come già fa la scheda che si apre toccando il testo.
 */
function pieces(text: string): string[] {
  return text.match(/\d[\d,]*[가-힣]+|[가-힣]+|\s+|[^\s가-힣]+/gu) ?? [];
}

/** Le parole distinte non ancora incontrate, senza ripetizioni. */
function uniqueUnknown(tokens: readonly TextToken[]): string[] {
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const token of tokens) {
    if (!token.hangul || token.match) continue;
    if (seen.has(token.text)) continue;
    seen.add(token.text);
    unknown.push(token.text);
  }
  return unknown;
}

export function analyzeText(entries: readonly VocabEntry[], text: string): TextAnalysisResponse {
  const tokens: TextToken[] = pieces(text).map((piece) => {
    if (!HANGUL.test(piece)) {
      return { text: piece, hangul: false, reading: null, match: null };
    }

    const found = lookupWord(entries, piece);
    return {
      text: piece,
      hangul: true,
      reading: pronunciationRomanize(piece),
      match: found
        ? {
            ko: found.entry.ko,
            it: found.entry.it,
            rr: found.entry.rr,
            courseSlug: found.entry.courseSlug,
            courseTitle: found.entry.courseTitle,
            lessonId: found.entry.lessonId,
            via: found.via,
            particle: found.particle,
            ending: found.ending,
            suffix: found.suffix,
            note: found.note ?? found.particleHint,
          }
        : null,
    };
  });

  const words = tokens.filter((token) => token.hangul);
  return {
    tokens,
    words: words.length,
    known: words.filter((token) => token.match !== null).length,
    unknown: uniqueUnknown(words),
  };
}
