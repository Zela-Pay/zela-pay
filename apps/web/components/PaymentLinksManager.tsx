"use client";

import { useState, type FormEvent } from "react";
import { dashApi } from "./dashApi";
import { CopyButton } from "./CopyButton";
import { formatAmount, formatDate } from "../lib/format";
import { useSandboxMode } from "../lib/useSandboxMode";

interface PaymentLink {
  id: string;
  name: string;
  amount: string | null;
  active: boolean;
  isTest: boolean;
  createdAt: string;
}

export function PaymentLinksManager({ initialLinks }: { initialLinks: PaymentLink[] }) {
  const [sandbox] = useSandboxMode();
  const [links, setLinks] = useState(initialLinks);
  const [creating, setCreating] = useState(false);
  const [openAmount, setOpenAmount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  async function refresh() {
    const r = await dashApi<{ paymentLinks: PaymentLink[] }>("payment-links", "GET");
    if (r.ok) setLinks(r.data.paymentLinks);
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const openAmount = form.get("openAmount") === "on";
    const amount = openAmount ? undefined : String(form.get("amount") ?? "").trim();

    setBusy(true);
    setError(null);
    const r = await dashApi<{ paymentLink: PaymentLink; linkUrl: string }>("payment-links", "POST", { name, amount, isTest: sandbox });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    (e.target as HTMLFormElement).reset();
    setCreating(false);
    setOpenAmount(false);
    setJustCreated(r.data.linkUrl);
    await refresh();
  }

  async function toggleActive(link: PaymentLink) {
    const r = await dashApi(`payment-links/${link.id}`, "PATCH", { active: !link.active });
    if (!r.ok) return setError(r.error);
    await refresh();
  }

  return (
    <>
      {error && <div className="alert alert-bad" role="alert">{error}</div>}

      {justCreated && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2>Link created</h2>
          <div className="addr"><code>{justCreated}</code><CopyButton value={justCreated} /></div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-sm" onClick={() => setJustCreated(null)}>Done</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row between" style={{ marginBottom: creating ? 16 : 0 }}>
          <h2 style={{ margin: 0 }}>Links</h2>
          {!creating && (
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              Create link
            </button>
          )}
        </div>

        {creating && (
          <form onSubmit={create} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--line)" }}>
            <div className="field">
              <label htmlFor="pl-name">Name</label>
              <input id="pl-name" name="name" type="text" required maxLength={100} placeholder="Coffee, Donation, Invoice #204…" />
              <span className="hint">Shown to the payer on the checkout page.</span>
            </div>
            <label className="row" style={{ marginBottom: 10, fontWeight: 600, fontSize: 13 }}>
              <input
                type="checkbox"
                name="openAmount"
                style={{ width: "auto" }}
                checked={openAmount}
                onChange={(e) => setOpenAmount(e.target.checked)}
              />
              Let the payer choose the amount
            </label>
            <div className="field">
              <label htmlFor="pl-amount">Amount (USDC)</label>
              <input id="pl-amount" name="amount" type="text" inputMode="decimal" placeholder="19.99" disabled={openAmount} required={!openAmount} />
            </div>
            <p className="small muted">
              Creating a {sandbox ? "sandbox" : "production"} link — change the default in Settings.
            </p>
            <div className="row">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
              <button type="button" className="btn btn-sm" onClick={() => { setCreating(false); setOpenAmount(false); }}>Cancel</button>
            </div>
          </form>
        )}

        {links.length === 0 ? (
          <div className="empty">No payment links yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th className="num">Amount</th><th>Mode</th><th>Created</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td className="num">{l.amount ? `${formatAmount(l.amount)} USDC` : <span className="muted">Any amount</span>}</td>
                    <td>{l.isTest ? <span className="badge badge-awaiting_payment">Sandbox</span> : <span className="badge badge-settled">Production</span>}</td>
                    <td className="small">{formatDate(l.createdAt)}</td>
                    <td>{l.active ? <span className="badge badge-settled">Active</span> : <span className="badge badge-revoked">Inactive</span>}</td>
                    <td className="right">
                      <button className="btn btn-sm" onClick={() => toggleActive(l)}>{l.active ? "Deactivate" : "Activate"}</button>
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
