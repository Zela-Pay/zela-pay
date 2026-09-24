/**
 * Settlement: splits the deposit account's USDC balance into the platform
 * fee and the merchant's net amount, and sends both in one go.
 *
 * Balance reads and sends go through USDC's ERC-20 interface (see
 * usdcContract.ts) — not a native-currency transfer. See that file's and
 * packages/shared/src/tokens.ts's headers for why.
 *
 * Idempotent by construction: it acts on the deposit account's current
 * balance, so a retry after a partial failure simply continues from
 * whatever the chain state actually is.
 */

import { formatUnits, parseUnits, type Account } from "viem";
import { TOKEN_DECIMALS, type ArcNetwork } from "@zela-checkout/shared";
import { getPublicClient } from "../config/arcRpc.js";
import { getFeePayer } from "./chain.js";
import { sendUsdc, usdcBalanceOf } from "./usdcContract.js";

const DECIMALS = TOKEN_DECIMALS.USDC;

export function toRaw(amount: string): bigint {
  return parseUnits(amount as `${number}`, DECIMALS);
}

export function rawToDecimal(raw: bigint): string {
  return formatUnits(raw, DECIMALS);
}

export async function usdcBalance(network: ArcNetwork, address: `0x${string}`): Promise<bigint> {
  return usdcBalanceOf(network, address);
}

const TRANSFER_GAS_LIMIT = 65_000n; // conservative for a plain ERC-20 transfer() call
const GAS_SAFETY_BPS = 15_000n; // 1.5x cushion for price movement between estimate and send
// Gas is metered/paid at Arc's native 18-decimal layer even though USDC's
// ERC-20 balance we're reserving against is 6-decimal — both are described
// as the same underlying asset at different decimal layers (see this
// project's tokens.ts header), so converting one estimate into the other's
// units is 10^(18-6). Not independently verified against a real
// transaction as of this writing — see that same header.
const NATIVE_TO_ERC20_SCALE = 10n ** 12n;

/** How much of a deposit account's USDC balance to hold back for its own gas, sending `transfers` ERC-20 transfer() calls. */
export async function estimateGasReserve(network: ArcNetwork, transfers: bigint): Promise<bigint> {
  const gasPrice = await getPublicClient(network).getGasPrice();
  const nativeWeiCost = gasPrice * TRANSFER_GAS_LIMIT * transfers * GAS_SAFETY_BPS / 10_000n;
  return nativeWeiCost / NATIVE_TO_ERC20_SCALE;
}

/**
 * Sends the deposit account's balance to the merchant (net of the platform
 * fee) and the fee payer (the fee itself), in two transfer() calls signed
 * by the deposit account. The deposit account pays its own gas from the
 * same balance, so `balanceRaw` here should already exclude a gas reserve
 * (see paymentMonitor.ts, which estimates and reserves it).
 */
export async function sweepToMerchant(params: {
  network: ArcNetwork;
  deposit: Account;
  merchantWallet: `0x${string}`;
  balanceRaw: bigint;
  feeBps: number;
}): Promise<{ hash: `0x${string}`; feeRaw: bigint }> {
  const feeRaw = (params.balanceRaw * BigInt(params.feeBps)) / 10_000n;
  const netRaw = params.balanceRaw - feeRaw;

  const hash = await sendUsdc(params.network, params.deposit, params.merchantWallet, netRaw);

  if (feeRaw > 0n) {
    await sendUsdc(params.network, params.deposit, getFeePayer().address, feeRaw);
  }

  return { hash, feeRaw };
}
