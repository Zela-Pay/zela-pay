"use client";

import { useState, type FormEvent } from "react";
import type { Payout } from "@zela-checkout/shared";
import { dashApi } from "./dashApi";
import { formatAmount, formatDate, explorerTx, shortAddress } from "../lib/format";

interface Manifest {
  isMiniApp: boolean;
  url: string | null;
  iconUrl: string | null;
  tagline: string | null;
}

type Notice = { kind: "ok" | "bad"; text: string } | null;

function Notice({ n }: { n: Notice }) {
  return n ? <div className={`alert alert-${n.kind}`} role={n.kind === "bad" ? "alert" : "status"}>{n.text}</div> : null;
}

export function MiniAppCard({ initial, initialPayouts }: { initial: Manifest; initialPayouts: Payout[] }) {
  const [manifest, setManifest] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [payouts] = useState(initialPayouts);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const form = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const r = await dashApi<Manifest>("mini-app", "PATCH", {
      url: form.url,
      iconUrl: form.iconUrl,
      tagline: form.tagline,
    });
    setBusy(false);
    if (!r.ok) {
      setNotice({ kind: "bad", text: r.error });
      return;
    }
    setManifest((m) => ({ ...m, url: form.url || m.url, iconUrl: form.iconUrl || m.iconUrl, tagline: form.tagline || m.tagline }));
    setNotice({ kind: "ok", text: "Saved." });
  }

  async function toggle() {
    setBusy(true);
    setNotice(null);
    const r = await dashApi<Manifest>("mini-app", "PATCH", { isMiniApp: !manifest.isMiniApp });
    setBusy(false);
    if (!r.ok) {
      setNotice({ kind: "bad", text: r.error });
      return;
    }
    setManifest((m) => ({ ...m, isMiniApp: !m.isMiniApp }));
    setNotice({ kind: "ok", text: !manifest.isMiniApp ? "Your Mini App is now listed." : "Your Mini App is now unlisted." });
  }

  return (
    <>
      <div className="card">
        <h2>Mini App</h2>
        <p className="small muted">
          Run inside the Zela app with a JS bridge for USDC checkout and payouts — see{" "}
          <a href="/docs/miniapps">the Mini Apps docs</a>. Listing requires a launch URL below.
        </p>
        <Notice n={notice} />

        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <span className="small">
            Status: <strong>{manifest.isMiniApp ? "Listed in the Mini Apps directory" : "Not listed"}</strong>
          </span>
          <button type="button" className={`btn btn-sm${manifest.isMiniApp ? "" : " btn-primary"}`} disabled={busy} onClick={toggle}>
            {manifest.isMiniApp ? "Unlist" : "List my Mini App"}
          </button>
        </div>

        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="url">Launch URL</label>
            <input id="url" name="url" type="url" defaultValue={manifest.url ?? ""} placeholder="https://your-mini-app.example.com" />
            <span className="hint">Opens in a WebView inside the Zela app, with the bridge SDK injected.</span>
          </div>
          <div className="field">
            <label htmlFor="iconUrl">Icon URL</label>
            <input id="iconUrl" name="iconUrl" type="url" defaultValue={manifest.iconUrl ?? ""} placeholder="https://your-mini-app.example.com/icon.png" />
          </div>
          <div className="field">
            <label htmlFor="tagline">Tagline</label>
            <input id="tagline" name="tagline" type="text" maxLength={140} defaultValue={manifest.tagline ?? ""} placeholder="Shown in the Mini Apps directory" />
          </div>
          <button className="btn btn-primary" disabled={busy}>Save</button>
        </form>
      </div>

      <div className="card">
        <h2>Payouts</h2>
        <p className="small muted">
          Non-custodial: your own backend signs and sends each transfer, then reports it here for verification —
          Zela never holds your funds. See <a href="/docs/miniapps#payouts">the payouts guide</a>.
        </p>
        {payouts.length === 0 ? (
          <div className="empty">No payouts reported yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>To</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="small" style={{ whiteSpace: "nowrap" }}>{formatDate(p.createdAt)}</td>
                    <td className="small">{p.toIdentifier}</td>
                    <td className="num">{formatAmount(p.amount)} USDC</td>
                    <td>
                      <span className={`badge badge-${p.status === "verified" ? "settled" : p.status === "failed" ? "failed" : "awaiting_payment"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="small">
                      <a href={explorerTx(p.txHash, p.network)} target="_blank" rel="noreferrer" className="mono">
                        {shortAddress(p.txHash)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
