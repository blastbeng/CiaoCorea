import { useState } from 'react';
import { CONJUGATION_CLASSES } from '@ciaocorea/engine';
import { HangulInput } from '../components/HangulInput';
import { PronounceButton } from '../components/PronounceButton';
import {
  DRILLS,
  PARTICLE_FUNCTIONS,
  buildParticleQuestion,
  buildVerbQuestion,
  isCorrectVerb,
  type DrillId,
  type ParticleQuestion,
  type VerbQuestion,
} from '../palestra-drill';

/** Le regole delle particelle, in fondo alla pagina: la risposta ha già detto la sua. */
const PARTICLE_RULES: readonly string[] = [
  'Dopo una consonante finale che si sente la particella è quella delle consonanti: 사람이, 책을, 가방이. La ㅁ finale di 강 è una nasale e conta.',
  'Dopo una sillaba che non chiude su nulla la particella è quella delle vocali: 학교가, 학교를, 학교와.',
  '으로 dopo consonante, 로 dopo vocale, e dopo la ㄹ finale sempre 로: 말로, 서울로.',
  'La 을 dopo la ㄹ resta 을 nella grafia — 팔을 — anche se si pronuncia [를]: non è un errore.',
];

/* -------------------------------------------------------------------------- */
/* Coniugazione                                                               */
/* -------------------------------------------------------------------------- */

function VerbDrill() {
  const [question, setQuestion] = useState<VerbQuestion>(() => buildVerbQuestion());
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const [tally, setTally] = useState({ right: 0, asked: 0 });

  const solved = checked !== null;

  function check() {
    if (solved || value.trim().length === 0) return;
    const ok = isCorrectVerb(question, value);
    setChecked(ok);
    setTally((current) => ({ right: current.right + (ok ? 1 : 0), asked: current.asked + 1 }));
  }

  function next() {
    setQuestion(buildVerbQuestion());
    setValue('');
    setChecked(null);
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row row--between" style={{ alignItems: 'baseline' }}>
          <p className="ko-lg" style={{ margin: 0 }} lang="ko">
            {question.lemma} <PronounceButton text={question.lemma} label={question.lemma} />
          </p>
          <span className="badge">{question.classLabel}</span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Scrivilo al <strong>{question.endingLabel}</strong> ({question.ending}) —{' '}
          {question.endingHint}.
        </p>

        {solved ? (
          <p className="flash-answer hangul" lang="ko">
            {question.answer}{' '}
            <PronounceButton text={question.answer} label={question.answer} />
          </p>
        ) : (
          <HangulInput
            value={value}
            onChange={setValue}
            onSubmit={check}
            placeholder="Scrivi la forma in coreano"
            autoFocus
          />
        )}

        {!solved ? (
          <div className="row" style={{ marginTop: '0.2rem' }}>
            <button type="button" className="btn btn--primary" onClick={check} disabled={value.trim().length === 0}>
              Controlla
            </button>
            <button type="button" className="btn btn--ghost" onClick={next}>
              Un'altra
            </button>
          </div>
        ) : null}

        {solved ? (
          <div className={`alert ${checked ? 'alert--ok' : 'alert--error'}`} aria-live="polite">
            <p>
              <strong>{checked ? 'Giusto' : 'Non ancora'}</strong> — forma attesa{' '}
              <span className="ko" lang="ko">
                {question.answer}
              </span>
            </p>
            <p className="small">{question.note}</p>
            <button type="button" className="btn" onClick={next} autoFocus>
              Un'altra
            </button>
          </div>
        ) : null}
      </section>

      <p className="faint small center" aria-live="polite">
        {tally.asked === 0 ? 'Nessuna risposta ancora' : `${tally.right} giuste su ${tally.asked}`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Particelle                                                                 */
/* -------------------------------------------------------------------------- */

function ParticleDrill() {
  const [question, setQuestion] = useState<ParticleQuestion>(() => buildParticleQuestion());
  const [picked, setPicked] = useState<string | null>(null);
  const [tally, setTally] = useState({ right: 0, asked: 0 });

  const solved = picked !== null;

  function answer(option: string) {
    if (solved) return;
    setPicked(option);
    setTally((current) => ({
      right: current.right + (option === question.answer ? 1 : 0),
      asked: current.asked + 1,
    }));
  }

  function next() {
    setQuestion(buildParticleQuestion());
    setPicked(null);
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row row--between" style={{ alignItems: 'baseline' }}>
          <p className="ko-lg" style={{ margin: 0 }} lang="ko">
            {question.noun}{' '}
            <PronounceButton text={question.noun} label={question.noun} />
          </p>
          <span className="faint small">{question.it}</span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Attacca la particella de/la <strong>{question.functionLabel}</strong> ({question.functionHint}).
        </p>

        <div className="options" role="group" aria-label="Scegli la forma giusta">
          {question.options.map((option) => {
            const state = !solved
              ? ''
              : option === question.answer
                ? ' option--ok'
                : option === picked
                  ? ' option--no'
                  : '';
            return (
              <button
                key={option}
                type="button"
                className={`option option--ko${state}`}
                lang="ko"
                disabled={solved}
                onClick={() => answer(option)}
              >
                {option}
              </button>
            );
          })}
        </div>

        {solved ? (
          <div
            className={`alert ${picked === question.answer ? 'alert--ok' : 'alert--error'}`}
            aria-live="polite"
          >
            <p>
              <strong>{picked === question.answer ? 'Giusto' : 'Non ancora'}</strong> — si scrive{' '}
              <span className="ko" lang="ko">
                {question.answer}
              </span>{' '}
              <PronounceButton text={question.answer} label={question.answer} />
            </p>
            <p className="small">{question.note}</p>
            <button type="button" className="btn" onClick={next} autoFocus>
              Un'altra
            </button>
          </div>
        ) : null}
      </section>

      <p className="faint small center" aria-live="polite">
        {tally.asked === 0 ? 'Nessuna risposta ancora' : `${tally.right} giuste su ${tally.asked}`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagina                                                                     */
/* -------------------------------------------------------------------------- */

export function PalestraPage() {
  const [mode, setMode] = useState<DrillId>('verbi');
  const current = DRILLS.find((drill) => drill.id === mode);

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">연습 · La palestra</p>
        <h1>La regola la sai, ora ripetila</h1>
        <p className="muted">
          Due esercizi senza fine, generati dalle stesse regole che correggono il percorso. Qui non
          c'è una lezione da chiudere e non si salva nulla: si ripete finché la radice irregolare e
          la particella non vengono da sole. Sono i due punti dove l'italiano non aiuta, e dove la
          mano impara più della spiegazione.
        </p>
      </header>

      <div className="chips" role="tablist" aria-label="Esercizio">
        {DRILLS.map((drill) => (
          <button
            key={drill.id}
            type="button"
            role="tab"
            className={drill.id === mode ? 'chip chip--on' : 'chip'}
            aria-selected={drill.id === mode}
            onClick={() => setMode(drill.id)}
          >
            {drill.label}
          </button>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: '-0.4rem' }}>
        {current?.blurb}
      </p>

      {mode === 'verbi' ? <VerbDrill /> : <ParticleDrill />}

      {mode === 'particelle' ? (
        <section className="card stack">
          <h2>La regola, in quattro righe</h2>
          <ul className="points">
            {PARTICLE_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="faint small" style={{ margin: 0 }}>
            Le particelle in gioco:{' '}
            {PARTICLE_FUNCTIONS.map((entry) => entry.label).join(' · ')}.
          </p>
        </section>
      ) : (
        <section className="card stack">
          <h2>Le classi delle radici</h2>
          <p className="muted">
            La palestra pesca da ogni classe. È la classe a decidere la forma, non la memoria:
            riconosciuta la classe, la desinenza si scrive da sé.
          </p>
          <ul className="points">
            {CONJUGATION_CLASSES.map((cls) => (
              <li key={cls.id}>
                <strong>{cls.label}</strong> — {cls.signal}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
