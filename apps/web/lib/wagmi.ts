import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain, http } from "viem";

const mainnetRpcUrl = process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL;
const testnetRpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!mainnetRpcUrl) {
  throw new Error("NEXT_PUBLIC_ARC_MAINNET_RPC_URL is not configured");
}
if (!testnetRpcUrl) {
  throw new Error("NEXT_PUBLIC_ARC_TESTNET_RPC_URL is not configured");
}
if (!walletConnectProjectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured");
}

export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 }, // verify, see note below
  rpcUrls: { default: { http: [mainnetRpcUrl] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
});

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 }, // verify, see note below
  rpcUrls: { default: { http: [testnetRpcUrl] } },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

/**
 * Testnet is listed first so it is wagmi's fallback chain. Any hook that
 * forgets an explicit chainId fails safe on testnet instead of mainnet.
 * The real network for a checkout always comes from session.network.
 */
export const arcChains = [arcTestnet, arcMainnet] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "ZelaPay Checkout",
  projectId: walletConnectProjectId,
  chains: arcChains,
  transports: {
    [arcMainnet.id]: http(mainnetRpcUrl),
    [arcTestnet.id]: http(testnetRpcUrl),
  },
  storage: null, // don't persist wagmi connection state
  ssr: true,
});
