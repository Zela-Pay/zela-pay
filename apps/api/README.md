# @zela-checkout/api

The backend for [Zela Payment Rails](../../README.md) — Express +
TypeScript, Postgres, and [viem](https://viem.sh) for everything on-chain.
Owns merchant accounts, checkout sessions, payment links, Mini App
payouts, webhooks, and the background job that watches deposit addresses
and settles payments in native USDC on **Arc**.

## What it does

A checkout session gets a freshly generated, ephemeral Arc address (the
private key encrypted at rest — see `services/keyVault.ts`). A background
poller (`services/paymentMonitor.ts`, driven by `jobs/runner.ts`) watches
that address's USDC balance; once it reaches the checkout amount, it
sweeps the funds out in two idempotent legs — the platform fee, then
whatever's left to the merchant's own settlement wallet — and fires a
signed `checkout.session.completed` webhook. Nothing about this is
custodial beyond that one ephemeral, per-session key, held only for the
lifetime of settling that specific payment.

Mini App payouts (`routes/payouts.ts`) work the other way around and are
**never custodial at all**: this API only resolves who a Mini App is
paying and verifies the transfer on-chain after the fact — the Mini App's
own backend signs and sends the transfer itself, from its own wallet.

## Routes

| Router | Mount | Auth | Purpose |
|---|---|---|---|
| `sessions.ts` | `/v1/sessions` | secret key / publishable key (`/public`) | Create and retrieve checkout sessions |
| `paymentLinks.ts` | `/v1/payment-links` | dashboard session (manage) / public (pay) | Reusable, no-code payment links |
| `payouts.ts` | `/v1/payouts` | secret key (production only) | Resolve a payout recipient, report + verify a transfer a Mini App already sent |
| `miniApps.ts` | `/v1/mini-apps` | none (public) | The Mini App directory the Zela app's own UI lists |
| `webhooks.ts` | `/v1/webhooks` | secret key | Register/rotate a merchant's webhook endpoint via the REST API |
| `auth.ts` | `/v1/auth` | — | Merchant signup/login/logout — password or Firebase (email/Google) |
| `dashboard.ts` | `/v1/dashboard` | dashboard session | Everything the merchant dashboard UI reads/writes: stats, sessions, API keys, payment links, Mini App manifest, payouts, `.zela.merchant` ID, webhook settings, security (sessions/login history), account settings |
| `zela.ts` | `/v1/zela` | rate-limited, public | Builds the "Pay with Zela" deep link for a session |

Full request/response shapes: [`/docs/api`](https://checkout.zelapay.xyz/docs/api).

## Settlement, in order

1. `sessionService.ts` creates a session, picking Arc mainnet or testnet
   based on whether the API key/link used is sandbox or live
   (`networkForMode()`).
2. `paymentMonitor.ts` polls every open session's deposit address
   (`usdcContract.ts`'s `usdcBalanceOf`, per-network client from
   `config/arcRpc.ts`).
3. Once funded, the session is atomically claimed (`awaiting_payment` →
   `settling`) so overlapping poll cycles can't double-settle.
4. `settlement.ts` sends the platform fee, then re-reads the *live*
   balance and sweeps the remainder to the merchant — deliberately not a
   single pre-computed amount, so a gas-estimate drift on the first leg
   can't strand the second. `funds_confirmed_at`/`fee_tx_hash` on the
   session row make retries after a partial failure resume correctly
   instead of either double-paying the fee or silently abandoning a
   session that was actually paid.
5. Any failure is recorded as a human-readable `last_settlement_error` on
   the session (see `services/blockchainError.ts`) instead of only going
   to the server console — a merchant (and, on the hosted checkout page,
   the paying customer) can see *why* a settlement attempt didn't go
   through, not just that it didn't.

## Security

- `express-async-errors` + a global error handler — no unhandled async
  rejection in a route can leave a request hanging with no response.
- Rate limiting (`middleware/rateLimit.ts`) on every sensitive route, with
  a baseline on the whole dashboard router.
- SSRF guard (`services/urlSafety.ts`) on every merchant-supplied webhook
  URL — rejects private/internal addresses unless explicitly overridden
  for local dev (`ALLOW_PRIVATE_WEBHOOK_URLS`).
- Deposit keys encrypted at rest (AES-256-GCM, `services/keyVault.ts`);
  API secret keys and dashboard session tokens stored only as hashes.
- Blockchain/RPC errors are normalized before they ever reach a response
  body (`services/blockchainError.ts`) — a raw viem error, RPC timeout, or
  on-chain revert reason never leaks to a merchant, an SDK caller, or a
  paying customer as-is.
- Login audit log + active dashboard session listing/revocation
  (`services/loginAudit.ts`, `routes/dashboard.ts`'s `/security/*`
  endpoints) — a merchant can see every login attempt and sign out any
  device that isn't theirs.
- Password reset and email verification are Firebase-native
  (`services/firebaseAdmin.ts`) — no email-sending infrastructure of this
  API's own to secure.

## Arc, and other chains

Every RPC call, balance read, and transfer in this service is Arc-only —
see [`@zela-checkout/shared`](../../packages/shared/README.md) for the
full explanation of why (the ERC-20 USDC interface specifically, not the
native gas layer) and how that scopes against the wider Zela ecosystem's
support for other chains elsewhere in the product. `config/arcRpc.ts`
keeps one `PublicClient` **per network** (mainnet, testnet) rather than a
single global client tied to whichever network the process defaults to —
a session created in sandbox mode must always resolve against the testnet
RPC/contract address, never accidentally fall through to mainnet's.

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL, SETTLEMENT_FEE_PAYER_SECRET_KEY, DEPOSIT_KEY_ENCRYPTION_KEY

pnpm --filter @zela-checkout/api migrate   # applies src/db/migrations in order
pnpm --filter @zela-checkout/api dev        # tsx watch src/index.ts, listens on :4100
```

Defaults to `ARC_NETWORK=arc-mainnet`. For testnet, set
`ARC_NETWORK=arc-testnet` and `ARC_TESTNET_USDC_ADDRESS` (see
`.env.example` — there's no verified default the way mainnet's address is
verified, so this one must be supplied explicitly).

### Deploying

This process runs `startJobRunner()` in-process alongside the HTTP
server — it needs a host that keeps a Node process alive continuously
(a VPS, Railway, Render, Fly.io). It cannot run on a serverless/edge
platform: the settlement poller would simply never fire between requests,
and payments would land on-chain successfully but never get detected.

## Testing

```bash
pnpm --filter @zela-checkout/api typecheck
pnpm --filter @zela-checkout/api test
```

The test suite (`src/__tests__/integration.test.ts`) runs the real Express
app against an in-process Postgres ([PGlite](https://github.com/electric-sql/pglite))
and a fake Arc JSON-RPC node that decodes real ABI-encoded calls — signup,
sessions, webhooks, settlement (including the two-leg sweep and its retry
behavior), refunds, payment links, and Mini App payouts (resolve, on-chain
verification, and rejection of mismatched recipients/amounts) are all
exercised end-to-end, not mocked at the service boundary.

## Migrations

`src/db/migrations/*.sql`, applied in order by `pnpm migrate`
(`src/db/migrate.ts`) — each one is idempotent (`ADD COLUMN IF NOT
EXISTS`, etc.) and safe to re-run. See each file's own header comment for
what it changes and why; the running total is the schema.
