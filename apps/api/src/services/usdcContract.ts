/**
 * USDC on Arc — ERC-20 interface only (balanceOf/transfer at a fixed
 * contract address, 6 decimals), never the native/gas layer (getBalance/
 * sendTransaction, 18 decimals). Both are described as "the same
 * underlying asset" by zela-app's own config (which this mirrors, ABI and
 * all — see zela-app/src/service/arcTokenService.js), but this project has
 * not independently confirmed that with a real on-chain transaction. Using
 * the ERC-20 interface is what makes a payment sent through the Zela app
 * (which only ever uses this interface) visible to this project's balance
 * reads, and vice versa — see packages/shared/src/tokens.ts's header.
 */

import type { Account } from "viem";
import { ARC_USDC_ADDRESS_MAINNET, type ArcNetwork } from "@zela-checkout/shared";
import { env } from "../config/env.js";
import { getPublicClient } from "../config/arcRpc.js";
import { getWalletClient } from "./chain.js";

export function usdcAddress(network: ArcNetwork): `0x${string}` {
  if (network === "arc-mainnet") return ARC_USDC_ADDRESS_MAINNET as `0x${string}`;
  // env.ts's refine() only guarantees this for the CURRENT deployment's
  // ARC_NETWORK — a session stores whatever network was active when it was
  // created, so an old testnet session can still reach this branch after a
  // later deploy flips the default to mainnet without ever configuring a
  // testnet address. Fail loudly here rather than passing `undefined`
  // through to viem, which turns into a baffling raw-EVM RPC error instead
  // of a message that says what's actually wrong.
  if (!env.ARC_TESTNET_USDC_ADDRESS) {
    throw new Error("ARC_TESTNET_USDC_ADDRESS is not configured — cannot resolve a testnet USDC address for this session");
  }
  return env.ARC_TESTNET_USDC_ADDRESS as `0x${string}`;
}

const BALANCE_OF_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export async function usdcBalanceOf(network: ArcNetwork, address: `0x${string}`): Promise<bigint> {
  return getPublicClient(network).readContract({
    address: usdcAddress(network),
    abi: BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}

/** Sends a USDC amount (raw 6-decimal units) via the ERC-20 transfer() call, confirmed before returning. */
export async function sendUsdc(network: ArcNetwork, account: Account, to: `0x${string}`, amountRaw: bigint): Promise<`0x${string}`> {
  const client = getWalletClient(account, network);
  const hash = await client.writeContract({
    address: usdcAddress(network),
    abi: TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amountRaw],
  });
  const receipt = await getPublicClient(network).waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`USDC transfer reverted on-chain (hash: ${hash})`);
  }
  return hash;
}
