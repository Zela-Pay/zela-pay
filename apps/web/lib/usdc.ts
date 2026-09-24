import { ARC_USDC_ADDRESS_MAINNET, type ArcNetwork } from "@zela-checkout/shared";

export const USDC_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

/** USDC's ERC-20 contract address for the given network — see packages/shared/src/tokens.ts. */
export function usdcAddress(network: ArcNetwork): `0x${string}` {
  if (network === "arc-mainnet") return ARC_USDC_ADDRESS_MAINNET as `0x${string}`;
  const testnet = process.env.NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS;
  if (!testnet) throw new Error("NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS is not configured — no verified default exists for testnet");
  return testnet as `0x${string}`;
}
