/**
 * Settlement: splits the customer's gross USDC payment into:
 *
 *   1. Merchant net amount
 *   2. Platform fee
 *   3. Gas required for the settlement transfers
 *
 * Arc uses USDC as its native gas asset while also exposing the same
 * underlying balance through the ERC-20 interface.
 *
 * The ERC-20 interface uses 6 decimals.
 * The native gas interface uses 18 decimals.
 *
 * The customer pays exactly the checkout amount. They do NOT need
 * to send an additional amount for gas.
 *
 * Settlement accounting:
 *
 *   gross payment
 *   - platform fee
 *   - gas
 *   = merchant amount
 *
 * Example:
 *
 *   Customer pays:       19.9900 USDC
 *   Platform fee (1%):    0.1999 USDC
 *   Gas:                   0.00xx USDC
 *   Merchant receives:   19.7901 - gas USDC
 *
 * Balance reads and transfers use USDC's ERC-20 interface.
 */

import { formatUnits, parseUnits, type Account } from "viem";
import { TOKEN_DECIMALS, type ArcNetwork } from "@zela-checkout/shared";
import { getPublicClient } from "../config/arcRpc.js";
import { getFeePayer } from "./chain.js";
import { sendUsdc, usdcBalanceOf } from "./usdcContract.js";
import { humanizeChainError } from "./blockchainError.js";

const DECIMALS = TOKEN_DECIMALS.USDC;

export function toRaw(amount: string): bigint {
  return parseUnits(amount as `${number}`, DECIMALS);
}

export function rawToDecimal(raw: bigint): string {
  return formatUnits(raw, DECIMALS);
}

export async function usdcBalance(
  network: ArcNetwork,
  address: `0x${string}`,
): Promise<bigint> {
  return usdcBalanceOf(network, address);
}

/**
 * Conservative gas estimate for a plain ERC-20 transfer().
 *
 * Arc's native gas representation uses 18 decimals while the
 * ERC-20 USDC representation uses 6 decimals.
 *
 * Therefore:
 *
 *   1e18 native units = 1e6 ERC-20 units
 *
 * Difference = 1e12.
 */
const TRANSFER_GAS_LIMIT = 65_000n;

/**
 * 1.5x safety cushion.
 *
 * 15,000 bps = 150%.
 */
const GAS_SAFETY_BPS = 15_000n;

/**
 * Native USDC uses 18 decimals.
 * ERC-20 USDC uses 6 decimals.
 */
const NATIVE_TO_ERC20_SCALE = 10n ** 12n;

/**
 * Estimate the USDC-equivalent amount of native gas required for
 * the specified number of ERC-20 transfer() calls.
 *
 * The returned value is expressed in ERC-20 USDC's 6-decimal units.
 */
export async function estimateGasReserve(
  network: ArcNetwork,
  transfers: bigint,
): Promise<bigint> {
  let gasPrice: bigint;
  try {
    gasPrice = await getPublicClient(network).getGasPrice();
  } catch (err) {
    console.error(`[settlement] getGasPrice failed on ${network}:`, err);
    throw new Error(humanizeChainError(err, "Couldn't estimate the network fee right now."));
  }

  const nativeWeiCost =
    (gasPrice * TRANSFER_GAS_LIMIT * transfers * GAS_SAFETY_BPS) / 10_000n;

  return nativeWeiCost / NATIVE_TO_ERC20_SCALE;
}

/**
 * Platform fee, calculated from the ORIGINAL checkout amount.
 *
 * IMPORTANT: never calculate the fee from a live balance — the balance
 * shrinks as legs of the sweep are sent, and the fee must stay fixed
 * regardless of how the sweep is retried.
 *
 * Example: 19.99 x 1% = 0.1999 USDC
 */
export function calculatePlatformFee(
  grossAmountRaw: bigint,
  feeBps: number,
): bigint {
  return (grossAmountRaw * BigInt(feeBps)) / 10_000n;
}

/**
 * Sends the platform fee leg of a settlement.
 *
 * This is one of two independent legs (the other is
 * `sweepRemainderToMerchant`). Each leg is safe to retry on its own:
 * the caller is expected to persist the returned tx hash immediately
 * so this leg is never re-sent once it has confirmed, even if the
 * *other* leg fails afterward and the whole settlement is retried.
 */
export async function sendPlatformFee(
  network: ArcNetwork,
  deposit: Account,
  feeRaw: bigint,
): Promise<`0x${string}` | null> {
  if (feeRaw <= 0n) {
    return null;
  }

  return sendUsdc(network, deposit, getFeePayer().address, feeRaw);
}

/**
 * Sends whatever USDC actually remains in the deposit account (minus a
 * fresh gas reserve) to the merchant.
 *
 * Deliberately reads the balance live, right before sending, instead of
 * accepting a pre-computed amount. That makes this leg self-correcting:
 * if the platform-fee leg (or a prior gas estimate) used slightly more
 * or less than predicted, the merchant still receives an accurate
 * "whatever's left" figure instead of a stale one computed before that
 * gas was actually spent.
 */
export async function sweepRemainderToMerchant(
  network: ArcNetwork,
  deposit: Account,
  merchantWallet: `0x${string}`,
): Promise<{ hash: `0x${string}`; amountRaw: bigint } | null> {
  const currentBalanceRaw = await usdcBalance(
    network,
    deposit.address as `0x${string}`,
  );

  const gasReserveRaw = await estimateGasReserve(network, 1n);

  const amountRaw = currentBalanceRaw - gasReserveRaw;

  if (amountRaw <= 0n) {
    return null;
  }

  const hash = await sendUsdc(network, deposit, merchantWallet, amountRaw);

  return { hash, amountRaw };
}
