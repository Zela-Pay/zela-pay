/**
 * Manually sweeps a stuck deposit-account balance back out. A session ends
 * up here when it expired before being fully paid, or was underpaid — see
 * docs/ARCHITECTURE.md "Refunds". No platform fee is taken on a refund: it
 * never settled, so nothing was earned.
 */

import { getAddress, isAddress } from "viem";
import type { ArcNetwork } from "@zela-checkout/shared";
import { accountFromEncryptedKey } from "./chain.js";
import { estimateGasReserve, rawToDecimal, usdcBalance } from "./settlement.js";
import { sendUsdc } from "./usdcContract.js";
import type { SessionRow } from "./sessionStore.js";

const REFUNDABLE_STATUSES = new Set(["awaiting_payment", "expired"]);

export function isRefundableStatus(status: string): boolean {
  return REFUNDABLE_STATUSES.has(status);
}

export async function sweepRefund(row: SessionRow, toAddressRaw: string): Promise<{ hash: `0x${string}`; amount: string }> {
  if (!isAddress(toAddressRaw, { strict: false })) {
    throw new Error("toAddress must be a valid Arc (EVM) address");
  }
  const toAddress = getAddress(toAddressRaw);
  const network = row.network as ArcNetwork;

  const deposit = accountFromEncryptedKey(row.deposit_secret_enc);
  const balance = await usdcBalance(network, deposit.address);
  const gasReserve = await estimateGasReserve(network, 1n);
  const amountRaw = balance > gasReserve ? balance - gasReserve : 0n;
  if (amountRaw <= 0n) {
    throw new Error("Nothing to refund — this session's deposit address has no balance to sweep");
  }

  const hash = await sendUsdc(network, deposit, toAddress, amountRaw);
  return { hash, amount: rawToDecimal(amountRaw) };
}
