# @zela-checkout/miniapp-sdk

[![npm](https://img.shields.io/npm/v/@zela-checkout/miniapp-sdk)](https://www.npmjs.com/package/@zela-checkout/miniapp-sdk)

The SDK for building a **Zela Mini App** — a web app that runs directly
inside the Zela mobile app, the way a Telegram Mini App or a World App Mini
App does. No download, no separate account: the Zela app loads your URL in
a WebView and injects a small JS bridge your frontend calls to know who the
current user is, charge them (Checkout), and pay them out — all settling in
native USDC on **Arc**.

This package has **two halves, two entry points** — install once, import
whichever runs where:

| Entry point | Runs where | Needs |
|---|---|---|
| `@zela-checkout/miniapp-sdk` | Your own backend (Node.js) | Your **secret** key |
| `@zela-checkout/miniapp-sdk/client` | Your frontend, inside the Zela app's WebView | Your **publishable** key |

Never import the server half from browser code — it expects a secret key
that must never leave your server.

## Install

```bash
npm install @zela-checkout/miniapp-sdk
```

## 1. List your Mini App

Before any of this works, register your Mini App from the
[merchant dashboard](https://checkout.zelapay.xyz/dashboard/mini-app):
set a launch URL, an icon, and a tagline, then turn listing on. A Mini App
is a regular Checkout merchant account with a manifest attached — same
sign-up, same API keys, same dashboard.

## 2. Know who's using your Mini App

```ts
import { Zela } from "@zela-checkout/miniapp-sdk/client";

const user = await Zela.getUser();
// { zelaId: "harry.zela", arcAddress: "0x..." }
```

`arcAddress` is informational only — you never see or touch a private key,
and there's nothing to sign on the client. `zelaId` is what you pass to
`payouts.resolve()` from your backend if you ever need to pay this user.

`Zela.isAvailable()` returns `false` outside the Zela app's WebView, if
your Mini App is also reachable as a plain website and needs a fallback.

## 3. Charge the user (Checkout)

```ts
import { Zela } from "@zela-checkout/miniapp-sdk/client";

try {
  const result = await Zela.checkout({
    publishableKey: "pk_live_...",
    amount: "4.99",
    metadata: { orderId: "ord_123" },
  });
  console.log(result); // { sessionId: "cs_...", status: "settled" }
} catch (err) {
  // the user declined, or the transfer failed — err.message is human-readable
}
```

`Zela.checkout()` creates the session itself, via the exact same
publishable-key endpoint the embeddable widget uses, then hands it to the
native host. The Zela app shows a native confirmation and sends the
payment directly from the user's own already-connected Arc wallet — no QR
code, no "connect wallet" step, no leaving your Mini App. The same
`checkout.session.completed` webhook fires on settlement as any other
Checkout session (widget, hosted page, or SDK) — see
[the REST API docs](https://checkout.zelapay.xyz/docs/api).

## 4. Pay the user out (Payouts)

**Always non-custodial.** Zela never holds or signs for your funds — your
own backend sends the on-chain transfer itself, from a wallet you control.
Zela's role is to tell you where to send it, then verify on-chain
afterward that the transfer actually happened for the right recipient and
amount, so it shows up in the user's activity and your own payouts
dashboard.

```ts
import { ZelaMiniAppClient } from "@zela-checkout/miniapp-sdk";

const client = new ZelaMiniAppClient({ secretKey: process.env.ZELA_SECRET_KEY! });

// 1. Resolve who you're paying — a Zela ID, email, or merchant ID.
const { walletAddress } = await client.payouts.resolve("harry.zela");

// 2. Send the transfer yourself. However you already sign Arc transactions
//    (viem, ethers, your own signer) — Zela is not involved in this step.
const txHash = await sendUsdcYourself(walletAddress, "2.50");

// 3. Report it. Zela verifies the transaction on-chain before recording it.
const { payout } = await client.payouts.report({
  toIdentifier: "harry.zela",
  txHash,
  amount: "2.50",
});
console.log(payout.status); // "verified"
```

`payouts.resolve()` only accepts a Zela ID, email, or merchant ID
(`store.zela.merchant`) — not a raw wallet address, since there's nothing
to resolve for one. Payouts don't support sandbox keys: every payout is a
real transfer on Arc mainnet, so use a production secret key
(`sk_live_...`).

`client.sessions.create()`/`client.sessions.retrieve()` are also available
directly on `ZelaMiniAppClient` — Checkout works exactly as it does in
[`@zela-checkout/sdk`](../sdk/README.md), which this package wraps.

## Bridge reference (client half)

| Call | Returns | Notes |
|---|---|---|
| `Zela.isAvailable()` | `boolean` | `true` inside the Zela app's Mini App host |
| `Zela.getUser()` | `{ zelaId, arcAddress }` | Never includes a private key |
| `Zela.checkout(request)` | `{ sessionId, status: "settled" }` | Rejects if the user declines or the transfer fails |
| `Zela.close()` | `void` | Returns to the Zela app's own UI |

Under the hood, the client half talks to the native host over
`window.ReactNativeWebView.postMessage()` — a request/response protocol
keyed by a generated id, with responses delivered back as `message`
events. You don't need to know this to use the SDK; it's here for context
if you're debugging.

## Errors

Every call throws `ZelaCheckoutError` (re-exported from
[`@zela-checkout/sdk`](../sdk/README.md)) on a non-2xx response, with a
short, human-readable `message` — never a raw viem/RPC error or an HTML
error page body.

## Arc, and other chains

Checkout and payouts both settle in native USDC on **Arc** — see
[`@zela-checkout/shared`](../shared/README.md) for what "native USDC"
means there specifically (the ERC-20 interface, not the 18-decimal native
gas layer) and why Arc is the one chain this SDK supports. The `arcAddress`
`Zela.getUser()` returns is always an Arc address; there is currently no
equivalent for a Mini App to resolve a user's Solana, Ethereum, BNB Chain,
or HyperEVM address, even though the Zela app itself holds wallets on all
of them.

## Building

```bash
pnpm --filter @zela-checkout/miniapp-sdk build       # tsc -p tsconfig.json -> dist/
pnpm --filter @zela-checkout/miniapp-sdk typecheck
```
