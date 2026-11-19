/**
 * La pronuncia facoltativa: si tocca una parola e la si sente. Non c'è nessun
 * file audio da servire — il sito è statico — quindi si usa la voce che il
 * browser ha già: `speechSynthesis` con la lingua coreana. Se il dispositivo
 * non ha una voce ko, il browser parla comunque con la voce predefinita:
 * imperfecta, ma meglio del silenzio.
 */

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function koreanVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('ko')) ?? null;
}

/**
 * Fa sentire una frase coreana. Le voci si caricano in ritardo su Chrome,
 * quindi la si cerca a ogni pressione: se nel frattempo sono arrivate, si usa
 * quella giusta.
 */
export function speakKorean(text: string): void {
  if (!ttsSupported()) return;
  const clean = text.trim();
  if (clean === '') return;

  const synth = window.speechSynthesis;
  // Una parola alla volta: la pressione nuova sostituisce quella che sta
  // parlando, come ci si aspetta da un dizionario che si tocca in fretta.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'ko-KR';
  const voice = koreanVoice();
  if (voice) utterance.voice = voice;
  // Un poco più lento del naturale: chi studia sta anche leggendo.
  utterance.rate = 0.85;
  synth.speak(utterance);
}
