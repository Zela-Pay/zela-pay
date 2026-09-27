/**
 * Server half of the Mini App SDK — for your Mini App's own backend
 * (Node.js). Never import this from browser code; it expects your secret
 * key. For the browser half that runs inside the Zela app's WebView, see
 * `@zela-checkout/miniapp-sdk/client`.
 *
 *   import { ZelaMiniAppClient } from "@zela-checkout/miniapp-sdk";
 *
 *   const client = new ZelaMiniAppClient({ secretKey: process.env.ZELA_SECRET_KEY! });
 *
 *   // Checkout: same session API the checkout SDK already has.
 *   const { checkoutUrl } = await client.sessions.create({ amount: "4.99" });
 *
 *   // Payout — always non-custodial (see this package's own README/
 *   // apps/web's /docs/miniapps for the full explanation): resolve the
 *   // recipient, send the transfer YOURSELF with your own wallet/key
 *   // (e.g. via viem, however you already sign transactions), then report
 *   // the hash so Zela can verify it and show it in the user's history.
 *   const { walletAddress } = await client.payouts.resolve("harry.zela");
 *   const txHash = await sendUsdcYourself(walletAddress, "2.50");
 *   await client.payouts.report({ toIdentifier: "harry.zela", txHash, amount: "2.50" });
 */

import { ZelaCheckoutClient, ZelaCheckoutError, type ZelaCheckoutClientOptions } from "@zela-checkout/sdk";
import type { Payout, PayoutResolveResponse } from "@zela-checkout/shared";

export { ZelaCheckoutError };
export type { ZelaUser, CheckoutRequest, CheckoutResult } from "./client.js";

export interface PayoutReportRequest {
  /** Whatever you passed to payouts.resolve() — a Zela ID, email, or merchant ID. */
  toIdentifier: string;
  /** The on-chain transaction hash of the transfer you already sent. */
  txHash: string;
  /** Decimal string — must match what the transaction actually transferred. */
  amount: string;
}

/**
 * Composes a ZelaCheckoutClient (unchanged checkout behavior, exposed as
 * `.sessions`) rather than extending it — its `apiUrl`/`secretKey` fields
 * are private to that class, so a subclass can't reuse them without
 * redeclaring fields of the same name, which TypeScript treats as a real
 * type conflict even though the values would be identical.
 */
export class ZelaMiniAppClient {
  readonly sessions: ZelaCheckoutClient["sessions"];
  private readonly apiUrl: string;
  private readonly secretKey: string;

  constructor(options: ZelaCheckoutClientOptions) {
    const checkout = new ZelaCheckoutClient(options);
    this.sessions = checkout.sessions;
    this.apiUrl = options.apiUrl ?? "https://api.payment.zelapay.xyz";
    this.secretKey = options.secretKey;
  }

  private async payoutRequest<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.secretKey}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    let message = `Request failed with status ${res.status}`;
    try {
      parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string") {
        message = (parsed as { error: string }).error;
      }
    } catch {
      // non-JSON body — keep the generic message
    }
    if (!res.ok) throw new ZelaCheckoutError(res.status, message, { raw: parsed });
    return parsed as T;
  }

  payouts = {
    /** Resolves who to pay — a Zela ID (e.g. "harry.zela"), email, or merchant ID (e.g. "store.zela.merchant"). Only tells you where to send funds; never moves anything. */
    resolve: (to: string): Promise<PayoutResolveResponse> => this.payoutRequest<PayoutResolveResponse>("/v1/payouts/resolve", { to }),

    /** Reports a payout you already sent yourself. Zela verifies the transaction on-chain (recipient, amount, token all have to match) before recording it. */
    report: (req: PayoutReportRequest): Promise<{ payout: Payout }> => this.payoutRequest<{ payout: Payout }>("/v1/payouts", req),
  };
}

export * from "@zela-checkout/shared";
