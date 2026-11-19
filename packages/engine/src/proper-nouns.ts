/**
 * Nomi di persona e di luogo che compaiono nei brani e nei dialoghi. Non sono
 * vocabolario da imparare, ma lo studente li clicca come tutto il resto: la
 * scheda deve almeno dire che quello è un nome e come si legge.
 *
 * La romanizzazione segue la trascrizione rivista (Revised Romanization), la
 * stessa usata nel resto dell'app.
 */

interface ProperNoun {
  /** Che cosa è, in italiano. */
  it: string;
  rr: string;
}

const NOUNS: Record<string, ProperNoun> = {
  // persone
  지수: { it: 'nome di persona (Jisu)', rr: 'jisu' },
  수진: { it: 'nome di persona (Sujin)', rr: 'sujin' },
  민준: { it: 'nome di persona (Minjun)', rr: 'minjun' },
  김수진: { it: 'nome e cognome: Kim Sujin (김 è il cognome)', rr: 'gim-sujin' },
  박민준: { it: 'nome e cognome: Park Minjun (박 è il cognome)', rr: 'bak-minjun' },
  마르코: { it: 'nome di persona (Marco, scritto in hangul)', rr: 'mareuko' },
  마리오: { it: 'nome di persona (Mario, scritto in hangul)', rr: 'mario' },
  // luoghi
  한강: { it: 'il fiume Han, che attraversa Seul', rr: 'han-gang' },
  신촌: { it: 'Sinchon, quartiere universitario di Seul', rr: 'sinchon' },
  부산: { it: 'Busan, città sul mare nel sud-est', rr: 'busan' },
  서울: { it: 'Seul, la capitale', rr: 'seoul' },
  한국: { it: 'la Corea (il Paese)', rr: 'han-guk' },
};

export function readProperNoun(word: string): ProperNoun | null {
  return NOUNS[word] ?? null;
}
