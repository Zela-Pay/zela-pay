"use client";

import { useState } from "react";
import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";
import { TOKEN_DECIMALS, type CheckoutSession } from "@zela-checkout/shared";
import { arcChain } from "../lib/wagmi";
import { usdcAddress, USDC_TRANSFER_ABI } from "../lib/usdc";
import { formatAmount } from "../lib/format";

/**
 * In-browser wallet path — RainbowKit's connect modal (desktop extensions
 * like MetaMask/Rabby/Coinbase Wallet, or a mobile wallet via WalletConnect
 * QR pairing) for connecting, then a plain USDC transfer() call — Arc's
 * ERC-20 interface for USDC, not a plain native-value send — see
 * packages/shared/src/tokens.ts's header, for paying. Arc (chain 5042) is
 * new enough that most wallets won't have it preconfigured — switchChainAsync
 * below prompts the wallet to add/switch to it at pay time, same as before.
 */
export function WalletConnectButton({ session }: { session: CheckoutSession }) {
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: sending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: hash ?? undefined });

  async function pay() {
    setError(null);
    try {
      if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id });
      const amountRaw = parseUnits(session.amountSettlement as `${number}`, TOKEN_DECIMALS.USDC);
      const txHash = await writeContractAsync({
        address: usdcAddress(session.network),
        abi: USDC_TRANSFER_ABI,
        functionName: "transfer",
        args: [session.depositAddress as `0x${string}`, amountRaw],
      });
      setHash(txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    }
  }

  if (hash) {
    return (
      <div className="result">
        <div className="icon ok">✓</div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {confirmed ? "Payment confirmed. Waiting for it to settle…" : "Payment sent. Confirming…"}
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
      <p className="small muted">Connected: <span className="mono">{address}</span></p>
      <button className="btn btn-primary btn-block" onClick={pay} disabled={sending}>
        {sending ? "Confirm in your wallet…" : `Pay ${formatAmount(session.amountSettlement)} ${session.settlementToken}`}
      </button>
    </div>
  );
}
