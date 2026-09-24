/**
 * EIP-681 payment request URI (https://eips.ethereum.org/EIPS/eip-681) for
 * the generic QR path — scannable by any EVM wallet that supports it.
 * USDC on Arc is paid via its ERC-20 interface (see usdcContract.ts and
 * tokens.ts's header), so this is a `transfer` function-call request, not
 * a plain native-value request.
 */

import { parseUnits } from "viem";
import { TOKEN_DECIMALS, ARC_CHAIN_ID, type CheckoutSession } from "@zela-checkout/shared";
import { usdcAddress } from "./usdcContract.js";

export function buildPaymentUri(session: CheckoutSession): string {
  const amountRaw = parseUnits(session.amountSettlement as `${number}`, TOKEN_DECIMALS.USDC);
  const chainId = ARC_CHAIN_ID[session.network];
  const contract = usdcAddress(session.network);
  const params = new URLSearchParams({ address: session.depositAddress, uint256: amountRaw.toString() });
  return `ethereum:${contract}@${chainId}/transfer?${params.toString()}`;
}
