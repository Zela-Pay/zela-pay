# @zela-checkout/sdk

[![npm](https://img.shields.io/npm/v/@zela-checkout/sdk)](https://www.npmjs.com/package/@zela-checkout/sdk)

A typed, server-side Node.js client for [Zela Payment Rails](../../README.md)
— a thin wrapper over the REST API, in the spirit of `stripe-node`. Use this
from your own backend to create checkout sessions that settle in native
USDC on **Arc**.

This is the merchant-facing SDK. If you're building a Mini App that runs
inside the Zela mobile app instead, see
[`@zela-checkout/miniapp-sdk`](../miniapp-sdk/README.md), which wraps this
package and adds payouts.

## Install

```bash
npm install @zela-checkout/sdk
```

## Usage

```ts
import { ZelaCheckoutClient } from "@zela-checkout/sdk";

const client = new ZelaCheckoutClient({
  secretKey: process.env.ZELA_SECRET_KEY!, // sk_live_... or sk_test_...
});

const { session, checkoutUrl } = await client.sessions.create({
  amount: "19.99",
  successUrl: "https://your.site/thanks",
  metadata: { orderId: "ord_123" },
});

// redirect your customer to checkoutUrl
console.log(session.id, session.status); // "cs_...", "awaiting_payment"
```

```ts
const session = await client.sessions.retrieve("cs_...");
console.log(session.status); // "awaiting_payment" | "settling" | "settled" | "expired" | "failed"
console.log(session.network); // "arc-mainnet" | "arc-testnet"
```

Never send a secret key (`sk_...`) to the browser — this client is for
server-side use only. For client-side/browser checkout, use
[`@zela-checkout/widget`](../widget/README.md) with a **publishable** key
(`pk_...`) instead.

## Sandbox vs. production

A secret key is either sandbox (`sk_test_...`) or live (`sk_live_...`),
issued from the merchant dashboard. Sandbox sessions settle on **Arc
Testnet**; live sessions settle on **Arc mainnet**. Nothing about how you
call this SDK changes — the key you pass in decides which network the
resulting session is created on.

## Error handling

Every non-2xx response throws `ZelaCheckoutError`, never a raw error from
the underlying HTTP call:

```ts
import { ZelaCheckoutError } from "@zela-checkout/sdk";

try {
  await client.sessions.create({ amount: "19.99" });
} catch (err) {
  if (err instanceof ZelaCheckoutError) {
    console.error(err.status, err.message); // e.g. 400, "amount must be a positive decimal string"
  }
}
```

`message` is always a short, human-readable sentence — the API itself
normalizes any underlying blockchain/RPC error before it ever reaches a
response body, so you'll never see a raw viem/RPC stack trace here.
`status` and `code` are there for programmatic handling; `raw` keeps the
original response body if you need to inspect it.

## Arc, and other chains

Every session this SDK creates settles in native USDC on **Arc** (Circle's
stablecoin L1) — see [`@zela-checkout/shared`](../shared/README.md) for why
that's the one chain Checkout supports, and what "native USDC" means there
specifically (the ERC-20 interface, not the 18-decimal gas layer). The
wider Zela ecosystem this SDK is part of also supports Solana, Ethereum,
BNB Chain, and HyperEVM for its own wallet features — Checkout itself
stays Arc-only by design, so a merchant's settlement wallet and a paying
Zela user's wallet are always in the same address space with nothing to
bridge.

## API reference

This SDK covers `sessions.create()`/`sessions.retrieve()` — everything it
does is also a plain REST call, documented in full (every field, every
error shape, every other endpoint) at
[`/docs/api`](https://checkout.zelapay.xyz/docs/api) and
[`/docs/webhooks`](https://checkout.zelapay.xyz/docs/webhooks). Use
whichever fits your stack; there's nothing the SDK can do that a plain
`fetch()` can't.

## Building

```bash
pnpm --filter @zela-checkout/sdk build       # tsc -p tsconfig.json -> dist/
pnpm --filter @zela-checkout/sdk typecheck
```
