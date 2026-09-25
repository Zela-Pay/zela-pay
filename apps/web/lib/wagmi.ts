import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain, http } from "viem";

const mainnetRpcUrl = process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL;
const testnetRpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL;

if (!mainnetRpcUrl) {
  throw new Error("NEXT_PUBLIC_ARC_MAINNET_RPC_URL is not configured");
}

if (!testnetRpcUrl) {
  throw new Error("NEXT_PUBLIC_ARC_TESTNET_RPC_URL is not configured");
}

/**
 * Arc Mainnet
 */
export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [mainnetRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://explorer.arc.io",
    },
  },
});

/**
 * Arc Testnet
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [testnetRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
});

/**
 * Both networks are available to RainbowKit/Wagmi.
 *
 * The actual network used for a checkout is selected later
 * from session.network.
 */
export const arcChains = [arcMainnet, arcTestnet] as const;

export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured");
}

export const wagmiConfig = getDefaultConfig({
  appName: "Zela Payment Rails",
  projectId: walletConnectProjectId,

  chains: arcChains,

  transports: {
    [arcMainnet.id]: http(mainnetRpcUrl),
    [arcTestnet.id]: http(testnetRpcUrl),
  },

  ssr: true,
});
