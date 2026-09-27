# Zela Payment Rails

Payment infrastructure for native USDC on **[Arc](https://www.circle.com/en/arc)**
(Circle's stablecoin-native L1) — three rails sharing one account,
settlement, and dashboard:

- **[Checkout](apps/web/app/docs/quickstart)** — a stablecoin checkout
  embeddable on any website (widget or hosted page), like Stripe Checkout
  or Coinbase Commerce. Payable by Zela app users **or** holders of any
  EVM wallet.
- **[Payment Links](apps/web/app/docs/payment-links)** — a reusable,
  no-code URL/QR for a fixed price or pay-what-you-want, shareable
  anywhere (a DM, an invoice, a donation page).
- **[Mini Apps](apps/web/app/docs/miniapps)** — third-party web apps that
  run *inside* the Zela mobile app, with a JS bridge SDK to charge the
  current user (Checkout) and pay them out — non-custodially.

- **Merchants** charge in USDC and get a hosted checkout page and/or a
  drop-in widget, an API + webhooks, and a dashboard.
- **Payers** pay two ways: open the Zela app (deep link/QR, PIN-confirmed),
  or connect any EVM wallet in-browser.
- **Settlement is instant and swap-free** — USDC is the settlement
  currency directly, moved via its ERC-20 `transfer()` on Arc (the same
  interface the Zela app itself uses). There's no swap, no approval step.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full
payment-flow state machine, the fee model, and security notes.

## Why Arc, and what about other chains

USDC is Arc's native gas asset, but every transfer in this repo goes
through its **ERC-20 interface** (`balanceOf`/`transfer`, 6 decimals) —
never the native/gas layer (18 decimals, the wei-denominated view of the
same underlying asset). That's not an arbitrary pick: it's the exact
interface [Zela](https://zelapay.xyz)'s own mobile wallet uses for every
send and receive, so a payment a Zela app user sends is visible to this
project's own balance reads, and vice versa, with nothing to bridge or
wrap in between. See [`packages/shared`](packages/shared/README.md) for
the chain IDs, contract address, and the full reasoning.

Arc is the **only** chain this repo settles in, by design — not a
limitation of the underlying wallet. The broader Zela app also supports
Solana, Ethereum, BNB Chain, and HyperEVM for its own peer-to-peer wallet
features; Payment Rails standardizes on Arc specifically because it's what
lets a merchant's settlement wallet and a paying Zela user's wallet live
in the exact same address space. If a future rail genuinely needs a
different chain, it's new type additions in `packages/shared`, not a
rewrite of anything downstream.

## Repo layout

This is a pnpm + Turborepo monorepo — a separate project from `zela-app`/
`Zela-backend`/`zela-web` in this workspace. It has one real integration
point with them: `Zela-backend` owns Zela user identity (Zela ID/email →
wallet), reached either via a local cross-schema Postgres read (for
`.zela.merchant` handles, same database, different schema) or a
service-to-service call authenticated by a shared secret (for resolving a
Mini App payout recipient — see `apps/api/src/services/payoutResolve.ts`).
Everything else here has no runtime dependency on those repos.

```
zela-checkout/
├── apps/
│   ├── api/            Express + TypeScript — sessions, payment links, Mini
│   │                    App payouts, merchant accounts/dashboard, webhooks,
│   │                    on-chain payment monitoring and settlement, Postgres.
│   │                    See apps/api/README.md.
│   └── web/            Next.js — the hosted checkout page, the merchant
│                        dashboard, and the marketing/docs site.
│                        See apps/web/README.md.
├── packages/
│   ├── shared/          Shared TypeScript types + Arc network/token constants —
│   │                    the source of truth every other package imports from.
│   │                    See packages/shared/README.md.
│   ├── widget/          The embeddable <script> checkout widget — a small,
│   │                    framework-agnostic vanilla-JS bundle.
│   │                    See packages/widget/README.md.
│   ├── sdk/             A stripe-node-style server-side SDK for merchants
│   │                    (ZelaCheckoutClient). See packages/sdk/README.md.
│   └── miniapp-sdk/     The Mini App SDK — server half (checkout + payouts)
│                        and browser half (the window.Zela bridge client).
│                        See packages/miniapp-sdk/README.md.
└── docs/
    └── ARCHITECTURE.md
```

Each folder's own README goes deeper than this one — start here for the
map, then follow the link for whichever piece you're working on.

## Getting started

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# fill in DATABASE_URL, SETTLEMENT_FEE_PAYER_SECRET_KEY, DEPOSIT_KEY_ENCRYPTION_KEY, etc.

pnpm --filter @zela-checkout/api migrate   # applies apps/api/src/db/migrations

pnpm dev   # runs api (:4100) and web (:4200) together via Turborepo
```

Defaults to `ARC_NETWORK=arc-mainnet`. For Arc Testnet, set
`ARC_NETWORK=arc-testnet` and `ARC_TESTNET_USDC_ADDRESS` — see
`apps/api/.env.example`, there's no verified default the way mainnet's
address is verified, so testnet needs it supplied explicitly.

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

**Mini App SDK** (a web app running inside the Zela mobile app):

```ts
import { Zela } from "@zela-checkout/miniapp-sdk/client";

await Zela.checkout({ publishableKey: "pk_live_...", amount: "4.99" });
```

See [`packages/miniapp-sdk`](packages/miniapp-sdk/README.md) for the full
picture, including non-custodial payouts.

**Webhooks** — register an endpoint from the dashboard (Settings →
Webhook), then verify each delivery's `X-Zela-Checkout-Signature` header
(HMAC-SHA256 of `timestamp.rawBody`, timestamp from
`X-Zela-Checkout-Timestamp`, keyed with your webhook secret) before
trusting a `checkout.session.completed` (or `payout.completed`) event.

## Fees

A flat **1%** platform fee on settled Checkout volume, deducted from the
amount forwarded to the merchant. Mini App payouts carry no platform fee —
they're a direct transfer from the Mini App's own wallet. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#fees).

## Status

Implemented and tested (32 API integration tests against a real Postgres
engine and a fake Arc RPC that decodes real ABI-encoded calls): merchant
signup/login (password or Firebase email/Google) and dashboard, session
creation (secret-key and rate-limited publishable-key), encrypted deposit
keys, balance-based payment detection, idempotent two-leg native-USDC
settlement with fee split and retry-safe recovery from a partial failure,
manual refund sweeps for stuck sessions, Payment Links, Mini App
directory listing + non-custodial payout resolve/verify/report, signed
webhook delivery with retries, an SSRF guard on merchant webhook URLs, a
global async-error handler (no route can hang a client with no response),
human-readable blockchain/RPC error messages everywhere they can surface,
login audit logging + active-session management, and the browser
wallet-connect payment flow (RainbowKit/wagmi, injected wallets and
WalletConnect).

Not yet done: KMS-backed key management (deposit keys are AES-256-GCM
encrypted with a key from an env var today), and a real funded-wallet dry
run on Arc mainnet at production volume. Search the repo for `TODO` for
the rest.

## What's next

Checkout, Payment Links, and Mini Apps are three rails on one shared
foundation — merchant accounts, API keys, webhooks, encrypted deposit
keys, and native-USDC settlement on Arc are all product-agnostic already.
The Mini App native host (the WebView + bridge inside the Zela mobile app
itself) is built and wired; broader Mini App discovery/curation and a
richer bridge surface (beyond checkout/getUser/close) are open next steps.
