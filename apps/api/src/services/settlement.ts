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
  const gasPrice = await getPublicClient(network).getGasPrice();

  const nativeWeiCost =
    (gasPrice * TRANSFER_GAS_LIMIT * transfers * GAS_SAFETY_BPS) / 10_000n;

  return nativeWeiCost / NATIVE_TO_ERC20_SCALE;
}

/**
 * Settles a customer's gross checkout payment.
 *
 * The customer's payment is the gross amount:
 *
 *   grossAmountRaw
 *
 * The platform fee is ALWAYS calculated from that gross amount.
 *
 * The merchant receives:
 *
 *   gross - platform fee - gas
 *
 * The platform receives:
 *
 *   platform fee
 *
 * Gas is paid by the deposit account from the same underlying
 * USDC balance.
 */
export async function sweepToMerchant(params: {
  network: ArcNetwork;
  deposit: Account;

  merchantWallet: `0x${string}`;

  /**
   * Actual USDC balance currently sitting in the deposit account.
   */
  balanceRaw: bigint;

  /**
   * Original checkout amount the customer was required to pay.
   *
   * IMPORTANT:
   * This is used to calculate the platform fee.
   * Do NOT calculate the fee from balanceRaw.
   */
  grossAmountRaw: bigint;

  /**
   * Estimated gas required for the settlement transfers,
   * represented in ERC-20 USDC's 6-decimal units.
   */
  gasReserveRaw: bigint;

  /**
   * Platform fee in basis points.
   *
   * Example:
   *   100 = 1%
   */
  feeBps: number;
}): Promise<{
  hash: `0x${string}`;
  feeRaw: bigint;
}> {
  /**
   * Calculate the platform fee from the ORIGINAL checkout amount.
   *
   * Example:
   *
   *   19.99 × 1% = 0.1999 USDC
   */
  const feeRaw = (params.grossAmountRaw * BigInt(params.feeBps)) / 10_000n;

  /**
   * Merchant gets the gross payment minus:
   *
   *   platform fee
   *   gas
   */
  const merchantRaw = params.grossAmountRaw - feeRaw - params.gasReserveRaw;

  if (merchantRaw < 0n) {
    throw new Error(
      "Payment is insufficient to cover platform fee and settlement gas",
    );
  }

  /**
   * The settlement should never spend more USDC than is actually
   * present in the deposit account.
   *
   * The required amount is:
   *
   *   merchant
   * + platform fee
   * + gas
   *
   * which equals the gross checkout amount.
   */
  const requiredRaw = merchantRaw + feeRaw + params.gasReserveRaw;

  if (params.balanceRaw < requiredRaw) {
    throw new Error(
      `Insufficient deposit balance for settlement: ` +
        `balance=${rawToDecimal(params.balanceRaw)} USDC, ` +
        `required=${rawToDecimal(requiredRaw)} USDC`,
    );
  }

  /**
   * Send the merchant's net amount first.
   *
   * This is:
   *
   *   gross - fee - gas
   */
  const merchantHash = await sendUsdc(
    params.network,
    params.deposit,
    params.merchantWallet,
    merchantRaw,
  );

  /**
   * Then send the platform fee to the fee payer.
   */
  if (feeRaw > 0n) {
    await sendUsdc(
      params.network,
      params.deposit,
      getFeePayer().address,
      feeRaw,
    );
  }

  /**
   * Return the merchant transaction hash as the settlement
   * transaction hash.
   *
   * The platform fee transaction is also confirmed by sendUsdc()
   * before this function returns.
   */
  return {
    hash: merchantHash,
    feeRaw,
  };
}
