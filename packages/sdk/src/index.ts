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
      throw new Error(`ZelaCheckout API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }
}

export * from "@zela-checkout/shared";
