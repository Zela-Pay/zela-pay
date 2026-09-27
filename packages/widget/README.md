# @zela-checkout/widget

[![npm](https://img.shields.io/npm/v/@zela-checkout/widget)](https://www.npmjs.com/package/@zela-checkout/widget)

The embeddable checkout widget for [Zela Payment Rails](../../README.md) —
a small, framework-agnostic vanilla-JS bundle. Drop one `<script>` tag on
any website and open a native-USDC checkout on **Arc** in a modal, with no
build step, no bundler config, and no backend required for the merchant.

## Usage

```html
<script src="https://checkout.zelapay.xyz/widget.js"></script>
<script>
  ZelaCheckout.open({
    publishableKey: "pk_live_...", // safe to embed client-side — never a secret key
    amount: "19.99",
    successUrl: "https://your.site/thanks",
    metadata: { orderId: "ord_123" },
  });
</script>
```

That's the entire integration. The widget:

1. Opens immediately with a loading spinner — the modal shows the instant
   the customer clicks, before the network round-trip to create the
   session even starts, so there's never a dead gap where nothing visibly
   happens.
2. Creates a checkout session via the **publishable-key** endpoint
   (`POST /v1/sessions/public`) — only a publishable key is ever sent from
   the browser; the merchant's secret key never touches client-side code.
3. Loads the hosted checkout page (`checkout.zelapay.xyz/pay/<sessionId>`)
   in an iframe inside the modal, where the customer picks how to pay —
   open the Zela app (deep link/QR, PIN-confirmed) or connect any EVM
   wallet.

If you'd rather create the session from your own backend first (e.g. to
attach `successUrl`/`metadata` computed server-side, or because your
checkout flow needs a secret-key session), use
[`@zela-checkout/sdk`](../sdk/README.md) and pass the returned
`checkoutUrl` straight to a plain link/redirect instead of this widget.

## Options

| Option | Required | Description |
|---|---|---|
| `publishableKey` | yes | `pk_live_...` or `pk_test_...`, from the merchant dashboard |
| `amount` | yes | Decimal string, e.g. `"19.99"` |
| `successUrl` | no | Redirect target after the hosted page detects settlement |
| `cancelUrl` | no | Redirect target if the customer backs out |
| `metadata` | no | Arbitrary string key/value pairs, echoed back on the session and any webhook |
| `onClose` | no | Called when the modal is dismissed, settled or not |

## Sandbox vs. production

`pk_test_...` keys create sessions on **Arc Testnet**; `pk_live_...` keys
create them on **Arc mainnet**. The widget itself doesn't need to know
which — the key decides.

## Arc, and other chains

The hosted page this widget opens accepts payment in native USDC on
**Arc** only — see [`@zela-checkout/shared`](../shared/README.md) for why
that's the one chain Checkout settles in, even though the wider Zela
ecosystem this widget is part of also supports Solana, Ethereum, BNB
Chain, and HyperEVM elsewhere in the app. A customer paying via the Zela
app or an injected EVM wallet is always sending Arc-native USDC, whichever
path they pick.

## Building

Bundled with Vite, not `tsc` — the output is a single browser-ready file,
not a Node package:

```bash
pnpm --filter @zela-checkout/widget build      # vite build -> dist/zela-checkout.js
pnpm --filter @zela-checkout/widget dev         # vite build --watch
pnpm --filter @zela-checkout/widget typecheck
```

## Source layout

| File | Contents |
|---|---|
| `src/index.ts` | The public `ZelaCheckout.open()` API — session creation and the `window.ZelaCheckout` global for the plain `<script>` tag usage above |
| `src/modal.ts` | The modal/iframe chrome itself — loading spinner, error state, and the iframe that hosts the checkout page |
