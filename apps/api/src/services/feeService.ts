/**
 * Platform fee: flat 1% (PLATFORM_FEE_BPS) of the settled amount, charged in
 * the merchant's settlement token — deducted from the amount delivered to
 * merchant.settlementWallet, not added on top of what the payer sends.
 */

import { env } from "../config/env.js";

export function calculatePlatformFee(amountSettlement: number): {
  feeAmount: number;
  netAmount: number;
  feeBps: number;
} {
  const feeAmount = (amountSettlement * env.PLATFORM_FEE_BPS) / 10_000;
  return {
    feeAmount,
    netAmount: amountSettlement - feeAmount,
    feeBps: env.PLATFORM_FEE_BPS,
  };
}
