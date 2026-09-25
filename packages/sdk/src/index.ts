import type {
  CreateSessionRequest,
  CreateSessionResponse,
  CheckoutSession,
} from "@zela-checkout/shared";

export interface ZelaCheckoutClientOptions {
  secretKey: string;
  apiUrl?: string;
}

/**
 * Thrown for any non-2xx API response. `message` is always a short,
 * human-readable sentence — the API itself normalizes blockchain/RPC
 * errors before they ever reach a response body (see apps/api/src/
 * services/blockchainError.ts), so this never surfaces a raw viem/RPC
 * error dump. `status`/`code` are there for programmatic handling;
 * `raw` keeps the original response body for debugging.
 */
export class ZelaCheckoutError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly raw: unknown;

  constructor(status: number, message: string, opts?: { code?: string; raw?: unknown }) {
    super(message);
    this.name = "ZelaCheckoutError";
    this.status = status;
    this.code = opts?.code;
    this.raw = opts?.raw;
  }
}

/**
 * Server-side Node.js SDK for merchants — a thin typed wrapper over the
 * REST API, in the spirit of stripe-node. Used from the merchant's own
 * backend (never the browser — it carries the secret key).
 *
 *   const client = new ZelaCheckoutClient({ secretKey: process.env.ZELA_SECRET_KEY! });
 *   const { checkoutUrl } = await client.sessions.create({ amount: "19.99" });
 */
export class ZelaCheckoutClient {
  private readonly secretKey: string;
  private readonly apiUrl: string;

  constructor(options: ZelaCheckoutClientOptions) {
    this.secretKey = options.secretKey;
    this.apiUrl = options.apiUrl ?? "https://api.payment.zelapay.xyz";
  }

  sessions = {
    create: async (
      req: CreateSessionRequest,
    ): Promise<CreateSessionResponse> => {
      return this.request<CreateSessionResponse>("POST", "/v1/sessions", req);
    },
    retrieve: async (sessionId: string): Promise<CheckoutSession> => {
      const data = await this.request<{ session: CheckoutSession }>(
        "GET",
        `/v1/sessions/${sessionId}`,
      );
      return data.session;
    },
  };

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      let message = `Request failed with status ${res.status}`;
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string") {
          message = (parsed as { error: string }).error;
        }
      } catch {
        // Non-JSON body (e.g. an upstream proxy/gateway error page) — keep the generic message above rather than dumping raw HTML/text.
      }
      throw new ZelaCheckoutError(res.status, message, { raw: parsed });
    }

    return res.json() as Promise<T>;
  }
}

export * from "@zela-checkout/shared";
