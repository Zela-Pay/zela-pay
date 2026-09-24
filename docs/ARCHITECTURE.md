# Architecture

## Why Arc

Arc is Circle's stablecoin-native L1 (EVM-compatible, chain ID 5042 on
mainnet). USDC is Arc's native gas asset, but every payment in this project
moves through its **ERC-20 interface** — `balanceOf`/`transfer` at a fixed
contract address (`0x3600…`), 6 decimals — not a plain native-value
transfer. This matters beyond style: it's the exact interface zela-app
uses for every real send/receive (see `zela-app/src/service/arcTokenService.js`),
and matching it is what makes a payment a real Zela app user sends visible
to this project's own balance reads, and vice versa. There's still no swap:
USDC is the settlement currency directly, so this project originally
targeted Solana; see the git history before the Arc migration for that
design (SPL token transfers + a Jupiter swap for SOL-denominated payments).

zela-app has **no Arc testnet support** (its chain definition is
mainnet-only, chain ID 5042) — this project defaults to `arc-mainnet` for
the same reason; anything meant to be recognizable/payable by a real Zela
app user only ever works there. Testnet remains available
(`ARC_NETWORK=arc-testnet`) for checkout-only testing unrelated to Zela
app recognition, but needs a testnet USDC contract address supplied via
env — none is verified, so none is guessed here.

USDT is **not** supported: no verified USDT contract address exists for
Arc, and inventing one risks sending funds to a wrong or non-existent
contract. Re-add it once Circle publishes a real one.

**Not independently verified**: this project has not confirmed with a real
on-chain transaction that a `transfer()` call through the ERC-20 interface
and native balance changes at Arc's gas layer really are, as documented,
"the same underlying asset" — see `packages/shared/src/tokens.ts`'s header.
Worth a small real-money test before relying on this.

## Payment flow (state machine)

```
awaiting_payment ──► settling ──► settled
        │             │
        │             └─(error)─► awaiting_payment   (retried next tick, resumes from chain state)
        └─► expired   (TTL elapsed with no sufficient payment)
```

1. Merchant server calls `POST /v1/sessions` (secret key) with an amount in
   USDC. The API generates a fresh, single-use EVM private key for the
   session's deposit address and returns a `checkoutUrl`.
2. The payer is shown the hosted checkout page (or the embedded widget's
   modal, which just iframes the same page) and picks one of two paths:
   - **Zela app** — deep link (mobile) or QR (desktop) opens Zela to a
     pre-filled, PIN-confirmed payment. Zela's wallet already has an EVM
     address from its existing Ethereum/BNB Chain/HyperEVM support — Arc is
     just another chain ID to that same address, no new key material.
   - **Wallet connect** — an injected EVM wallet (MetaMask, Rabby, Coinbase
     Wallet extension, via wagmi) calls the USDC contract's `transfer()`
     directly from the browser. A generic EIP-681 payment-URI QR
     (`ethereum:<usdcContract>@<chainId>/transfer?address=<recipient>&uint256=<amount>`)
     covers wallets that scan rather than connect.
3. `paymentMonitor.ts` polls each open session's deposit address's USDC
   balance (`balanceOf()` on the ERC-20 contract). Once it covers the
   amount (minus an estimated gas reserve for the sweep itself), the
   session is claimed atomically (`awaiting_payment → settling`) before
   funds move, so overlapping ticks or multiple API instances can't
   double-settle.
4. `settlement.ts` splits the deposit account's USDC balance: the platform
   fee (`platform_fee_bps`) to the fee payer, the rest to the merchant's
   wallet — two `transfer()` calls, both paid for (in native-layer gas)
   out of the deposit account's own funds.
5. A `checkout.session.completed` (or `.expired`) event is written to the
   `webhook_events` outbox and delivered with retries.

`SessionStatus` also lists `failed`, unused by the current implementation
(reserved for a settlement that can't be retried, e.g. an invalid merchant
wallet discovered at sweep time).

## Fees

A flat platform fee (`PLATFORM_FEE_BPS`, default 100 = 1%) is deducted from
the settled amount before forwarding to the merchant — never added on top
of what the payer sends. The fee is taken on the actual balance swept, so
an overpayment is fee-charged too and goes to the merchant. See
`apps/api/src/services/feeService.ts` and `settlement.ts`.

The deposit account pays its own network fees (gas, metered at Arc's
native layer) for the two settlement `transfer()` calls out of the same
USDC it received — `paymentMonitor.ts` estimates this via the current gas
price before deciding a session has been paid enough to settle, with a
1.5x safety cushion for price movement between the estimate and the
actual send.

## Security notes

- Each session's deposit private key is encrypted at rest with AES-256-GCM
  (`services/keyVault.ts`, key from `DEPOSIT_KEY_ENCRYPTION_KEY`) and
  decrypted only inside the settlement job. Move the key to a KMS before
  production.
- Merchant API secret keys and dashboard passwords are never stored in
  plaintext — only a SHA-256 hash (API keys) or scrypt hash (passwords).
- Webhook payloads are HMAC-SHA256 signed: `X-Zela-Checkout-Signature` is
  the hex HMAC of `${X-Zela-Checkout-Timestamp}.${rawBody}` with the
  merchant's webhook secret; reject stale timestamps.
- Webhook URLs are checked by `services/urlSafety.ts` before every delivery
  (HTTPS only, no embedded credentials, must resolve to a public IP) —
  otherwise a merchant could point their webhook at internal
  infrastructure (SSRF).
- The widget's session endpoint (`POST /v1/sessions/public`) accepts only a
  publishable key and is rate-limited (20/min/IP).

## Refunds

A payment that arrives after a session expires, or an underpayment, stays
in the deposit account — the payment monitor only polls sessions still in
`awaiting_payment`, so once a session is `expired` it's no longer touched.
`services/refund.ts` lets a merchant (from the dashboard, `POST
/v1/dashboard/sessions/:id/refund`) sweep that account's whole balance back
out to any address they supply. No platform fee is taken, since the
session never settled. Refunding is atomic against the settlement job the
same way settlement claims a session (`awaiting_payment`/`expired` →
`settling` → `failed`), so a refund attempt racing a late payment that
just became sweepable can't double-spend the balance.

## Repo/package dependency graph

```
apps/web ──┐
apps/api ──┼──► packages/shared   (types, Arc network/token constants)
widget   ──┘
sdk      ──► packages/shared
```

`packages/sdk` has no dependency on `apps/api`'s internals — it only talks
to the deployed REST API over HTTP, same as any external merchant would.
