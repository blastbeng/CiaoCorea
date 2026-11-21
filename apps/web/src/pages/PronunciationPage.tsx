import { useMemo, useState } from 'react';
import {
  decomposeSyllable,
  isHangulSyllable,
  jamoInfo,
  pronunciationRomanize,
  romanizeSyllable,
  romanizeWord,
} from '@ciaocorea/engine';
import { PronounceButton } from '../components/PronounceButton';

/**
 * Il laboratorio di pronuncia: si scrive una parola e si vede che cosa dice la
 * scrittura e che cosa si sente. Non è un dizionario — la forma verificata delle
 * parole del corso resta quella delle lezioni — ma è il posto dove capire
 * *perché* 꽃이 si legge «kkochi» e non «kkoti».
 */

interface Rule {
  name: string;
  korean: string;
  what: string;
  examples: Array<{ ko: string; bracket: string; rr: string }>;
}

/**
 * Le regole sono quelle del 표준 발음법 (pronuncia standard) e della
 * romanizzazione riveduta; gli esempi sono quelli delle due norme, non
 * inventati. Sono poche e stabili: bastano a spiegare quasi tutte le parole
 * che lo studente incontra.
 */
const RULES: Rule[] = [
  {
    name: 'Liaison',
    korean: '연음',
    what: 'La consonante finale non resta sola: se la sillaba dopo comincia per vocale, passa lì e diventa la sua iniziale.',
    examples: [
      { ko: '밥이', bracket: '[바비]', rr: 'babi' },
      { ko: '옷을', bracket: '[오슬]', rr: 'oseul' },
      { ko: '꽃이', bracket: '[꼬치]', rr: 'kkochi' },
    ],
  },
  {
    name: 'Aspirazione',
    korean: '격음화',
    what: 'ㄱ, ㄷ, ㅂ, ㅈ incontrano una ㅎ e diventano ㅋ, ㅌ, ㅍ, ㅊ. La ㅎ finale, davanti a vocale, invece cade.',
    examples: [
      { ko: '좋고', bracket: '[조코]', rr: 'joko' },
      { ko: '놓다', bracket: '[노타]', rr: 'nota' },
      { ko: '낳지', bracket: '[나치]', rr: 'nachi' },
      { ko: '좋아', bracket: '[조아]', rr: 'joa' },
    ],
  },
  {
    name: 'Nasalizzazione',
    korean: '비음화',
    what: 'Davanti a ㄴ o ㅁ, i suoni ㄱ, ㄷ, ㅂ si chiudono nel naso e diventano ㅇ, ㄴ, ㅁ.',
    examples: [
      { ko: '국민', bracket: '[궁민]', rr: 'gungmin' },
      { ko: '백마', bracket: '[뱅마]', rr: 'baengma' },
      { ko: '밥물', bracket: '[밤물]', rr: 'bammul' },
    ],
  },
  {
    name: 'Laterale',
    korean: '유음화',
    what: 'ㄴ e ㄹ, quando si toccano, suonano tutte e due come ㄹ: la lingua passa da un suono all\'altro senza staccarsi.',
    examples: [
      { ko: '신라', bracket: '[실라]', rr: 'silla' },
      { ko: '설날', bracket: '[설랄]', rr: 'seollal' },
      { ko: '별내', bracket: '[별래]', rr: 'byeollae' },
    ],
  },
  {
    name: 'Palatalizzazione',
    korean: '구개음화',
    what: 'ㄷ e ㅌ davanti a 이 diventano ㅈ e ㅊ: la lingua si avvicina al palato e il suono cambia.',
    examples: [
      { ko: '같이', bracket: '[가치]', rr: 'gachi' },
      { ko: '굳이', bracket: '[구지]', rr: 'guji' },
      { ko: '해돋이', bracket: '[해도지]', rr: 'haedoji' },
    ],
  },
  {
    name: 'Finali doppi',
    korean: '겹받침',
    what: 'Due consonanti in fondo alla sillaba non si sentono mai tutte e due: a fine parola se ne chiude una sola, davanti a vocale si dividono fra le due sillabe.',
    examples: [
      { ko: '닭', bracket: '[닥]', rr: 'dak' },
      { ko: '값', bracket: '[갑]', rr: 'gap' },
      { ko: '값이', bracket: '[갑씨]', rr: 'gapsi' },
      { ko: '앉아', bracket: '[안자]', rr: 'anja' },
    ],
  },
  {
    name: 'Consonanti tese',
    korean: '된소리',
    what: 'La romanizzazione riveduta non scrive il raddoppio che si sente: 학교 si pronuncia [학꾜] ma si scrive hakgyo. La pronuncia tesa la imparano l\'orecchio e l\'audio, non le lettere.',
    examples: [
      { ko: '학교', bracket: '[학꾜]', rr: 'hakgyo' },
      { ko: '압구정', bracket: '[압꾸정]', rr: 'Apgujeong' },
      { ko: '있다', bracket: '[읻따]', rr: 'itda' },
    ],
  },
];

/** Le parole che si provano per prime: ognuna mostra una regola diversa. */
const SAMPLES = ['꽃이', '좋다', '국민', '신라', '같이', '닭', '값이', '학교', '싫어', '많다'];

export function PronunciationPage() {
  const [typed, setTyped] = useState('꽃이');

  // Si guarda la prima parola coreana scritta: il resto (spazi, punteggiatura,
  // una traduzione incollata per sbaglio) non serve al laboratorio.
  const word = useMemo(() => typed.match(/[가-힣]+/u)?.[0] ?? '', [typed]);
  const syllables = useMemo(
    () => Array.from(word).filter((char) => isHangulSyllable(char)),
    [word],
  );

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">소리 · La pronuncia</p>
        <h1>Come si legge davvero</h1>
        <p className="muted">
          In coreano la scrittura non cambia quando cambia la pronuncia: la parola resta scritta
          com'è, ma le consonanti si incontrano e si trasformano. Qui puoi scrivere una parola e
          vedere le due cose separate — che cosa dice la scrittura e che cosa si sente.
        </p>
      </header>

      <section className="card stack" aria-labelledby="lab-title">
        <h2 id="lab-title">Laboratorio</h2>
        <label className="stack stack--tight">
          <span className="small">Una parola in coreano</span>
          <input
            className="input input--ko"
            lang="ko"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="꽃이"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="sample-row">
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              className={sample === word ? 'chip chip--on' : 'chip'}
              lang="ko"
              onClick={() => setTyped(sample)}
            >
              {sample}
            </button>
          ))}
        </div>

        {word === '' ? (
          <p className="muted">Scrivi una parola in hangul: per esempio 꽃이.</p>
        ) : (
          <div className="stack" aria-live="polite">
            <div className="reading-row">
              <span className="reading-big ko" lang="ko">
                {word}
              </span>
              <div className="stack stack--tight">
                <span>
                  <span className="faint small">pronuncia ricostruita · </span>
                  <strong>{pronunciationRomanize(word)}</strong>
                </span>
                <span>
                  <span className="faint small">sillaba per sillaba · </span>
                  <span className="muted">{romanizeWord(word)}</span>
                </span>
                <PronounceButton text={word} label={word} />
              </div>
            </div>

            <div className="syllable-row">
              {syllables.map((syllable, index) => {
                const parts = decomposeSyllable(syllable);
                const letters = [
                  parts?.lead ? { char: parts.lead, role: 'iniziale' } : null,
                  parts?.vowel ? { char: parts.vowel, role: 'vocale' } : null,
                  parts?.tail ? { char: parts.tail, role: 'finale' } : null,
                ].filter((letter): letter is { char: string; role: string } => letter !== null);

                return (
                  <div key={`${syllable}-${index}`} className="syllable-card">
                    <span className="syllable-char ko" lang="ko">
                      {syllable}
                    </span>
                    <span className="faint small">{romanizeSyllable(syllable)}</span>
                    <ul className="syllable-parts">
                      {letters.map((letter) => (
                        <li key={letter.role}>
                          <span className="ko">{letter.char}</span>{' '}
                          <span className="faint small">
                            {jamoInfo(letter.char)?.name ?? letter.role}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <PronounceButton text={syllable} label={syllable} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="faint small">
          La forma ricostruita applica le regole qui sotto. Non è un dizionario: quando una parola è
          nel corso, la romanizzazione che trovi nella lezione è quella verificata. E se il
          dispositivo ha una voce coreana, l'audio è la prova migliore.
        </p>
      </section>

      <section className="stack" aria-labelledby="rules-title">
        <h2 id="rules-title">Le regole che contano</h2>
        <p className="muted">
          Sono le regole della pronuncia standard coreana (표준 발음법) applicate dalla
          romanizzazione riveduta. Gli esempi fra parentesi quadre sono la pronuncia, quella che
          scriveremmo in un dizionario coreano.
        </p>
        <div className="rule-grid">
          {RULES.map((rule) => (
            <article key={rule.korean} className="card stack stack--tight">
              <h3>
                {rule.name} <span className="faint small">{rule.korean}</span>
              </h3>
              <p className="small">{rule.what}</p>
              <ul className="rule-examples">
                {rule.examples.map((example) => (
                  <li key={example.ko}>
                    <button
                      type="button"
                      className="rule-example"
                      onClick={() => setTyped(example.ko)}
                      title="Prova nel laboratorio"
                    >
                      <span className="ko" lang="ko">
                        {example.ko}
                      </span>
                      <span className="faint">{example.bracket}</span>
                      <span className="rule-example-rr">{example.rr}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
