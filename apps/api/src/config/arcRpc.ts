import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { arc, arcTestnet } from "viem/chains";
import type { ArcNetwork } from "@zela-checkout/shared";
import { env } from "./env.js";

/**
 * One client per network, not a single client tied to whatever
 * env.ARC_NETWORK happens to default to — a session stores its own
 * `network` (mainnet or testnet, now chosen per sandbox/live API key —
 * see routes/sessions.ts), and every RPC call for that session must go to
 * the matching chain, or a testnet session's balance/send calls silently
 * hit the mainnet endpoint instead (this was a real bug earlier — see
 * usdcContract.ts's own header on why the contract *address* alone isn't
 * enough without the RPC endpoint matching too).
 */
const CHAIN: Record<ArcNetwork, Chain> = { "arc-mainnet": arc, "arc-testnet": arcTestnet };
const RPC_URL: Record<ArcNetwork, string | undefined> = {
  "arc-mainnet": env.ARC_MAINNET_RPC_URL || undefined,
  "arc-testnet": env.ARC_TESTNET_RPC_URL || undefined,
};

export function chainFor(network: ArcNetwork): Chain {
  return CHAIN[network];
}

const clients = new Map<ArcNetwork, PublicClient>();

export function getPublicClient(network: ArcNetwork): PublicClient {
  let client = clients.get(network);
  if (!client) {
    client = createPublicClient({ chain: CHAIN[network], transport: http(RPC_URL[network]) });
    clients.set(network, client);
  }
  return client;
}
