import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { CONSONANTS, VOWELS } from '@ciaocorea/engine';

/**
 * «Scrittura»: si ripassa la forma con il dito o col mouse, e l'app confronta
 * il segno con la lettera stampata.
 *
 * Perché serve: leggere una lettera e saperla scrivere sono due cose diverse, e
 * finora il corso insegnava la prima. Qui la mano prova la seconda — la ㅓ non è
 * una ㅗ rovesciata per caso, e il ㄹ si fa in un modo che la pagina dell'alfabeto
 * può solo descrivere.
 *
 * Il confronto non è un voto: misura due cose e le dice in chiaro. Quanta parte
 * della lettera hai coperto, e quanto sei uscito fuori. Coprire poco vuol dire
 * che una parte manca; uscire troppo vuol dire che il tratto è andato altrove.
 * Una forma scritta a mano non sarà mai identica al carattere stampato: per
 * questo la tolleranza c'è, e il giudizio è largo.
 */

/** Il lato del foglio, in pixel CSS: il quaderno ha una misura sola. */
const SIZE = 320;

/** Le parole da ripassare: corte, comuni, e già nel percorso. */
const WORDS = [
  '나',
  '너',
  '물',
  '밥',
  '집',
  '책',
  '눈',
  '손',
  '사람',
  '학교',
  '한국',
  '친구',
  '가방',
  '고양이',
  '사과',
  '우유',
  '커피',
  '오늘',
];

type Mode = 'lettere' | 'parole';

interface Verdict {
  /** Quanta parte della lettera stampata è stata coperta. */
  coverage: number;
  /** Quanto del segno è finito fuori dalla lettera. */
  spill: number;
}

/** Un valore del foglio di stile, con un ripiego se il tema non lo definisce. */
function themeValue(canvas: HTMLCanvasElement, name: string, fallback: string): string {
  const value = getComputedStyle(canvas).getPropertyValue(name).trim();
  return value || fallback;
}

/** Il fonema in caratteri isolati: la lista della pagina dell'alfabeto. */
const LETTERS = [
  ...CONSONANTS.filter((letter) => letter.kind === 'base'),
  ...CONSONANTS.filter((letter) => letter.kind === 'aspirated'),
  ...CONSONANTS.filter((letter) => letter.kind === 'tense'),
  ...VOWELS,
];

export function WritingPracticePage() {
  const [mode, setMode] = useState<Mode>('lettere');
  const [glyph, setGlyph] = useState('ㄱ');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [empty, setEmpty] = useState(true);

  const guideRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const letter = LETTERS.find((item) => item.char === glyph);

  /** Il foglio: le righe di guida e la lettera da ripassare. */
  useEffect(() => {
    const canvas = guideRef.current;
    const ink = inkRef.current;
    if (!canvas || !ink) return;

    const dpr = window.devicePixelRatio || 1;
    for (const surface of [canvas, ink]) {
      surface.width = SIZE * dpr;
      surface.height = SIZE * dpr;
      surface.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, SIZE, SIZE);

    // Le righe del quaderno: aiutano a centrare, come sulla carta.
    context.strokeStyle = themeValue(canvas, '--line', '#e5e7eb');
    context.lineWidth = 1;
    context.setLineDash([5, 7]);
    context.beginPath();
    context.moveTo(SIZE / 2, 0);
    context.lineTo(SIZE / 2, SIZE);
    context.moveTo(0, SIZE / 2);
    context.lineTo(SIZE, SIZE / 2);
    context.stroke();

    // La lettera da ripassare, in chiaro: si vede sotto il tratto.
    context.setLineDash([]);
    context.fillStyle = themeValue(canvas, '--line-strong', '#cbd5e1');
    const family = themeValue(canvas, '--font-ko', 'sans-serif');
    const fontSize = [...glyph].length === 1 ? SIZE * 0.68 : SIZE * 0.44;
    context.font = `${fontSize}px ${family}`;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    // Si centra il segno, non la sua riga di testo: i caratteri coreani hanno
    // il loro spazio sopra e sotto, e chi ripassa deve trovare la lettera al
    // centro del quadrato, non dove capita.
    const metrics = context.measureText(glyph);
    const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    context.fillText(
      glyph,
      (SIZE - inkWidth) / 2 + metrics.actualBoundingBoxLeft,
      (SIZE + inkHeight) / 2 - metrics.actualBoundingBoxDescent,
    );

    const inkContext = ink.getContext('2d');
    inkContext?.clearRect(0, 0, SIZE, SIZE);
    setVerdict(null);
    setEmpty(true);
  }, [glyph, mode]);

  /** Il punto del foglio sotto il dito, in pixel del quaderno. */
  const pointOf = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIZE,
      y: ((event.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const startStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    const ink = inkRef.current;
    if (!ink) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = pointOf(event);
    setVerdict(null);
  };

  const moveStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ink = inkRef.current;
    const context = ink?.getContext('2d');
    if (!ink || !context) return;
    const point = pointOf(event);
    context.strokeStyle = themeValue(ink, '--ink', '#111827');
    context.lineWidth = SIZE * 0.055;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(last.current.x, last.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    last.current = point;
    setEmpty(false);
  };

  const endStroke = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = useCallback(() => {
    const ink = inkRef.current;
    ink?.getContext('2d')?.clearRect(0, 0, SIZE, SIZE);
    setVerdict(null);
    setEmpty(true);
  }, []);

  /**
   * Il confronto fra i due fogli. Si guarda la lettera stampata e il tratto:
   * quanto della prima è coperto dal secondo, e quanto del secondo è finito
   * fuori. Un margine di due pixel perdona la mano, che non è un carattere.
   */
  const check = () => {
    const guide = guideRef.current;
    const ink = inkRef.current;
    if (!guide || !ink) return;
    const guideData = guide.getContext('2d')?.getImageData(0, 0, guide.width, guide.height).data;
    const inkData = ink.getContext('2d')?.getImageData(0, 0, ink.width, ink.height).data;
    if (!guideData || !inkData) return;

    const width = guide.width;
    const height = guide.height;
    const limit = 2 * (window.devicePixelRatio || 1);

    const isGuide = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return (guideData[(y * width + x) * 4 + 3] ?? 0) > 40;
    };

    let guideCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isGuide(x, y)) guideCount++;
      }
    }

    let inkCount = 0;
    let inside = 0;
    let outside = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((inkData[(y * width + x) * 4 + 3] ?? 0) <= 40) continue;
        inkCount++;
        let near = false;
        for (let dy = -limit; dy <= limit && !near; dy += 1) {
          for (let dx = -limit; dx <= limit && !near; dx += 1) {
            if (isGuide(x + dx, y + dy)) near = true;
          }
        }
        if (near) inside++;
        else outside++;
      }
    }

    if (inkCount === 0) return;
    setVerdict({
      coverage: guideCount === 0 ? 0 : inside / guideCount,
      spill: outside / inkCount,
    });
  };

  return (
    <div className="stack">
      <header className="stack stack--tight">
        <p className="faint small">쓰기 · Scrivere</p>
        <h1>Scrivere con la mano</h1>
        <p className="muted">
          Ripassa la lettera in chiaro con il dito o con il mouse, poi confronta: l&rsquo;app dice
          quanta parte hai coperto e quanto sei uscito fuori. Non è un voto — è un modo per
          accorgersi che la ㅓ scende a sinistra e che il ㄹ ha un angolo in più.
        </p>
      </header>

      <section className="card stack" aria-labelledby="trace-title">
        <div className="row">
          <h2 id="trace-title">{mode === 'lettere' ? 'Una lettera' : 'Una parola'}</h2>
          <div className="chips" role="group" aria-label="Cosa vuoi scrivere">
            <button
              type="button"
              className={'btn btn--sm' + (mode === 'lettere' ? ' btn--primary' : '')}
              onClick={() => {
                setMode('lettere');
                setGlyph('ㄱ');
              }}
            >
              Lettere
            </button>
            <button
              type="button"
              className={'btn btn--sm' + (mode === 'parole' ? ' btn--primary' : '')}
              onClick={() => {
                setMode('parole');
                setGlyph('물');
              }}
            >
              Parole
            </button>
          </div>
        </div>

        <div className="chips" role="group" aria-label="Scegli cosa ripassare">
          {(mode === 'lettere' ? LETTERS.map((item) => item.char) : WORDS).map((item) => (
            <button
              key={item}
              type="button"
              className={'chip chip--ko' + (glyph === item ? ' chip--on' : '')}
              lang="ko"
              aria-pressed={glyph === item}
              onClick={() => setGlyph(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {letter && (
          <p className="small muted">
            <strong lang="ko">{letter.name}</strong> · {letter.rr} · {letter.ipa}
          </p>
        )}

        <div className="trace">
          <div className="trace__stage">
            <canvas ref={guideRef} className="trace__canvas" aria-hidden="true" />
            <canvas
              ref={inkRef}
              className="trace__canvas trace__ink"
              role="img"
              aria-label={`Foglio per ripassare ${glyph}`}
              onPointerDown={startStroke}
              onPointerMove={moveStroke}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
            />
          </div>

          <div className="stack stack--tight">
            <div className="row">
              <button type="button" className="btn btn--primary" onClick={check} disabled={empty}>
                Confronta
              </button>
              <button type="button" className="btn" onClick={clear} disabled={empty}>
                Cancella
              </button>
            </div>

            {verdict && (
              <div className="trace__verdict" role="status">
                <p className="small">
                  Coperto: <strong>{Math.round(verdict.coverage * 100)}%</strong> · fuori dalla
                  forma: <strong>{Math.round(verdict.spill * 100)}%</strong>
                </p>
                <p className="small">
                  {verdict.coverage >= 0.7 && verdict.spill <= 0.35
                    ? 'La forma c’è: la lettera si riconosce.'
                    : verdict.coverage < 0.7
                      ? 'Manca un pezzo: guarda dove la lettera stampata resta scoperta e riprendi da lì.'
                      : 'Sei uscito troppo dalla forma: prova a seguire il bordo senza allargare il tratto.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>Tre cose da sapere prima di scrivere</h2>
        <ul className="trace__rules">
          <li>
            <strong>Dall&rsquo;alto verso il basso.</strong> I tratti verticali scendono: la ㅓ ha
            l&rsquo;asta che scende, la ㅗ la linea che corre a destra.
          </li>
          <li>
            <strong>Da sinistra verso destra.</strong> La ㅏ mette il trattino a destra
            dell&rsquo;asta, la ㅓ a sinistra: la direzione è la stessa, il lato no.
          </li>
          <li>
            <strong>Ogni sillaba sta in un quadrato.</strong> 가 è ㄱ e ㅏ nello stesso blocco, non
            due lettere in fila: è il quadrato che decide dove finisce una sillaba.
          </li>
        </ul>
      </section>
    </div>
  );
}
