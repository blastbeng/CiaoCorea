import { useState } from 'react';
import { speakKorean, ttsSupported } from '../pronounce';

interface Props {
  /** Ciò che si sente: la forma coreana, non la traduzione. */
  text: string;
  /** Come la chiama chi legge con lo screen reader. */
  label?: string;
}

/**
 * Il pulsante che fa sentire come si legge una parola o una frase. Sta dove
 * c'è il coreano da ascoltare: lessico, brani, dialoghi, dizionario, quaderno.
 * Su un browser senza `speechSynthesis` sparisce: meglio non promettere una
 * voce che non arriverà.
 *
 * Se il dispositivo non ha una voce coreana il pulsante resta, ma lo dice: non
 * facciamo leggere l'hangul da una voce italiana, che insegnerebbe un suono
 * sbagliato. Lo studente può installare la voce e riprovare, senza ricaricare.
 */
export function PronounceButton({ text, label }: Props) {
  const [missingVoice, setMissingVoice] = useState(false);

  if (!ttsSupported()) return null;

  const name = label ?? 'la parola';

  return (
    <button
      type="button"
      className={missingVoice ? 'pronounce pronounce--muted' : 'pronounce'}
      title={
        missingVoice
          ? 'Nessuna voce coreana su questo dispositivo'
          : 'Ascolta la pronuncia'
      }
      aria-label={
        missingVoice
          ? `Nessuna voce coreana installata: impossibile ascoltare ${name}`
          : `Ascolta la pronuncia di ${name}`
      }
      onClick={(event) => {
        // Nei pulsanti a tutta riga (opzioni, chip) il click non deve
        // selezionare anche la risposta.
        event.stopPropagation();
        const result = speakKorean(text);
        setMissingVoice(result === 'no-korean-voice' || result === 'unsupported');
      }}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
