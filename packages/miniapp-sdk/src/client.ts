/**
 * Browser half of the Mini App SDK — the ONLY code that runs inside the
 * WebView the Zela app hosts a Mini App in. Import this from your Mini
 * App's frontend bundle (never the server half, `@zela-checkout/miniapp-
 * sdk`'s default export, which needs Node and a secret key).
 *
 * ─── Bridge protocol ────────────────────────────────────────────────────────
 *
 * react-native-webview's own bidirectional messaging primitive, nothing
 * more: this file posts `{ id, method, params }` to
 * `window.ReactNativeWebView.postMessage(JSON.stringify(...))`, and listens
 * for `{ id, result }` / `{ id, error }` replies via the `message` event
 * (registered on both `window` and `document` — WebView message delivery
 * differs by platform: iOS fires on `window`, Android on `document`. See
 * zela-app's own `screens/MiniAppScreen.js` for the native side of this
 * exact protocol; the two files must agree on the shape or nothing works.
 *
 * There is no `Zela.requestPayout()` — a payout is always initiated by the
 * Mini App's own BACKEND (which holds the funds and the key), not this
 * client. `Zela.getUser()` is how the client finds out who to tell its own
 * backend to pay.
 */

export interface ZelaUser {
  /** The current Zela user's own identifier, e.g. "harry.zela" — pass this to your backend so it can call payouts.resolve(). */
  zelaId: string | null;
  /** The current Zela user's Arc (EVM) wallet address — informational only; never a private key. */
  arcAddress: string;
}

export interface CheckoutRequest {
  /** Your Mini App's PUBLISHABLE key (pk_live_/pk_test_) — safe for client-side use, same key the embeddable widget uses. Never your secret key here. */
  publishableKey: string;
  /** Decimal string, e.g. "4.99". */
  amount: string;
  metadata?: Record<string, string>;
  /** Defaults to https://api.payment.zelapay.xyz — override for a self-hosted deployment. */
  apiUrl?: string;
}

export interface CheckoutResult {
  sessionId: string;
  status: "settled";
}

const DEFAULT_API_URL = "https://api.payment.zelapay.xyz";

type BridgeMethod = "getUser" | "checkout" | "close";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const pending = new Map<string, PendingCall>();
let nextId = 0;

function isBridgeAvailable(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView?.postMessage === "function";
}

function call<T>(method: BridgeMethod, params?: unknown): Promise<T> {
  if (!isBridgeAvailable()) {
    return Promise.reject(new Error(`Zela.${method}() is only available inside the Zela app's Mini App host.`));
  }
  const id = `mac_${nextId++}`;
  const bridge = (window as unknown as { ReactNativeWebView: { postMessage: (s: string) => void } }).ReactNativeWebView;

  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    bridge.postMessage(JSON.stringify({ id, method, params }));
  });
}

function handleIncoming(raw: string) {
  let msg: { id?: string; result?: unknown; error?: string };
  try {
    msg = JSON.parse(raw);
  } catch {
    return; // not a message for us
  }
  if (!msg.id || !pending.has(msg.id)) return;

  const { resolve, reject } = pending.get(msg.id)!;
  pending.delete(msg.id);
  if (msg.error) reject(new Error(msg.error));
  else resolve(msg.result);
}

if (typeof window !== "undefined") {
  const listener = (e: MessageEvent | Event) => {
    const data = (e as MessageEvent).data;
    if (typeof data === "string") handleIncoming(data);
  };
  window.addEventListener("message", listener);
  document.addEventListener("message", listener as EventListener);
}

export const Zela = {
  /** True when running inside the Zela app's Mini App host — use this to render a fallback if your Mini App is also reachable as a plain website. */
  isAvailable: isBridgeAvailable,

  /** The current Zela user — never includes a private key or anything sensitive beyond their public identity/address. */
  getUser(): Promise<ZelaUser> {
    return call<ZelaUser>("getUser");
  },

  /**
   * Charges the current Zela user `amount` USDC. Creates the checkout
   * session itself via POST /v1/sessions/public (the exact same
   * publishable-key endpoint the embeddable widget uses — see
   * @zela-checkout/widget), then hands the session to the native host,
   * which shows a native confirmation and sends the payment directly from
   * the user's own already-connected Arc wallet — no QR, no "connect
   * wallet" step, no leaving the Mini App. Resolves once the on-chain
   * transfer is sent and confirmed; rejects if the user declines or the
   * transfer fails.
   */
  async checkout(req: CheckoutRequest): Promise<CheckoutResult> {
    const apiUrl = req.apiUrl ?? DEFAULT_API_URL;
    const res = await fetch(`${apiUrl}/v1/sessions/public`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-publishable-key": req.publishableKey },
      body: JSON.stringify({ amount: req.amount, metadata: req.metadata }),
    });
    const data = (await res.json().catch(() => ({}))) as { session?: { id: string }; error?: string };
    if (!res.ok || !data.session) {
      throw new Error(data.error ?? "Could not start checkout.");
    }
    return call<CheckoutResult>("checkout", { sessionId: data.session.id, apiUrl });
  },

  /** Closes the Mini App and returns to the Zela app's own UI. */
  close(): Promise<void> {
    return call<void>("close");
  },
};
