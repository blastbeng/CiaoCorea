import type { VocabEntry } from '@ciaocorea/shared';
import { normalizeHangul } from './normalize';

/**
 * Il dizionario del curricolo è fatto di forme dizionariali (학교, 먹다), ma nel
 * brano lo studente clicca la forma che vede (학교에, 먹었어요). Qui si prova a
 * risalire alla voce: prima la parola così com'è, poi togliendo una particella,
 * infine riconoscendo la radice di un verbo o di un aggettivo.
 *
 * Non è un analizzatore morfologico: sbagliare qui vuol dire mostrare la scheda
 * di un'altra parola, quindi ogni passo è volutamente prudente e l'ultimo
 * richiede che la radice sia lunga almeno due sillabe.
 *
 * Quando si toglie qualcosa, si dice anche che cosa si è tolto: la scheda
 * spiega così, senza una lezione in più, che cosa fa quella particella.
 */

export type WordMatchVia = 'exact' | 'particle' | 'stem';

export interface WordMatch {
  entry: VocabEntry;
  via: WordMatchVia;
  /** La particella tolta, quando `via` è 'particle'. */
  particle?: string;
  /** A che cosa serve quella particella, in italiano. */
  particleHint?: string;
  /** La desinenza riconosciuta, quando `via` è 'stem'. */
  ending?: string;
}

interface Particle {
  suffix: string;
  /** Come si spiega in una riga, per chi la incontra dentro la frase. */
  hint: string;
}

/**
 * Particelle e suffissi che si attaccano al nome. L'ordine conta: prima le più
 * lunghe, altrimenti 에서 verrebbe letto come 에 e 에게 come 에.
 */
const PARTICLES: readonly Particle[] = [
  { suffix: '이라고는', hint: '라고 + 는: "quello che si chiama…", con il tema' },
  { suffix: '이라고', hint: '라고: "che si chiama", per dire un nome' },
  { suffix: '에서는', hint: '에서 + 는: nel luogo dove si fa qualcosa' },
  { suffix: '에게서', hint: 'da una persona (chi manda o dice)' },
  { suffix: '에는', hint: '에 + 는: nel luogo o nel tempo, come tema' },
  { suffix: '에도', hint: '에 + 도: anche nel luogo o nel tempo' },
  { suffix: '에서', hint: 'nel luogo dove si fa qualcosa, da un luogo' },
  { suffix: '에게', hint: 'a una persona' },
  { suffix: '한테', hint: 'a una persona (parlato)' },
  { suffix: '으로', hint: 'verso, per mezzo di (dopo consonante)' },
  { suffix: '부터', hint: 'da (inizio)' },
  { suffix: '까지', hint: 'fino a' },
  { suffix: '보다', hint: 'di (nel paragone: 더 … 보다)' },
  { suffix: '처럼', hint: 'come, uguale a' },
  { suffix: '이랑', hint: 'e, insieme a (dopo consonante)' },
  { suffix: '하고', hint: 'e, insieme a (parlato)' },
  { suffix: '은', hint: 'tema: quanto a…' },
  { suffix: '는', hint: 'tema: quanto a…' },
  { suffix: '이', hint: 'soggetto' },
  { suffix: '가', hint: 'soggetto' },
  { suffix: '을', hint: 'oggetto' },
  { suffix: '를', hint: 'oggetto' },
  { suffix: '에', hint: 'a, in: luogo o tempo' },
  { suffix: '도', hint: 'anche' },
  { suffix: '만', hint: 'solo' },
  { suffix: '의', hint: 'di (possesso)' },
  { suffix: '와', hint: 'e, insieme a (dopo vocale)' },
  { suffix: '과', hint: 'e, insieme a (dopo consonante)' },
  { suffix: '로', hint: 'verso, per mezzo di (dopo vocale o ㄹ)' },
  { suffix: '랑', hint: 'e, insieme a (dopo vocale)' },
  { suffix: '나', hint: 'o (tra due possibilità)' },
];

/** Desinenze frequenti: servono solo a capire dove finisce la radice. */
const ENDINGS = ['습니다', 'ㅂ니다', '어요', '아요', '여요', '해요', '었', '았', '겠', '고', '서', '면', '니', '다', '요', '지', '게', '러', '죠'];

function indexOf(entries: readonly VocabEntry[]): Map<string, VocabEntry> {
  const byKo = new Map<string, VocabEntry>();
  for (const entry of entries) {
    const key = normalizeHangul(entry.ko).trim();
    if (key.length > 0 && !byKo.has(key)) byKo.set(key, entry);
  }
  return byKo;
}

export function lookupWord(entries: readonly VocabEntry[], word: string): WordMatch | null {
  const wanted = normalizeHangul(word).trim();
  if (wanted.length === 0) return null;
  const byKo = indexOf(entries);

  const exact = byKo.get(wanted);
  if (exact) return { entry: exact, via: 'exact' };

  for (const { suffix, hint } of PARTICLES) {
    if (wanted.length <= suffix.length || !wanted.endsWith(suffix)) continue;
    const hit = byKo.get(wanted.slice(0, -suffix.length));
    if (hit) return { entry: hit, via: 'particle', particle: suffix, particleHint: hint };
  }

  // Radice di un verbo: la voce finisce in 다, la forma nel brano no.
  // Vince la radice più lunga, così 먹었어요 non finisce su una parola più corta.
  let best: VocabEntry | null = null;
  let bestLength = 0;
  let bestEnding = '';
  for (const [key, entry] of byKo) {
    if (!key.endsWith('다') || key.length < 2) continue;
    const stem = key.slice(0, -1);
    if (stem.length <= bestLength) continue;
    if (wanted.startsWith(stem) && wanted.length > stem.length) {
      // La parte che avanza deve sembrare una desinenza, non un'altra parola.
      const rest = wanted.slice(stem.length);
      const ending = ENDINGS.find((candidate) => rest.startsWith(candidate));
      if (ending) {
        best = entry;
        bestLength = stem.length;
        bestEnding = ending;
      }
    }
  }

  return best ? { entry: best, via: 'stem', ending: bestEnding } : null;
}
