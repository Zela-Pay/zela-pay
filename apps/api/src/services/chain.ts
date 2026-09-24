import { createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ArcNetwork } from "@zela-checkout/shared";
import { env } from "../config/env.js";
import { chainFor } from "../config/arcRpc.js";
import { decryptSecret } from "./keyVault.js";

/** Reconstructs a session's deposit account from its encrypted private key. */
export function accountFromEncryptedKey(encSecret: string): Account {
  const hex = "0x" + Buffer.from(decryptSecret(encSecret)).toString("hex");
  return privateKeyToAccount(hex as `0x${string}`);
}

let feePayer: Account | null = null;

/** Platform fee-payer: pays network fees for settlement sweeps and receives the platform fee. */
export function getFeePayer(): Account {
  feePayer ??= privateKeyToAccount(env.SETTLEMENT_FEE_PAYER_SECRET_KEY as `0x${string}`);
  return feePayer;
}

const RPC_URL: Record<ArcNetwork, string | undefined> = {
  "arc-mainnet": env.ARC_MAINNET_RPC_URL || undefined,
  "arc-testnet": env.ARC_TESTNET_RPC_URL || undefined,
};

export function getWalletClient(account: Account, network: ArcNetwork) {
  return createWalletClient({ account, chain: chainFor(network), transport: http(RPC_URL[network]) });
}
