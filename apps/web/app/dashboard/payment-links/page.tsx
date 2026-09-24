import { apiFetch } from "../../../lib/api";
import { PaymentLinksManager } from "../../../components/PaymentLinksManager";

export default async function PaymentLinksPage() {
  const res = await apiFetch("/v1/dashboard/payment-links");
  const { paymentLinks } = await res.json();

  return (
    <>
      <div className="page-head">
        <h1>Payment links</h1>
        <p className="muted">
          A reusable link or QR code — no website integration needed. Each payment creates a real checkout session,
          same as the API or the widget.
        </p>
      </div>
      <PaymentLinksManager initialLinks={paymentLinks} />
    </>
  );
}
