import { useEffect, useRef, useState } from 'react';

interface Props {
  onResult: (code: string) => void;
  onClose: () => void;
}

/**
 * La fotocamera, per un solo gesto: leggere il QR che l'altro dispositivo sta
 * mostrando. Non registra, non salva, non manda niente: i fotogrammi si
 * decodificano nella scheda e si buttano via. `jsqr` arriva solo quando si
 * apre questa finestra, così il resto del sito non paga il suo peso.
 */
export function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Il callback cambia a ogni render del genitore: tenerlo in una ref evita di
  // spegnere e riaccendere la fotocamera a ogni battitura.
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;
    let found = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Questo browser non dà accesso alla fotocamera. Copia il codice come testo.');
        return;
      }

      try {
        const { default: jsQR } = await import('jsqr');

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        const video = videoRef.current;
        if (!video || cancelled) return;

        video.srcObject = stream;
        await video.play();

        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          setError('La scheda non riesce a leggere i fotogrammi.');
          return;
        }

        const tick = () => {
          if (cancelled || found) return;

          if (video.readyState >= 2 && video.videoWidth > 0) {
            // 640 pixel bastano a leggere un QR e tengono la decodifica leggera.
            const width = Math.min(640, video.videoWidth);
            const height = Math.round((video.videoHeight / video.videoWidth) * width);
            canvas.width = width;
            canvas.height = height;
            context.drawImage(video, 0, 0, width, height);

            const image = context.getImageData(0, 0, width, height);
            const decoded = jsQR(image.data, image.width, image.height, {
              inversionAttempts: 'dontInvert',
            });

            if (decoded?.data) {
              found = true;
              resultRef.current(decoded.data);
              return;
            }
          }

          frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
      } catch (problem) {
        const name = problem instanceof Error ? problem.name : '';
        if (name === 'NotAllowedError') {
          setError('Permesso negato: senza fotocamera il QR non si legge. Copia il codice.');
        } else if (name === 'NotFoundError') {
          setError('Nessuna fotocamera su questo dispositivo. Copia il codice.');
        } else {
          setError('Non riesco ad aprire la fotocamera. Copia il codice come testo.');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" playsInline muted />
      {error ? (
        <p className="alert alert--error">{error}</p>
      ) : (
        <p className="muted small">Inquadra il QR: appena è leggibile lo prendo da solo.</p>
      )}
      <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
        Chiudi la fotocamera
      </button>
    </div>
  );
}
