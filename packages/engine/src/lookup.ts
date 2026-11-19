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
 */

export type WordMatchVia = 'exact' | 'particle' | 'stem';

export interface WordMatch {
  entry: VocabEntry;
  via: WordMatchVia;
}

/** Particelle e suffissi che si attaccano al nome: dalla più lunga alla più corta. */
const PARTICLES = [
  '에서는',
  '에게서',
  '이라고',
  '이라고는',
  '에서',
  '에게',
  '한테',
  '으로',
  '부터',
  '까지',
  '보다',
  '처럼',
  '이랑',
  '하고',
  '에는',
  '에도',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '에',
  '도',
  '만',
  '의',
  '와',
  '과',
  '로',
  '랑',
  '나',
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

  for (const particle of PARTICLES) {
    if (wanted.length <= particle.length || !wanted.endsWith(particle)) continue;
    const hit = byKo.get(wanted.slice(0, -particle.length));
    if (hit) return { entry: hit, via: 'particle' };
  }

  // Radice di un verbo: la voce finisce in 다, la forma nel brano no.
  // Vince la radice più lunga, così 먹었어요 non finisce su una parola più corta.
  let best: VocabEntry | null = null;
  let bestLength = 0;
  for (const [key, entry] of byKo) {
    if (!key.endsWith('다') || key.length < 2) continue;
    const stem = key.slice(0, -1);
    if (stem.length <= bestLength) continue;
    if (wanted.startsWith(stem) && wanted.length > stem.length) {
      // La parte che avanza deve sembrare una desinenza, non un'altra parola.
      const rest = wanted.slice(stem.length);
      if (ENDINGS.some((ending) => rest.startsWith(ending))) {
        best = entry;
        bestLength = stem.length;
      }
    }
  }

  return best ? { entry: best, via: 'stem' } : null;
}
