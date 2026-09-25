"use client";

import { useState } from "react";
import {
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";
import { TOKEN_DECIMALS, type CheckoutSession } from "@zela-checkout/shared";
import { arcMainnet, arcTestnet } from "../lib/wagmi";
import { usdcAddress, USDC_TRANSFER_ABI } from "../lib/usdc";
import { formatAmount } from "../lib/format";
import { humanizeChainError } from "../lib/humanizeChainError";

/**
 * In-browser wallet payment path.
 *
 * RainbowKit handles wallet connection (desktop extensions such as
 * MetaMask/Rabby/Coinbase Wallet, or mobile wallets through WalletConnect).
 *
 * The checkout session is the source of truth for the Arc network:
 *
 *   arc-testnet -> chain ID 5042002
 *   arc-mainnet -> chain ID 5042
 *
 * The actual payment remains an ERC-20 USDC transfer() call.
 */
export function WalletConnectButton({ session }: { session: CheckoutSession }) {
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: sending } = useWriteContract();

  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
  });

  async function pay() {
    setError(null);

    try {
      // The checkout session determines which Arc network this payment
      // belongs to. Never use a global environment network here.
      const targetChain =
        session.network === "arc-testnet" ? arcTestnet : arcMainnet;

      // Make sure the connected wallet is on the same network as the
      // checkout session before sending the ERC-20 USDC transfer.
      if (chainId !== targetChain.id) {
        await switchChainAsync({
          chainId: targetChain.id,
        });
      }

      const amountRaw = parseUnits(
        session.amountSettlement as `${number}`,
        TOKEN_DECIMALS.USDC,
      );

      // Keep using the ERC-20 USDC interface. The contract address is
      // selected from the same session.network used above.
      const txHash = await writeContractAsync({
        address: usdcAddress(session.network),
        abi: USDC_TRANSFER_ABI,
        functionName: "transfer",
        args: [session.depositAddress as `0x${string}`, amountRaw],
      });

      setHash(txHash);
    } catch (err) {
      console.error("[WalletConnectButton] payment failed:", err);
      setError(humanizeChainError(err));
    }
  }

  if (hash) {
    return (
      <div className="result">
        <div className="icon ok">✓</div>

        <p className="small muted" style={{ marginBottom: 0 }}>
          {confirmed
            ? "Payment confirmed. Waiting for it to settle…"
            : "Payment sent. Confirming…"}
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div>
        {error && <div className="alert alert-bad">{error}</div>}

        <button
          className="btn btn-primary btn-block"
          onClick={() => openConnectModal?.()}
          disabled={!openConnectModal || connectModalOpen}
        >
          {connectModalOpen ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert alert-bad">{error}</div>}

      <p className="small muted">
        Connected: <span className="mono">{address}</span>
      </p>

      <button
        className="btn btn-primary btn-block"
        onClick={pay}
        disabled={sending}
      >
        {sending
          ? "Confirm in your wallet…"
          : `Pay ${formatAmount(session.amountSettlement)} ${session.settlementToken}`}
      </button>
    </div>
  );
}
