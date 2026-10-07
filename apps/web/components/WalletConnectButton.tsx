"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useDisconnect,
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
 * The checkout session is the source of truth for the Arc network:
 *   arc-testnet -> chain ID 5042002
 *   arc-mainnet -> chain ID 5042
 *
 * Every chain-aware hook below receives targetChain.id explicitly, so
 * nothing depends on wagmi's default chain.
 */
export function WalletConnectButton({ session }: { session: CheckoutSession }) {
  const targetChain =
    session.network === "arc-testnet" ? arcTestnet : arcMainnet;

  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: sending } = useWriteContract();
  const { disconnect } = useDisconnect();

  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    chainId: targetChain.id,
  });

  const confirmed = receipt?.status === "success";
  const reverted = receipt?.status === "reverted";

  // Don't leave the wallet connected once the payment is done or failed.
  useEffect(() => {
    if (confirmed || reverted) disconnect();
  }, [confirmed, reverted, disconnect]);

  async function pay() {
    setError(null);

    try {
      // Make sure the wallet is on the session's network first.
      if (chainId !== targetChain.id) {
        await switchChainAsync({ chainId: targetChain.id });
      }

      const amountRaw = parseUnits(
        session.amountSettlement as `${number}`,
        TOKEN_DECIMALS.USDC,
      );

      const txHash = await writeContractAsync({
        chainId: targetChain.id,
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

  function retry() {
    setHash(null);
    setError(null);
  }

  if (hash && reverted) {
    return (
      <div className="result">
        <div className="icon bad">✕</div>
        <div className="alert alert-bad">
          The transaction failed on-chain. No payment was made.
        </div>
        <button className="btn btn-primary btn-block" onClick={retry}>
          Try again
        </button>
      </div>
    );
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
