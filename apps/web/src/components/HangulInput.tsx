import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { composeHangul, dropLast } from '../hangul';

interface HangulInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  /**
   * Testo lungo: una consegna del quaderno sono frasi, non una parola. In
   * multilinea Invio va a capo e non invia, altrimenti non si potrebbe
   * scrivere la seconda frase.
   */
  multiline?: boolean;
  rows?: number;
}

const ROWS: Array<Array<{ label: string; wide?: boolean }>> = [
  ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'].map(
    (label) => ({ label }),
  ),
  ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ'].map((label) => ({ label })),
  ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'].map((label) => ({ label })),
  ['ㅐ', 'ㅒ', 'ㅔ', 'ㅖ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅢ'].map((label) => ({ label })),
];

/**
 * Campo di scrittura coreana: input normale (per chi ha la tastiera coreana o
 * incolla testo) più tastiera di jamo che compone le sillabe.
 */
export function HangulInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  disabled,
  id,
  multiline = false,
  rows = 3,
}: HangulInputProps) {
  const [raw, setRaw] = useState(value);
  const emitted = useRef(value);

  // Se il genitore azzera o cambia il valore (nuovo esercizio, reset), il
  // buffer di jamo deve seguirlo: altrimenti il campo resta "sporco".
  useEffect(() => {
    if (value !== emitted.current) {
      setRaw(value);
      emitted.current = value;
    }
  }, [value]);

  const commit = (nextRaw: string) => {
    const composed = composeHangul(nextRaw);
    setRaw(nextRaw);
    emitted.current = composed;
    onChange(composed);
  };

  const press = (jamo: string) => {
    if (disabled) return;
    commit(raw + jamo);
  };

  const backspace = () => {
    if (disabled) return;
    commit(dropLast(raw));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (multiline) return;
    if (event.key === 'Enter' && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  const field = {
    id,
    className: 'input input--ko',
    value: composeHangul(raw),
    onChange: (event: { target: { value: string } }) => commit(event.target.value),
    placeholder,
    autoFocus,
    disabled,
    autoComplete: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    lang: 'ko',
  };

  return (
    <div>
      {multiline ? (
        <textarea {...field} rows={rows} onKeyDown={handleKeyDown} />
      ) : (
        <input {...field} onKeyDown={handleKeyDown} />
      )}

      <div className="keyboard" aria-label="Tastiera Hangul su schermo">
        {ROWS.map((row, index) => (
          <div className="keyboard-row" key={index}>
            {row.map(({ label }) => (
              <button
                type="button"
                className="key"
                key={label}
                onClick={() => press(label)}
                disabled={disabled}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
        <div className="keyboard-row">
          <button
            type="button"
            className="key key--wide"
            onClick={() => press(' ')}
            disabled={disabled}
          >
            spazio
          </button>
          <button
            type="button"
            className="key key--wide"
            onClick={backspace}
            disabled={disabled}
          >
            ⌫ cancella
          </button>
        </div>
      </div>

      <p className="hint" style={{ marginTop: '0.5rem' }}>
        Premi i jamo e l'app li unisce in sillabe. Se hai la tastiera coreana,
        scrivi pure direttamente nel campo.
      </p>
    </div>
  );
}
