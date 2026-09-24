# Zela Payment Rails

Payment infrastructure for native USDC on **Arc** (Circle's stablecoin-native
L1). **Checkout** — this repo — is the first rail: a stablecoin checkout that
can be embedded on any website, like Stripe Checkout or Coinbase Commerce,
payable by Zela app users **or** holders of any EVM wallet. Further rails
(payouts, payment links, etc.) are expected to live alongside it as
independent products sharing the same account/settlement infrastructure —
see the "What's next" note at the bottom of this file.

- **Merchants** charge in USDC and get a hosted checkout page and/or a
  drop-in widget, an API + webhooks, and a dashboard.
- **Payers** can pay two ways: open the Zela app (deep link/QR,
  PIN-confirmed), or connect any EVM wallet in-browser.
- **Settlement is instant and swap-free** — USDC is the settlement currency
  directly, moved via its ERC-20 `transfer()` on Arc (the same interface
  the Zela app itself uses). There's no swap, no approval step.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full payment-flow
state machine, the fee model, and security notes.

## Repo layout

This is a pnpm + Turborepo monorepo — a separate project from `zela-app`/
`Zela-backend`/`zela-web` in this workspace, with no runtime dependency on
any of them.

```
zela-checkout/
├── apps/
│   ├── api/      Express + TypeScript — sessions, merchant accounts/dashboard,
│   │              webhooks, on-chain payment monitoring and settlement, Postgres.
│   └── web/      Next.js — the hosted checkout page (/pay/[sessionId]) and the
│                  merchant dashboard (/dashboard), with EVM wallet connect (wagmi).
├── packages/
│   ├── shared/   Shared TypeScript types + Arc network/token constants — the
│   │              single source of truth apps/api, apps/web, and the widget
│   │              all import from.
│   ├── widget/   The embeddable <script> widget — compiles to a small,
│   │              framework-agnostic vanilla-JS bundle that opens the hosted
│   │              checkout page in a modal iframe.
│   └── sdk/      A stripe-node-style server-side SDK for merchants
│                  (ZelaCheckoutClient) — wraps the REST API for Node backends.
└── docs/
    └── ARCHITECTURE.md
```

## Getting started

```bash
pnpm install

cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# fill in DATABASE_URL, SETTLEMENT_FEE_PAYER_SECRET_KEY, DEPOSIT_KEY_ENCRYPTION_KEY, etc.

pnpm --filter @zela-checkout/api migrate   # applies apps/api/src/db/migrations

pnpm dev   # runs api (:4100) and web (:4200) together via Turborepo
```

Defaults to Arc Testnet (`ARC_NETWORK=arc-testnet`), which has a real public
RPC out of the box. Set `ARC_NETWORK=arc-mainnet` and an RPC URL
(`ARC_MAINNET_RPC_URL`/`NEXT_PUBLIC_ARC_RPC_URL`) once you're ready to accept
real payments.

## Integration (merchant side)

**Widget** (fastest — drop-in, no build step required on the merchant's site):

```html
<script src="https://checkout.zelapay.xyz/widget.js"></script>
<script>
  ZelaCheckout.open({ publishableKey: "pk_live_...", amount: "19.99" });
</script>
```

**Server-side SDK** (when the merchant creates sessions from their own backend):

```ts
import { ZelaCheckoutClient } from "@zela-checkout/sdk";

const client = new ZelaCheckoutClient({ secretKey: process.env.ZELA_SECRET_KEY! });
const { checkoutUrl } = await client.sessions.create({ amount: "19.99" });
// redirect the customer to checkoutUrl, or use it as the widget's hosted-page fallback
```

**Webhooks** — register an endpoint from the dashboard (Settings → Webhook),
then verify each delivery's `X-Zela-Checkout-Signature` header
(HMAC-SHA256 of `timestamp.rawBody`, timestamp from
`X-Zela-Checkout-Timestamp`, keyed with your webhook secret) before trusting
a `checkout.session.completed` event.

## Fees

A flat **1%** platform fee on settled volume, deducted from the amount
forwarded to the merchant. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#fees).

## Status

Implemented and tested (27 API tests, including a full signup → session →
webhook flow, and a simulated settlement + refund sweep, against a real
Postgres engine and a fake Arc RPC): merchant signup/login and dashboard
(stats, transactions, API keys, webhook and payout settings), session
creation (secret-key and rate-limited publishable-key), encrypted deposit
keys, balance-based payment detection, native-USDC settlement with fee
split, manual refund sweeps for stuck (expired/underpaid) sessions, signed
webhook delivery with retries, an SSRF guard on merchant webhook URLs, and
the browser wallet-connect payment flow (wagmi, injected wallets).

Not yet done: WalletConnect (mobile wallets scanning to connect — injected
browser wallets like MetaMask work today), KMS-backed key management
(deposit keys are AES-256-GCM encrypted with a key from an env var today),
and a real funded-wallet dry run on Arc Testnet or mainnet. Search the repo
for `TODO` for the rest.

## What's next

Checkout is the first Zela Payment Rail — a one-time payment collection
product. It's built to be reusable infrastructure for whatever comes next:
merchant accounts, API keys, webhooks, encrypted deposit keys, and
native-USDC settlement on Arc are all product-agnostic already. The next
rail (payouts, payment links, something else) is an open decision — not
yet started.
