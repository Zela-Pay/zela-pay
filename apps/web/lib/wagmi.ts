import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain, http } from "viem";
import { arcTestnet } from "viem/chains";

const isMainnet = process.env.NEXT_PUBLIC_ARC_NETWORK !== "arc-testnet";
const rpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL || undefined;

// Hand-defined to match zela-app/src/config/arcConfig.js's ARC_CHAIN exactly
// (nativeCurrency.decimals: 6) rather than viem's bundled `arc` (18) — this
// project only ever talks to USDC through its ERC-20 interface (see
// packages/shared/src/tokens.ts's header), never native calls, so this
// value is metadata only, but kept consistent with the one real reference
// implementation (zela-app) rather than viem's differently-scoped default.
const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
});

// zela-app has no Arc testnet support at all — this is zela-checkout's own,
// independent dev/testing chain (viem's bundled definition), unrelated to
// anything a real Zela app user could ever pay through.
export const arcChain = isMainnet ? arcMainnet : arcTestnet;

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!walletConnectProjectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured — get one from https://cloud.reown.com");
}

/**
 * RainbowKit's default config: a curated wallet list (injected/MetaMask/
 * Rabby/Coinbase, plus WalletConnect-powered mobile wallets via QR) behind
 * its own connect modal — see WalletConnectButton.tsx for the actual
 * connect UI. Arc (chain 5042) is new enough that most wallets in that
 * default list won't have it preconfigured; a wallet that connects fine
 * may still need the user to add the network manually before paying.
 *
 * Branched (rather than built from the `arcChain` union above) so each
 * branch's `chains`/`transports` share one concrete chain id — wagmi's
 * types require a transport keyed by every id the `chains` tuple's type
 * could hold, and a union type there would need both.
 */
export const wagmiConfig = isMainnet
  ? getDefaultConfig({
      appName: "Zela Payment Rails",
      projectId: walletConnectProjectId,
      chains: [arcMainnet],
      transports: { [arcMainnet.id]: http(rpcUrl) },
      ssr: true,
    })
  : getDefaultConfig({
      appName: "Zela Payment Rails",
      projectId: walletConnectProjectId,
      chains: [arcTestnet],
      transports: { [arcTestnet.id]: http(rpcUrl) },
      ssr: true,
    });
