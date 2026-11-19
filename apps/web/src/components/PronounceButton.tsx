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
 */
export function PronounceButton({ text, label }: Props) {
  if (!ttsSupported()) return null;

  return (
    <button
      type="button"
      className="pronounce"
      title="Ascolta la pronuncia"
      aria-label={label ? `Ascolta la pronuncia di ${label}` : 'Ascolta la pronuncia'}
      onClick={(event) => {
        // Nei pulsanti a tutta riga (opzioni, chip) il click non deve
        // selezionare anche la risposta.
        event.stopPropagation();
        speakKorean(text);
      }}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
