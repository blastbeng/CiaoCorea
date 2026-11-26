/**
 * Le due porte per sostenere il progetto: GitHub Sponsors per un sostegno
 * ricorrente, PayPal per un caffè una tantum. Gli indirizzi stanno qui perché
 * il fondo pagina e «Chi sono» devono puntare allo stesso posto: cambiarli
 * deve restare una modifica sola.
 */
export const SPONSORS_URL = 'https://github.com/sponsors/blastbeng';
export const PAYPAL_URL =
  'https://www.paypal.com/donate/?hosted_button_id=W8JMMLVY3G62C';

export function SupportButtons() {
  return (
    <div className="row support-actions">
      <a
        className="btn btn--sm btn--primary"
        href={PAYPAL_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        <span aria-hidden="true">☕</span> Offrimi un caffè
      </a>
      <a
        className="btn btn--sm btn--ghost"
        href={SPONSORS_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        <span aria-hidden="true">♥</span> Sponsor su GitHub
      </a>
    </div>
  );
}
