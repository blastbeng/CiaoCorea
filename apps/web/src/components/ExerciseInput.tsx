import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CLOZE_MARKER, type MatchPairsExercise, type PublicExercise } from '@ciaocorea/shared';
import { encodeMatch, parseMatch } from '@ciaocorea/engine';
import { matchColumns, remainingTiles, splitCloze } from '../exercises';
import { composeHangul } from '../hangul';
import { speakKorean, ttsSupported } from '../pronounce';
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

  if (exercise.type === 'match_pairs') {
    // La chiave è l'esercizio: cambiando esercizio il foglio si ricompone
    // invece di portarsi dietro i collegamenti del precedente.
    return (
      <MatchPairsInput
        key={exercise.id}
        exercise={exercise}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
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

  if (exercise.type === 'type_reading') {
    // La parola si vede, il suono no: l'audio arriverebbe prima della risposta
    // e detterebbe la romanizzazione. Si legge con gli occhi, come su un menu.
    return (
      <div>
        <p className="reading-target ko" lang="ko" style={{ fontSize: '1.7rem', margin: '0 0 0.9rem' }}>
          {exercise.text}
        </p>
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
          placeholder="Come si legge (romanizzazione)"
          disabled={disabled}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    );
  }

  if (exercise.type === 'listen_type') {
    // Il testo coreano non si mostra: è un dettato, si ascolta e si scrive.
    // La voce è quella del browser, quindi si può premere quante volte serve.
    return (
      <div>
        {ttsSupported() ? (
          <div className="row" style={{ marginBottom: '0.9rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={disabled}
              onClick={() => speakKorean(exercise.speak)}
              aria-label="Ascolta la frase da scrivere"
            >
              🔊 Ascolta
            </button>
            <button
              type="button"
              className="btn btn--sm"
              disabled={disabled}
              onClick={() => speakKorean(exercise.speak, { rate: 0.55 })}
              aria-label="Ascolta la frase lentamente"
            >
              🐢 Piano
            </button>
          </div>
        ) : (
          <p className="alert alert--warn" role="alert">
            Questo browser non riproduce l&rsquo;audio: l&rsquo;ascolto funziona su Chrome, Edge e Safari.
          </p>
        )}

        <HangulInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          autoFocus
          placeholder="Scrivi quello che hai sentito"
        />
      </div>
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

/**
 * «Collega le coppie»: una colonna resta ferma, l'altra è mescolata, e si
 * uniscono le righe che vanno insieme.
 *
 * La risposta si scrive solo quando ogni riga ha il suo partner: finché manca
 * qualcosa il valore resta vuoto e il pulsante «Conferma» della lezione non si
 * accende. Un abbinamento a metà non è un esercizio metà giusto.
 */
function MatchPairsInput({
  exercise,
  value,
  onChange,
  disabled,
}: {
  exercise: MatchPairsExercise;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { fixed, movable } = matchColumns(exercise);
  const [assigned, setAssigned] = useState<Record<number, number>>(() => startFrom(value, fixed.length));
  const [picked, setPicked] = useState<number | null>(null);
  /** L'ultima risposta completa che abbiamo scritto noi: serve a distinguere
   * il nostro vuoto (abbinamento a metà) dal vuoto di chi ci riprova. */
  const emitted = useRef('');

  useEffect(() => {
    if (value !== '' || emitted.current === '') return;
    emitted.current = '';
    setAssigned({});
    setPicked(null);
  }, [value]);

  const korean = exercise.from === 'ko';
  /** Il testo che si mostra nella colonna fissa e in quella mobile. */
  const side = (row: { ko: string; it: string }) => (korean ? row.ko : row.it);
  const other = (row: { ko: string; it: string }) => (korean ? row.it : row.ko);

  function commit(next: Record<number, number>) {
    setAssigned(next);
    const complete = Object.keys(next).length === fixed.length;
    const response = complete ? encodeMatch(fixed.map((row) => next[row.index])) : '';
    emitted.current = response;
    onChange(response);
  }

  function touchRow(rowIndex: number) {
    if (disabled) return;
    if (assigned[rowIndex] !== undefined) {
      // Toccare una riga già collegata la stacca: si corregge senza ricominciare.
      const next = { ...assigned };
      delete next[rowIndex];
      setPicked(null);
      commit(next);
      return;
    }
    setPicked(picked === rowIndex ? null : rowIndex);
  }

  function touchPartner(pairIndex: number) {
    if (disabled || picked === null) return;
    const next: Record<number, number> = { ...assigned };
    // Un partner può stare su una riga sola: se era già usato, si libera l'altra.
    for (const [rowIndex, used] of Object.entries(next)) {
      if (used === pairIndex) delete next[Number(rowIndex)];
    }
    next[picked] = pairIndex;
    setPicked(null);
    commit(next);
  }

  /** Quali partner sono già stati usati, e da quale riga. */
  const takenByRow = new Map<number, number>();
  for (const [rowIndex, pairIndex] of Object.entries(assigned)) takenByRow.set(pairIndex, Number(rowIndex));

  return (
    <div className="match">
      <div className="match__col">
        {fixed.map((row) => {
          const partner = assigned[row.index];
          const classes = [
            'match__item',
            korean ? 'ko' : '',
            picked === row.index ? 'match__item--picked' : '',
            partner !== undefined ? 'match__item--linked' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={row.index}
              type="button"
              className={classes}
              lang={korean ? 'ko' : undefined}
              disabled={disabled}
              onClick={() => touchRow(row.index)}
              aria-label={
                partner === undefined
                  ? `${side(row)}: scegli il suo partner`
                  : `${side(row)} collegato a ${other(fixed[partner])}. Tocca per staccare`
              }
            >
              <span>{side(row)}</span>
              {partner !== undefined && <small className="match__link">{other(fixed[partner])}</small>}
            </button>
          );
        })}
      </div>

      <div className="match__col">
        {movable.map((row) => {
          const taken = takenByRow.has(row.index);
          const classes = ['match__item', korean ? '' : 'ko', taken ? 'match__item--used' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={row.index}
              type="button"
              className={classes}
              lang={korean ? undefined : 'ko'}
              disabled={disabled || (picked === null && !taken)}
              onClick={() => touchPartner(row.index)}
              aria-label={taken ? 'Partner già collegato' : 'Collega alla riga scelta'}
            >
              <span>{other(row)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Da una risposta già data, i collegamenti: servono a ridisegnare la schermata
 * dopo un tentativo senza ricominciare da capo. */
function startFrom(value: string, count: number): Record<number, number> {
  const given = parseMatch(value);
  const start: Record<number, number> = {};
  given.forEach((pairIndex, position) => {
    if (position < count && pairIndex >= 0 && pairIndex < count) start[position] = pairIndex;
  });
  return start;
}
