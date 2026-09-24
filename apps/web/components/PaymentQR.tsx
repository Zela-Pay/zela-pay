"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { CheckoutSession } from "@zela-checkout/shared";
import { CopyButton } from "./CopyButton";
import { shortAddress } from "../lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Generic EIP-681 payment URI QR — scannable by any EVM wallet that supports it. */
export function PaymentQR({ session }: { session: CheckoutSession }) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/v1/sessions/${session.id}/payment-uri`)
      .then((res) => res.json())
      .then((data) => setUri(data.uri))
      .catch(() => setError(true));
  }, [session.id]);

  if (error) return <p className="alert alert-bad">Could not prepare a payment QR.</p>;
  if (!uri) {
    return (
      <div className="qr-box">
        <div className="skel" style={{ width: 220, height: 220, borderRadius: 10 }} />
      </div>
    );
  }

  return (
    <div className="qr-box">
      <QRCodeSVG value={uri} size={220} />
      <p className="small muted" style={{ margin: 0 }}>Scan with any EVM wallet that supports payment requests.</p>
      <div className="addr">
        <code>{shortAddress(session.depositAddress)}</code>
        <CopyButton value={session.depositAddress} />
      </div>
    </div>
  );
}
