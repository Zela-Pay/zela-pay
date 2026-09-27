# @zela-checkout/web

The Next.js frontend for [Zela Payment Rails](../../README.md) — three
things in one app:

1. **The hosted checkout page** (`/pay/[sessionId]`, `/pay/link/[linkId]`)
   — what a customer actually sees and pays through, whether they arrived
   via the embeddable widget, a direct link, or a Payment Link. Settles in
   native USDC on **Arc**.
2. **The merchant dashboard** (`/dashboard/*`) — sign up, manage API keys,
   payment links, your Mini App listing and payouts, webhooks, your
   `.zela.merchant` payment ID, and account security.
3. **The public marketing site and docs** (`/`, `/docs/*`) — the product
   pitch and full API/SDK/widget/Mini App documentation.

## Paying: two ways

On the hosted checkout page, a customer picks one:

- **Zela app** — a deep link (`zela://pay?...`) or QR code, PIN-confirmed
  inside the Zela mobile app. The deep link carries the session's Arc
  network (mainnet/testnet); the app checks that against its own
  configured network before sending, so a sandbox session and a live app
  (or vice versa) can't silently mismatch.
- **Any EVM wallet** — RainbowKit + wagmi (`lib/wagmi.ts`), for MetaMask,
  Rabby, Coinbase Wallet, or WalletConnect-compatible mobile wallets. The
  checkout session's own `network` field decides which Arc chain
  (mainnet or testnet) the wallet is asked to switch to and send on — never
  a global environment default, since sandbox and live sessions can be
  open side by side.

Either path is a plain ERC-20 USDC `transfer()` on Arc to the session's
deposit address — see [`@zela-checkout/shared`](../../packages/shared/README.md)
for why that's the one interface used, never Arc's native/gas layer.

## Dashboard auth

Firebase Authentication (email/password + Google), with a two-step signup
(account first, then business details) and a shared split-screen layout
(`components/AuthLayout.tsx`) across login, signup, password reset, and
email verification. Password reset and email verification are entirely
Firebase-native — this app never sends an email itself. Session tokens
live in an httpOnly cookie, proxied server-side
(`app/api/auth/[action]/route.ts`, `app/api/dashboard/[...path]/route.ts`)
so the browser never holds a bearer token directly.

## Design system

Monochrome, dark-first ("Stark Minimal" — pure black/white/gray, no hue
accent), on the theory that a payments-infrastructure product should read
as precise rather than decorative. See `app/globals.css`'s own header
comment for the full rationale and token structure
(`--bg`/`--surface`/`--accent`/semantic status colors only).

## Structure

```
app/
├── page.tsx                     Marketing home page
├── docs/                        Documentation (API, SDK, widget, Mini Apps, webhooks, fees, security...)
├── pay/[sessionId]/             Hosted checkout page
├── pay/link/[linkId]/           Payment Link checkout page
├── login/, signup/, forgot-password/, reset-password/, verify-email/
│                                 Dashboard auth screens
├── dashboard/                   Merchant dashboard (stats, sessions, api-keys,
│                                 payment-links, mini-app, settings, transactions)
└── api/                         Server-side proxy routes (auth cookie handling,
                                  authenticated pass-through to the API)
components/                      ~30 client/server components — see individual
                                  files; most map 1:1 to a dashboard section or
                                  checkout-flow step
lib/                              API client helpers, format utilities, Arc/wagmi config
```

## Local development

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_FIREBASE_*, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

pnpm --filter @zela-checkout/web dev   # listens on :4200
```

Requires `apps/api` running (or a deployed instance) at
`NEXT_PUBLIC_API_URL` — this app has no database access or blockchain
logic of its own; every write and read goes through the API.

## Testing

```bash
pnpm --filter @zela-checkout/web typecheck
pnpm --filter @zela-checkout/web build
```

No component-level test suite yet — correctness here is covered by
`apps/api`'s integration tests (which exercise every endpoint this app
calls) plus manual verification of the actual UI. See the root
[README](../../README.md#status) for what's tested where.
