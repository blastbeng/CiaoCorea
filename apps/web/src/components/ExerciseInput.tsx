import type { KeyboardEvent } from 'react';
import { CLOZE_MARKER, type PublicExercise } from '@ciaocorea/shared';
import { remainingTiles, splitCloze } from '../exercises';
import { composeHangul } from '../hangul';
import { HangulInput } from './HangulInput';

const KOREAN = /[\u3131-\u318e\uac00-\ud7a3]/;

/** Serve anche fuori di qui: l'esito di un esercizio mostra il coreano con il
 * font giusto solo se sa riconoscerlo. */
export function isKorean(text: string): boolean {
  return KOREAN.test(text);
}

interface InputProps {
  exercise: PublicExercise;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

/**
 * Il campo di risposta per ogni tipo di esercizio. Vive fuori dalla pagina
 * della lezione perché lo usa anche il ripasso degli errori: due copie
 * divergerebbero, e un esercizio dovrebbe comportarsi allo stesso modo in
 * entrambi i posti.
 */
export function ExerciseInput({ exercise, value, onChange, onSubmit, disabled }: InputProps) {
  if (exercise.type === 'jamo_choice' || exercise.type === 'reading_mcq') {
    return (
      <div className="options">
        {exercise.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            className={[
              'option',
              isKorean(option) ? 'option--ko' : '',
              value === option ? 'option--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (exercise.type === 'block_build') {
    return (
      <div>
        <div className="assembly">
          {value ? (
            composeHangul(value)
          ) : (
            <span className="assembly-empty">Tocca i pezzi qui sotto, nell'ordine giusto…</span>
          )}
        </div>

        <div className="chips">
          {exercise.parts.map((part, position) => (
            <button
              key={`${part}-${position}`}
              type="button"
              className="chip"
              disabled={disabled}
              onClick={() => onChange(value + part)}
            >
              {part}
            </button>
          ))}
        </div>

        {value ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            style={{ marginTop: '0.6rem' }}
            disabled={disabled}
            onClick={() => onChange('')}
          >
            Cancella
          </button>
        ) : null}
      </div>
    );
  }

  if (exercise.type === 'order_words') {
    const tiles = value ? value.split(' ') : [];
    const left = remainingTiles(exercise.words, tiles);

    return (
      <div>
        <div className="assembly assembly--sentence">
          {tiles.length === 0 ? (
            <span className="assembly-empty">Tocca le parole nell&rsquo;ordine giusto…</span>
          ) : (
            tiles.map((token, position) => (
              <button
                key={`${token}-${position}`}
                type="button"
                className="tile tile--filled"
                disabled={disabled}
                onClick={() => onChange(tiles.filter((_, index) => index !== position).join(' '))}
              >
                {token}
              </button>
            ))
          )}
        </div>

        <div className="chips">
          {left.map(({ word, index }) => (
            <button
              key={`${word}-${index}`}
              type="button"
              className="tile"
              disabled={disabled}
              onClick={() => onChange([...tiles, word].join(' '))}
            >
              {word}
            </button>
          ))}
        </div>

        {tiles.length > 0 ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            style={{ marginTop: '0.6rem' }}
            disabled={disabled}
            onClick={() => onChange('')}
          >
            Cancella
          </button>
        ) : null}
      </div>
    );
  }

  if (exercise.type === 'fill_blank') {
    const { before, after } = splitCloze(exercise.text, CLOZE_MARKER);
    const clause = (
      <p className="cloze">
        <span>{before}</span>
        <span
          className={['cloze__blank', exercise.options ? 'cloze__blank--choice' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {value || '\u00a0\u00a0\u00a0'}
        </span>
        <span>{after}</span>
      </p>
    );

    if (exercise.options) {
      return (
        <div>
          {clause}
          <div className="options">
            {exercise.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                className={[
                  'option',
                  isKorean(option) ? 'option--ko' : '',
                  value === option ? 'option--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div>
        {clause}
        <HangulInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          autoFocus
          placeholder="Scrivi la parola che manca"
        />
      </div>
    );
  }

  if (exercise.type === 'type_hangul') {
    return (
      <HangulInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        autoFocus
        placeholder="Scrivi in coreano"
      />
    );
  }

  return (
    <input
      className="input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSubmit();
        }
      }}
      placeholder="Scrivi in italiano"
      disabled={disabled}
      autoFocus
      autoComplete="off"
      spellCheck={false}
    />
  );
}
