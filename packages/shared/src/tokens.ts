/**
 * Arc (Circle's stablecoin L1) network + token constants.
 *
 * USDC is Arc's native gas asset, but every value transfer in this project
 * goes through its ERC-20 interface (balanceOf/transfer at ARC_USDC_ADDRESS,
 * 6 decimals) — NOT plain native getBalance/sendTransaction (18 decimals,
 * the gas/wei-layer representation of the same underlying asset). This
 * matters because it's the exact interface zela-app's arcTokenService.js
 * uses for every real send/receive — matching it exactly, rather than the
 * native layer, is what makes a payment a Zela app user actually sends
 * visible to this project's own balance reads (and vice versa). Verified
 * against zela-app/src/config/arcConfig.js (cross-checked there against
 * Circle's own @circle-fin/bridge-kit SDK and docs.arc.io) — see that
 * file's own "re-verify before production" note, which still applies here:
 * Arc mainnet is new enough that this hasn't been confirmed by an actual
 * on-chain transaction from this project as of this writing.
 *
 * USDT is NOT supported: no verified USDT contract address exists for Arc,
 * and inventing one would risk sending funds to a wrong or non-existent
 * contract.
 */

export type ArcNetwork = "arc-mainnet" | "arc-testnet";

export const ARC_CHAIN_ID: Record<ArcNetwork, number> = {
  "arc-mainnet": 5042,
  "arc-testnet": 5042002,
};

export type SettlementToken = "USDC";

// The ERC-20 interface's decimals (NOT the 18-decimal native/gas layer — see file header).
export const TOKEN_DECIMALS: Record<SettlementToken, number> = {
  USDC: 6,
};

// ✓ VERIFIED — zela-app/src/config/arcConfig.js, cross-checked against
// docs.arc.io/arc/references/contract-addresses and @circle-fin/bridge-kit.
// No verified testnet equivalent exists (zela-app itself has no Arc testnet
// support — its ARC_CHAIN is mainnet-only) — ARC_USDC_ADDRESS_TESTNET must
// be supplied via env if you actually need testnet, never guessed here.
export const ARC_USDC_ADDRESS_MAINNET = "0x3600000000000000000000000000000000000000";

export const explorerBase = (network: ArcNetwork): string =>
  network === "arc-mainnet" ? "https://explorer.arc.io" : "https://testnet.arcscan.app";
