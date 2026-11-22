/**
 * Il trainer dei numeri.
 *
 * Il coreano ha due serie e la domanda vera non è «quale numero è» ma «quale
 * serie vuole questa parola»: 일곱 시 ma 사십 분, 세 권 ma 만 원. Qui ogni domanda
 * porta con sé la ragione della risposta, e le risposte sbagliate sono gli
 * errori che si fanno davvero.
 */
import { useState } from 'react';
import { PronounceButton } from '../components/PronounceButton';
import { NUMBER_MODES, buildQuestion, type NumberMode, type NumberQuestion } from '../numbers-drill';

const SINO: readonly [string, string][] = [
  ['0', '영 · 공'],
  ['1', '일'],
  ['2', '이'],
  ['3', '삼'],
  ['4', '사'],
  ['5', '오'],
  ['6', '육'],
  ['7', '칠'],
  ['8', '팔'],
  ['9', '구'],
  ['10', '십'],
  ['100', '백'],
  ['1.000', '천'],
  ['10.000', '만'],
  ['100.000.000', '억'],
];

const NATIVE: readonly [string, string][] = [
  ['1', '하나 · 한'],
  ['2', '둘 · 두'],
  ['3', '셋 · 세'],
  ['4', '넷 · 네'],
  ['5', '다섯'],
  ['6', '여섯'],
  ['7', '일곱'],
  ['8', '여덟'],
  ['9', '아홉'],
  ['10', '열'],
  ['20', '스물 · 스무'],
  ['30', '서른'],
  ['40', '마흔'],
  ['50', '쉰'],
  ['60', '예순'],
  ['70', '일흔'],
  ['80', '여든'],
  ['90', '아흔'],
];

const COUNTERS: readonly { system: string; items: string }[] = [
  { system: 'Nativo', items: '개 · 명 · 마리 · 권 · 장 · 대 · 잔 · 병 · 살 · 시 · 시간 · 달' },
  { system: 'Sino', items: '원 · 분 · 초 · 층 · 호 · 월 · 일 · 년 · 번 (linea, uscita) · 인분' },
];

const RULES: readonly string[] = [
  "L'ora vuole il nativo e i minuti il sino: 일곱 시 사십 분, mai 칠 시 마흔 분.",
  'I soldi vogliono il sino e le cifre si raggruppano a diecimila: 12.500원 = 만 이천 오백 원.',
  'Il nativo si ferma a 99: da lì in poi si conta col sino (백 명, 천 원).',
  'Davanti al contatore 1–4 diventano 한 · 두 · 세 · 네, e 20 diventa 스무: 스무 살.',
  'Al telefono le cifre si leggono una per una, e lo zero è 공: 공일공.',
];

export function NumbersPage() {
  const [mode, setMode] = useState<NumberMode>('sino');
  const [question, setQuestion] = useState<NumberQuestion>(() => buildQuestion('sino'));
  const [picked, setPicked] = useState<string | null>(null);
  const [tally, setTally] = useState({ right: 0, asked: 0 });

  const solved = picked !== null;

  function changeMode(next: NumberMode) {
    setMode(next);
    setQuestion(buildQuestion(next));
    setPicked(null);
  }

  function nextQuestion() {
    setQuestion(buildQuestion(mode));
    setPicked(null);
  }

  function answer(option: string) {
    if (solved) return;
    setPicked(option);
    setTally((current) => ({
      right: current.right + (option === question.answer ? 1 : 0),
      asked: current.asked + 1,
    }));
  }

  const current = NUMBER_MODES.find((item) => item.id === mode);

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">숫자 · I numeri</p>
        <h1>Due serie, una regola</h1>
        <p className="muted">
          Il coreano conta in due modi. La serie <strong>sino-coreana</strong> (일, 이, 삼…) serve per
          i soldi, i minuti, i numeri lunghi e i contatori moderni. La serie <strong>nativa</strong>{' '}
          (하나, 둘, 셋…) resta per le ore, l’età e per le cose che si contano con le dita: 사람,
          동물, 책. Non è una scelta stilistica: sbagliare serie è l’errore più tipico, e si sente
          subito.
        </p>
      </header>

      <section className="card stack" aria-labelledby="drill-title">
        <div className="row row--between">
          <h2 id="drill-title" className="sr-only">
            Esercizio
          </h2>
          <div className="chips" role="group" aria-label="Tipo di domanda">
            {NUMBER_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === mode ? 'chip chip--on' : 'chip'}
                aria-pressed={item.id === mode}
                onClick={() => changeMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="faint small" aria-live="polite">
            {tally.asked === 0 ? 'Ancora nessuna risposta' : `${tally.right} giuste su ${tally.asked}`}
          </p>
        </div>

        <p className="faint small">{current?.blurb}</p>

        <div className="num-question">
          <p className="num-prompt" lang="ko">
            {question.prompt}
          </p>
          <p className="num-hint">{question.hint}</p>
        </div>

        <div className="options" role="group" aria-label="Scegli la lettura giusta">
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
          <div className={`alert ${picked === question.answer ? 'alert--ok' : 'alert--error'}`} aria-live="polite">
            <p>
              <strong>{picked === question.answer ? 'Giusto' : 'Non ancora'}</strong>{' '}
              {picked === question.answer ? '' : `— la lettura è `}
              <span className="ko" lang="ko">
                {question.answer}
              </span>{' '}
              <PronounceButton text={question.answer} label={question.answer} />
            </p>
            <p className="small">{question.note}</p>
            <button type="button" className="btn" onClick={nextQuestion} autoFocus>
              Un’altra
            </button>
          </div>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="ref-title">
        <h2 id="ref-title">Le due serie, in tabella</h2>
        <div className="num-ref">
          <div>
            <h3>Sino-coreana</h3>
            <dl className="num-table">
              {SINO.map(([value, ko]) => (
                <div key={value}>
                  <dt>{value}</dt>
                  <dd className="ko" lang="ko">
                    {ko}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3>Nativa</h3>
            <p className="faint small">
              Dopo il punto, la forma che si usa davanti al contatore: 하나 → 한 개, 둘 → 두 명,
              스물 → 스무 살.
            </p>
            <dl className="num-table">
              {NATIVE.map(([value, ko]) => (
                <div key={value}>
                  <dt>{value}</dt>
                  <dd className="ko" lang="ko">
                    {ko}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3>Chi vuole quale serie</h3>
            <dl className="num-table num-table--counters">
              {COUNTERS.map((row) => (
                <div key={row.system}>
                  <dt>{row.system}</dt>
                  <dd className="ko" lang="ko">
                    {row.items}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="num-rules">
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
