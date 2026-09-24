"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { CheckoutSession } from "@zela-checkout/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** True on a touch/phone-class device — where scanning a QR *on this same
 * screen* would be useless, and opening the deep link directly works. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isMobile;
}

/**
 * "Pay with Zela" path: deep link on mobile (opens the Zela app straight to
 * a pre-filled, PIN-confirmed payment), QR fallback on desktop (scanned by
 * the Zela mobile app's camera, same deep link encoded as a QR). Which one
 * leads depends on the device this page is actually open on — showing a QR
 * to scan on the phone you'd scan *with* helps no one.
 */
export function ZelaPayButton({ session }: { session: CheckoutSession }) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [showQrOnMobile, setShowQrOnMobile] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch(`${API_URL}/v1/zela/deep-link/${session.id}`)
      .then((res) => res.json())
      .then((data) => setDeepLink(data.deepLink))
      .catch(() => setError(true));
  }, [session.id]);

  if (error) return <p className="alert alert-bad">Could not prepare the Zela payment link.</p>;
  if (!deepLink) {
    return (
      <div className="qr-box">
        <div className="skel" style={{ width: 200, height: 200, borderRadius: 10 }} />
        <div className="skel skel-line" style={{ width: 180, height: 13 }} />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="qr-box">
        <a className="btn btn-primary btn-block" href={deepLink} style={{ fontSize: 16, padding: "14px 16px" }}>
          Open in Zela
        </a>
        <p className="small muted" style={{ margin: 0 }}>Opens the Zela app with this payment ready to confirm.</p>
        <div className="qr-fallback">
          <button type="button" className="link-btn" onClick={() => setShowQrOnMobile((v) => !v)}>
            {showQrOnMobile ? "Hide QR" : "Paying from another device? Show QR"}
          </button>
          {showQrOnMobile && <QRCodeSVG value={deepLink} size={180} />}
        </div>
      </div>
    );
  }

  return (
    <div className="qr-box">
      <QRCodeSVG value={deepLink} size={200} />
      <p className="small muted" style={{ margin: 0 }}>Open the Zela app on your phone and scan this code.</p>
    </div>
  );
}
