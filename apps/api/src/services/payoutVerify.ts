/**
 * Verifies a Mini App's self-reported payout transaction actually happened
 * on-chain, for the amount and recipient it claims — see routes/payouts.ts.
 * Reads the transaction's logs rather than trusting anything the caller
 * says beyond the tx hash: a Mini App could otherwise report any hash and
 * amount it likes and have it recorded as a real payout.
 */

import { decodeEventLog, getAddress, parseAbiItem } from "viem";
import type { ArcNetwork } from "@zela-checkout/shared";
import { getPublicClient } from "../config/arcRpc.js";
import { usdcAddress } from "./usdcContract.js";
import { humanizeChainError } from "./blockchainError.js";
import { toRaw } from "./settlement.js";

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type PayoutVerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyPayoutOnChain(params: {
  network: ArcNetwork;
  txHash: `0x${string}`;
  toWallet: `0x${string}`;
  amount: string;
}): Promise<PayoutVerifyResult> {
  const client = getPublicClient(params.network);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: params.txHash });
  } catch (err) {
    return { ok: false, error: humanizeChainError(err, "Couldn't find this transaction on-chain.") };
  }

  if (receipt.status !== "success") {
    return { ok: false, error: "This transaction did not succeed on-chain." };
  }

  const usdc = usdcAddress(params.network).toLowerCase();
  const expectedTo = getAddress(params.toWallet);
  const expectedRaw = toRaw(params.amount);

  const matchingLog = receipt.logs.find((log) => log.address.toLowerCase() === usdc);
  if (!matchingLog) {
    return { ok: false, error: "This transaction has no USDC transfer on it." };
  }

  let decoded;
  try {
    decoded = decodeEventLog({ abi: [TRANSFER_EVENT], data: matchingLog.data, topics: matchingLog.topics });
  } catch {
    return { ok: false, error: "Couldn't read the transfer details from this transaction." };
  }

  if (getAddress(decoded.args.to) !== expectedTo) {
    return { ok: false, error: "This transaction's recipient doesn't match the resolved wallet." };
  }
  if (decoded.args.value !== expectedRaw) {
    return { ok: false, error: "This transaction's amount doesn't match the reported amount." };
  }

  return { ok: true };
}
