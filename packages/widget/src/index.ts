import { openCheckoutModal } from "./modal";
import type { CreateSessionResponse } from "@zela-checkout/shared";

export interface ZelaCheckoutOpenOptions {
  /** Publishable key — pk_live_/pk_test_. Safe to embed client-side. */
  publishableKey: string;
  /** Decimal string, in the merchant's settlement token. */
  amount: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  onClose?: () => void;
}

const DEFAULT_API_URL = "https://api.checkout.zelapay.xyz";

/**
 * Public widget API — usage on a merchant's site:
 *
 *   <script src="https://checkout.zelapay.xyz/widget.js"></script>
 *   <script>
 *     ZelaCheckout.open({ publishableKey: "pk_live_...", amount: "19.99" });
 *   </script>
 */
async function open(options: ZelaCheckoutOpenOptions): Promise<void> {
  // Open immediately with a loading spinner — creating the session is a
  // network round-trip, and waiting for it before showing anything leaves
  // a dead gap after the merchant's button is clicked where nothing
  // visibly happens (the classic "did my click register?" moment).
  const modal = openCheckoutModal(null, { onClose: options.onClose, loading: true });

  try {
    // Widget sessions use the publishable-key endpoint; secret keys never go in the browser.
    const res = await fetch(`${DEFAULT_API_URL}/v1/sessions/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Publishable-Key": options.publishableKey },
      body: JSON.stringify({
        amount: options.amount,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
        metadata: options.metadata,
      }),
    });

    if (!res.ok) throw new Error(`Failed to create checkout session: ${res.status}`);

    const data = (await res.json()) as CreateSessionResponse;
    modal.showIframe(data.checkoutUrl);
  } catch (err) {
    modal.showError("Couldn't start checkout. Please try again.");
    throw err;
  }
}

export const ZelaCheckout = { open };

// Also attach to window for the plain <script> tag usage shown above.
declare global {
  interface Window {
    ZelaCheckout?: typeof ZelaCheckout;
  }
}
if (typeof window !== "undefined") {
  window.ZelaCheckout = ZelaCheckout;
}
