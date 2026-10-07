"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import type { CheckoutSession } from "@zela-checkout/shared";
import { dashApi } from "./dashApi";

const REFUNDABLE = new Set(["awaiting_payment", "expired"]);

interface Props {
  sessionId: string;
  status: string;
  refunded: boolean;
  network: CheckoutSession["network"];
}

/** Sweeps a stuck balance (expired or underpaid session) back to an address the merchant supplies. */
export function RefundAction({ sessionId, status, refunded, network }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (refunded) return <span className="small muted">Refunded</span>;
  if (!REFUNDABLE.has(status)) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const toAddress = (
      new FormData(e.currentTarget).get("toAddress") as string
    )?.trim();
    if (!toAddress) return;

    if (!isAddress(toAddress)) {
      setError("Enter a valid 0x… address.");
      return;
    }

    const networkLabel =
      network === "arc-testnet" ? "Arc Testnet" : "Arc Mainnet";
    if (
      !confirm(
        `Sweep any balance for this session on ${networkLabel} to ${toAddress}? This can't be undone.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const r = await dashApi<{ txHash: string; amount: string }>(
        `sessions/${sessionId}/refund`,
        "POST",
        { toAddress },
      );

      if (!r.ok) {
        setError(r.error);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen(true)}
      >
        Refund
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="row"
      style={{ flexWrap: "nowrap", gap: 6 }}
    >
      <input
        type="text"
        name="toAddress"
        placeholder="0x… refund address"
        required
        spellCheck={false}
        autoFocus
        style={{ width: 220, padding: "6px 8px", fontSize: 12.5 }}
      />
      <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
        {busy ? "Sending…" : "Confirm"}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        disabled={busy}
      >
        Cancel
      </button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </form>
  );
}
