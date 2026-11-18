import type { Dialogue, DialogueTurn, PublicDialogueTurn } from '@ciaocorea/shared';
import { compact, matchesAny } from './normalize';

/**
 * Un dialogo è un copione: non c'è nessun modello che improvvisa, quindi la
 * correzione è la stessa di un esercizio scritto. Le varianti accettate stanno
 * nel contenuto, non qui, perché sono una scelta didattica dell'autore.
 */

/** True se la battuta aspetta una risposta dello studente. */
export function isStudentTurn(turn: DialogueTurn): boolean {
  return turn.answer !== undefined;
}

export function countAnswerTurns(turns: readonly DialogueTurn[]): number {
  return turns.reduce((total, turn) => total + (isStudentTurn(turn) ? 1 : 0), 0);
}

/**
 * La prima battuta con risposta a partire da `from` (incluso). Se non ce ne
 * sono più, restituisce la lunghezza: il dialogo è finito.
 */
export function nextAnswerIndex(turns: readonly DialogueTurn[], from = 0): number {
  for (let index = Math.max(0, from); index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn && isStudentTurn(turn)) return index;
  }
  return turns.length;
}

/** True se la risposta coincide con la forma della battuta o con una variante. */
export function checkDialogueTurn(turn: DialogueTurn, response: string): boolean {
  const answer = turn.answer;
  if (!answer) return false;

  const accepted = [turn.ko, ...(answer.accept ?? [])];
  // compact toglie spazi e normalizza i jamo: "감사합니다 ." resta corretto.
  return matchesAny(response, accepted, compact).matched;
}

/**
 * La versione pubblica delle battute: via la soluzione e le varianti. Il client
 * deve poter mostrare la consegna (l'italiano) e le opzioni, nient'altro.
 *
 * `answeredUntil` è l'indice della prima battuta non superata: tutto ciò che
 * sta prima è già stato recitato e può viaggiare per intero, così un reload a
 * metà dialogo non cancella la conversazione già fatta. Da lì in avanti il
 * coreano delle battute dello studente resta null: è la risposta.
 */
export function publicTurns(
  turns: readonly DialogueTurn[],
  answeredUntil = 0,
): PublicDialogueTurn[] {
  return turns.map((turn, index) => {
    const { answer, ko, note, ...rest } = turn;
    const student = answer !== undefined;
    const revealed = index < answeredUntil;

    return {
      ...rest,
      ko: student && !revealed ? null : ko,
      // La nota di una battuta dello studente spiega la soluzione: si mostra
      // solo a battuta superata.
      note: student && !revealed ? undefined : note,
      answer: answer
        ? { kind: answer.kind, options: answer.options, hint: answer.hint }
        : null,
    };
  });
}

export interface DialogueStart {
  turnIndex: number;
  /** Indice della battuta interattiva corrente, o turns.length se finito. */
  answerIndex: number;
  completed: boolean;
}

/**
 * Dove riprendere: `turnIndex` è la prima battuta non ancora superata, quindi
 * si riparte dalla prima battuta con risposta da lì in avanti.
 */
export function resumePoint(dialogue: Dialogue, turnIndex: number): DialogueStart {
  const clamped = Math.min(Math.max(0, turnIndex), dialogue.turns.length);
  const answerIndex = nextAnswerIndex(dialogue.turns, clamped);
  return {
    turnIndex: clamped,
    answerIndex,
    completed: answerIndex >= dialogue.turns.length,
  };
}
