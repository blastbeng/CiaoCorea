/**
 * L'audio del coreano passa dal motore vocale del browser
 * (`speechSynthesis`). Due cose contano più della qualità della voce:
 *
 * 1. Deve essere una voce **coreana**. Se il dispositivo non ne ha una, il
 *    browser leggerebbe l'hangul con una voce italiana o inglese: un suono che
 *    non esiste in coreano insegna la pronuncia sbagliata. In quel caso non si
 *    parla affatto e si spiega perché.
 * 2. Va scelta la voce migliore fra quelle coreane: `ko-KR` prima di tutto,
 *    poi le altre varianti (`ko`, `ko_KR`), preferendo le voci che i motori
 *    conoscono come le più curate (Google, Microsoft, Apple).
 *
 * Il modulo resta puro fin dove può: `pickKoreanVoice` lavora su una lista di
 * voci qualsiasi, così la scelta si può provare senza browser.
 */

/** Come è andata la richiesta di parlare. */
export type SpeakResult = 'spoken' | 'no-korean-voice' | 'unsupported' | 'empty';

/** I campi di una voce che servono alla scelta; `SpeechSynthesisVoice` li ha tutti. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/** Il messaggio da mostrare quando manca la voce coreana. */
export const MISSING_VOICE_MESSAGE =
  "Questo dispositivo non ha una voce coreana installata: l'audio resta muto invece di leggere " +
  "l'hangul con una voce di un'altra lingua. La romanizzazione e le regole di pronuncia restano " +
  'qui; per sentire la voce, aggiungi una voce coreana (ko-KR) nelle impostazioni di sistema.';

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * Quanto una voce è adatta a leggere il coreano. Zero significa "non lo sa
 * leggere" e non va mai usata: una voce `it-IT` davanti a `안녕하세요` non
 * produce coreano, produce rumore.
 */
function voiceScore(voice: VoiceLike): number {
  const lang = normalizeLang(voice.lang);
  let score: number;
  if (lang === 'ko-kr') score = 100;
  else if (lang.startsWith('ko')) score = 60;
  else return 0;

  // Le voci note per essere registrate da parlanti madrelingua o sintetizzate
  // bene valgono qualche punto in più; il resto è preferenza, non regola.
  if (/google|microsoft|yuna|sora|heami|sumi|korean/i.test(voice.name)) score += 10;
  // Una voce locale funziona anche senza rete: a parità di lingua è più affidabile.
  if (voice.localService) score += 2;
  return score;
}

/** La voce coreana migliore fra quelle disponibili, o `null` se non ce n'è. */
export function pickKoreanVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = voiceScore(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

/** Le voci del browser, se il browser le espone. */
function availableVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

/** La voce coreana che useremmo adesso, o `null`. */
export function koreanVoice(): SpeechSynthesisVoice | null {
  return pickKoreanVoice(availableVoices());
}

/** `true` se il dispositivo sa leggere il coreano. */
export function hasKoreanVoice(): boolean {
  return koreanVoice() !== null;
}

/**
 * La frase da mostrare accanto a un pulsante muto. `browserLang` è la lingua
 * del browser (`null` se la sintesi vocale manca del tutto): serve a
 * distinguere "non c'è il motore" da "il motore c'è ma non sa il coreano".
 */
export function missingVoiceHint(browserLang: string | null): string {
  if (browserLang === null) {
    return 'Questo browser non ha la sintesi vocale: la pronuncia si studia con la romanizzazione e le regole qui sopra.';
  }
  return MISSING_VOICE_MESSAGE;
}

type NoticeListener = (message: string) => void;
const listeners = new Set<NoticeListener>();

/**
 * Chi vuole avvisare lo studente si iscrive qui: il modulo non conosce React e
 * non deve. La sottoscrizione restituisce la funzione per disiscriversi.
 */
export function onPronounceNotice(listener: NoticeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(message: string): void {
  for (const listener of listeners) listener(message);
}

/**
 * Fa sentire `text`. Restituisce l'esito perché il chiamante possa reagire:
 * un pulsante può cambiare aspetto, una pagina può mostrare l'avviso.
 */
export function speakKorean(text: string, options: { rate?: number } = {}): SpeakResult {
  const trimmed = text.trim();
  if (trimmed === '') return 'empty';
  if (!ttsSupported()) return 'unsupported';

  const voice = koreanVoice();
  if (!voice) {
    notify(MISSING_VOICE_MESSAGE);
    return 'no-korean-voice';
  }

  // Una frase alla volta: due voci sovrapposte non si capiscono.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.voice = voice;
  utterance.lang = voice.lang || 'ko-KR';
  // Un po' più lento del parlato normale: chi studia ha bisogno di sentire i
  // confini fra le sillabe.
  utterance.rate = options.rate ?? 0.9;
  window.speechSynthesis.speak(utterance);
  return 'spoken';
}
