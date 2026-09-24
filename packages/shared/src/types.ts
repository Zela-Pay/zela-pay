import type { ArcNetwork, SettlementToken } from "./tokens.js";

// ─── Merchant ──────────────────────────────────────────────────────────────

export interface Merchant {
  id: string;
  name: string;
  settlementWallet: string; // merchant's Arc (EVM) address that receives the settled USDC
  settlementToken: SettlementToken;
  webhookUrl: string | null;
  webhookSecret: string | null; // used to HMAC-sign webhook payloads
  createdAt: string;
}

export interface ApiKeyPair {
  publishableKey: string; // pk_live_/pk_test_ — safe to embed client-side
  secretKey: string; // sk_live_/sk_test_ — server-side only, shown once on creation
}

// ─── Payment session ───────────────────────────────────────────────────────

export type SessionStatus =
  | "awaiting_payment" // watching the deposit address for a native-USDC transfer
  | "settling" // transfer seen; sweeping to the merchant and platform
  | "settled" // funds delivered to merchant.settlementWallet
  | "expired" // payer never paid within the session TTL
  | "failed";

export type PaymentPath =
  | "zela_app" // deep link / in-app QR scan, PIN-confirmed inside Zela
  | "wallet_connect" // MetaMask/Rabby/Coinbase Wallet etc. via an injected EVM wallet
  | "qr_code"; // EIP-681 payment URI QR, scanned by any EVM wallet

export interface CheckoutSession {
  id: string;
  merchantId: string;
  network: ArcNetwork;

  // What the merchant is charging — always native USDC on Arc.
  amountSettlement: string; // decimal string, e.g. "19.99"
  settlementToken: SettlementToken;

  // Populated once the payer picks how they're paying.
  paymentPath: PaymentPath | null;
  payerAddress: string | null;

  // The ephemeral deposit address this session watches for an incoming transfer.
  depositAddress: string;

  // Set if this session was created by a customer paying through a
  // Payment Link rather than a merchant-initiated API call.
  paymentLinkId: string | null;

  status: SessionStatus;

  // Set once a qualifying transfer is observed on-chain.
  paymentTxHash: string | null;
  // Set once the sweep to the merchant + platform fee wallet confirms.
  settlementTxHash: string | null;
  // Set if a stuck balance (expired or underpaid session) was manually swept
  // back out — see docs/ARCHITECTURE.md "Refunds". No fee is taken on this.
  refundTxHash: string | null;
  refundTo: string | null;

  platformFeeBps: number;
  platformFeeAmount: string | null; // decimal string, in settlementToken units, once known

  successUrl: string | null;
  cancelUrl: string | null;
  metadata: Record<string, string>;

  createdAt: string;
  expiresAt: string;
}

// ─── Payment Links ──────────────────────────────────────────────────────────
// The second Zela Payment Rail: a reusable, shareable URL/QR. Each visit
// that actually pays creates a real CheckoutSession (see paymentLinkId
// above) — a Payment Link is a template for sessions, not a payment itself.

export interface PaymentLink {
  id: string;
  merchantId: string;
  name: string;
  amount: string | null; // null = the payer chooses the amount
  settlementToken: SettlementToken;
  successUrl: string | null;
  cancelUrl: string | null;
  metadata: Record<string, string>;
  active: boolean;
  // Sandbox links settle on Arc testnet, production links on mainnet — see
  // sessionService.ts's networkForMode(). Chosen once at creation time,
  // same as an API key's test/live split.
  isTest: boolean;
  createdAt: string;
}

export interface CreatePaymentLinkRequest {
  name: string;
  amount?: string; // omit for an open/"pay what you want" link
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentLinkResponse {
  paymentLink: PaymentLink;
  linkUrl: string; // hosted page URL: https://checkout.zelapay.xyz/pay/link/<id>
}

// ─── Webhooks ──────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "checkout.session.failed";

export interface WebhookEvent<T = CheckoutSession> {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: T;
}

// ─── API request/response DTOs ─────────────────────────────────────────────

export interface CreateSessionRequest {
  amount: string; // decimal string in the merchant's settlement token
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreateSessionResponse {
  session: CheckoutSession;
  checkoutUrl: string; // hosted page URL: https://checkout.zelapay.xyz/pay/<id>
}
