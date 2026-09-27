# @zela-checkout/shared

Shared TypeScript types and Arc network/token constants — the single source
of truth that `apps/api`, `apps/web`, and every published package
(`sdk`, `widget`, `miniapp-sdk`) import from. Nothing in this package talks
to the network or a database; it's pure types and constants.

## Why this exists

Every other package in this repo needs to agree on the exact same shape for
a checkout session, a payout, a webhook event, and the same Arc chain IDs
and USDC contract address. Rather than each package redeclaring (and
inevitably drifting on) these, they all import from here. If you change
what a `CheckoutSession` or `Payout` looks like, you change it once, in
`src/types.ts`, and every consumer's type-checker immediately tells you
what else needs to update.

## Arc, and why it's the only chain here

[Arc](https://www.circle.com/en/arc) is Circle's stablecoin-native L1.
USDC is Arc's native gas asset, but — and this is the one fact every
consumer of this package needs to know — **every value transfer in this
project goes through USDC's ERC-20 interface** (`balanceOf`/`transfer` at
a fixed contract address, 6 decimals), never the native/gas layer
(`getBalance`/`sendTransaction`, 18 decimals — the wei-denominated
representation of the same underlying asset). This isn't an arbitrary
choice: it's the exact interface [Zela](https://zelapay.xyz)'s own mobile
wallet uses for every send and receive, so matching it — rather than the
native layer — is what makes a payment a Zela app user sends actually
visible to this project's balance reads, and vice versa.

```ts
export type ArcNetwork = "arc-mainnet" | "arc-testnet";

export const ARC_CHAIN_ID: Record<ArcNetwork, number> = {
  "arc-mainnet": 5042,
  "arc-testnet": 5042002,
};

export const ARC_USDC_ADDRESS_MAINNET = "0x3600000000000000000000000000000000000000";
```

USDT is deliberately **not** supported — no verified USDT contract address
exists for Arc, and guessing one would risk sending funds to a wrong or
non-existent contract. `SettlementToken` is `"USDC"` only, on purpose.

### Support for other chains

Arc is the only chain this *package* — and the payment rails product built
on it — settles in. That's a deliberate scope, not a limitation of the
underlying wallet infrastructure: the broader Zela app supports Solana,
Ethereum, BNB Chain, and HyperEVM for its own peer-to-peer wallet features.
Checkout, Payment Links, and Mini App payouts specifically standardize on
Arc because that's what lets a merchant's settlement wallet and a Zela
user's own wallet resolve to the exact same address space with no bridging
or wrapping step in between. If a future rail needs a different chain,
it's a new `ArcNetwork`-shaped union added here, not a rewrite of anything
that imports from this package.

## What's in here

| File | Contents |
|---|---|
| `src/tokens.ts` | `ArcNetwork`, `ARC_CHAIN_ID`, `TOKEN_DECIMALS`, `ARC_USDC_ADDRESS_MAINNET`, `explorerBase()` |
| `src/types.ts` | `CheckoutSession`, `PaymentLink`, `Payout`, `WebhookEvent`/`WebhookEventType`, and the request/response DTOs the API, SDK, and widget all share |
| `src/index.ts` | Re-exports both of the above — this is the only path anything should import from (`@zela-checkout/shared`, never `@zela-checkout/shared/tokens` directly) |

## Usage

You won't normally install this directly — it's a dependency of
`@zela-checkout/sdk`, `@zela-checkout/widget`, and
`@zela-checkout/miniapp-sdk`, and re-exported through all three. If you do
need it standalone (e.g. to type a webhook handler):

```bash
npm install @zela-checkout/shared
```

```ts
import type { CheckoutSession, WebhookEvent } from "@zela-checkout/shared";

function handleWebhook(event: WebhookEvent<CheckoutSession>) {
  if (event.type === "checkout.session.completed") {
    console.log(event.data.amountSettlement, event.data.settlementToken);
  }
}
```

## Building

```bash
pnpm --filter @zela-checkout/shared build   # tsc -p tsconfig.json -> dist/
pnpm --filter @zela-checkout/shared typecheck
```
