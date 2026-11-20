import { decomposeSyllable, jamoInfo } from '@ciaocorea/engine';

interface Props {
  /** Il coreano da scomporre. I caratteri che non sono sillabe si saltano. */
  text: string;
  /** Quante sillabe mostrare al massimo: oltre, la riga diventa illeggibile. */
  limit?: number;
}

/**
 * Da quali lettere è fatto un blocco. 한 non è un disegno: è ㅎ + ㅏ + ㄴ, e
 * saperlo è ciò che permette di leggere una parola nuova. La scomposizione si
 * tiene corta — lettera e nome — perché sta dentro la scheda di una parola.
 */
export function JamoBreakdown({ text, limit = 4 }: Props) {
  const syllables = [...text].filter((char) => decomposeSyllable(char) !== null).slice(0, limit);
  if (syllables.length === 0) return null;

  return (
    <span className="jamo">
      {syllables.map((syllable, index) => {
        const parts = decomposeSyllable(syllable);
        if (!parts) return null;
        const letters = [parts.lead, parts.vowel, parts.tail].filter(Boolean);
        return (
          <span className="jamo-syllable" key={`${syllable}-${index}`}>
            <span className="jamo-char" lang="ko">
              {syllable}
            </span>
            <span className="jamo-parts">
              {letters.map((letter, letterIndex) => {
                const info = jamoInfo(letter);
                return (
                  <span className="jamo-part" key={`${letter}-${letterIndex}`}>
                    <span className="jamo-letter" lang="ko" title={info ? info.ipa : undefined}>
                      {letter}
                    </span>
                    <span className="jamo-name">{info ? info.name : ''}</span>
                  </span>
                );
              })}
            </span>
          </span>
        );
      })}
    </span>
  );
}
