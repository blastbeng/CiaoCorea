import type { Dialogue, DialogueTurn } from '@ciaocorea/shared';
import { describe, expect, it } from 'vitest';
import {
  checkDialogueTurn,
  countAnswerTurns,
  isStudentTurn,
  nextAnswerIndex,
  publicTurns,
  resumePoint,
} from './dialogue';

function line(id: string, ko: string, it: string): DialogueTurn {
  return { id, speaker: 'Mina', ko, it };
}

function student(id: string, ko: string, it: string, accept?: string[]): DialogueTurn {
  return { id, speaker: 'Tu', ko, it, answer: { kind: 'type', accept } };
}

const turns: DialogueTurn[] = [
  line('m-1', '안녕하세요.', 'Buongiorno.'),
  student('s-1', '안녕하세요.', 'Buongiorno.'),
  line('m-2', '이름이 뭐예요?', 'Come ti chiami?'),
  student('s-2', '저는 마르코예요.', 'Mi chiamo Marco.', ['마르코예요']),
];

describe('checkDialogueTurn', () => {
  it('accetta la forma esatta ignorando spazi e punteggiatura finale', () => {
    expect(checkDialogueTurn(turns[1]!, '  안녕하세요! ')).toBe(true);
    expect(checkDialogueTurn(turns[1]!, '안녕하세요 .')).toBe(true);
  });

  it('accetta le varianti dichiarate nel contenuto', () => {
    expect(checkDialogueTurn(turns[3]!, '마르코예요')).toBe(true);
    expect(checkDialogueTurn(turns[3]!, '저는 마르코예요')).toBe(true);
  });

  it('rifiuta una forma diversa e la risposta vuota', () => {
    expect(checkDialogueTurn(turns[1]!, '안녕히 계세요')).toBe(false);
    expect(checkDialogueTurn(turns[1]!, '   ')).toBe(false);
  });

  it('non corregge le battute che non aspettano risposta', () => {
    expect(isStudentTurn(turns[0]!)).toBe(false);
    expect(checkDialogueTurn(turns[0]!, '안녕하세요')).toBe(false);
  });
});

describe('posizione nel dialogo', () => {
  it('conta solo le battute dello studente', () => {
    expect(countAnswerTurns(turns)).toBe(2);
  });

  it('salta le battute di servizio per trovare la prossima interattiva', () => {
    expect(nextAnswerIndex(turns, 0)).toBe(1);
    expect(nextAnswerIndex(turns, 2)).toBe(3);
    expect(nextAnswerIndex(turns, 4)).toBe(4);
  });

  it('riprende dalla battuta non ancora superata', () => {
    const dialogue: Dialogue = {
      id: 'd',
      slug: 'd',
      title: 'Dialogo di prova',
      level: 'A1',
      setting: 'Un posto qualsiasi, per la prova',
      goal: 'Verificare il punto di ripresa',
      points: ['punto uno abbastanza lungo', 'punto due abbastanza lungo'],
      turns,
    };

    expect(resumePoint(dialogue, 0)).toEqual({ turnIndex: 0, answerIndex: 1, completed: false });
    expect(resumePoint(dialogue, 2)).toEqual({ turnIndex: 2, answerIndex: 3, completed: false });
    expect(resumePoint(dialogue, 4)).toEqual({ turnIndex: 4, answerIndex: 4, completed: true });
  });
});

describe('publicTurns', () => {
  it('non lascia uscire la soluzione né le varianti', () => {
    const [first, second] = publicTurns(turns);
    expect(first!.answer).toBeNull();
    expect(second!.answer).toEqual({ kind: 'type', options: undefined, hint: undefined });
    expect(JSON.stringify(publicTurns(turns))).not.toContain('마르코예요');
  });

  it('nasconde il coreano delle battute non ancora recitate', () => {
    const pub = publicTurns(turns);
    expect(pub[0]!.ko).toBe('안녕하세요.');
    expect(pub[1]!.ko).toBeNull();
    expect(pub[3]!.ko).toBeNull();
  });

  it('restituisce il coreano di quelle già superate, così il reload non perde la chat', () => {
    const pub = publicTurns(turns, 4);
    expect(pub[3]!.ko).toBe('저는 마르코예요.');
  });
});
