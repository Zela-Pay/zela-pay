"use client";

import { useState, type FormEvent } from "react";
import { dashApi } from "./dashApi";
import { CopyButton } from "./CopyButton";
import { useSandboxMode } from "../lib/useSandboxMode";
import { SecurityPanel } from "./SecurityPanel";

interface Props {
  name: string;
  settlementWallet: string;
  settlementToken: "USDC";
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
}

type Notice = { kind: "ok" | "bad"; text: string } | null;

function Notice({ n }: { n: Notice }) {
  return n ? <div className={`alert alert-${n.kind}`} role={n.kind === "bad" ? "alert" : "status"}>{n.text}</div> : null;
}

const formData = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(Array.from(new FormData(e.currentTarget).entries(), ([k, v]) => [k, String(v)]));

export function SettingsForms(p: Props) {
  const [sandbox, setSandbox] = useSandboxMode();
  const [profile, setProfile] = useState<Notice>(null);
  const [payout, setPayout] = useState<Notice>(null);
  const [password, setPassword] = useState<Notice>(null);
  const [hook, setHook] = useState<Notice>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [hookSet, setHookSet] = useState(Boolean(p.webhookUrl));

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await dashApi("settings", "PATCH", { name: formData(e).name });
    setProfile(r.ok ? { kind: "ok", text: "Saved." } : { kind: "bad", text: r.error });
  }

  async function savePayout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formData(e);
    if (!confirm(`Send all future payouts to ${f.settlementWallet}? Payouts are irreversible.`)) return;
    const r = await dashApi("settings", "PATCH", f);
    if (r.ok) (e.target as HTMLFormElement).reset();
    setPayout(r.ok ? { kind: "ok", text: "Payout settings updated." } : { kind: "bad", text: r.error });
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const r = await dashApi("settings", "PATCH", formData(e));
    if (r.ok) form.reset();
    setPassword(r.ok ? { kind: "ok", text: "Password changed." } : { kind: "bad", text: r.error });
  }

  async function saveWebhook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = formData(e).webhookUrl?.trim() ?? "";
    const r = await dashApi<{ webhookUrl: string | null; webhookSecret?: string | null }>("webhook", "PUT", { webhookUrl: url || null });
    if (!r.ok) return setHook({ kind: "bad", text: r.error });
    setHookSet(Boolean(r.data.webhookUrl));
    if (r.data.webhookSecret) setSecret(r.data.webhookSecret);
    setHook({ kind: "ok", text: r.data.webhookUrl ? "Webhook saved." : "Webhook removed." });
  }

  async function rotate() {
    if (!confirm("Rotate the signing secret? Your server must switch to the new secret or it will reject webhooks.")) return;
    const r = await dashApi<{ webhookSecret: string }>("webhook/rotate-secret", "POST", {});
    if (r.ok) setSecret(r.data.webhookSecret);
    else setHook({ kind: "bad", text: r.error });
  }

  return (
    <>
      <div className="card">
        <h2>Mode</h2>
        <p className="small muted">
          Sandbox is for trying things out — nothing here moves real money. Switch to Production when you&rsquo;re
          ready to accept real payments. This only sets the default for new keys and links below; anything you&rsquo;ve
          already created keeps the mode it was made in.
        </p>
        <div className="row" role="radiogroup" aria-label="Mode">
          <button
            type="button"
            className={`btn btn-sm${sandbox ? " btn-primary" : ""}`}
            aria-pressed={sandbox}
            onClick={() => setSandbox(true)}
          >
            Sandbox
          </button>
          <button
            type="button"
            className={`btn btn-sm${!sandbox ? " btn-primary" : ""}`}
            aria-pressed={!sandbox}
            onClick={() => setSandbox(false)}
          >
            Production
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Business</h2>
        <Notice n={profile} />
        <form onSubmit={saveProfile}>
          <div className="field">
            <label htmlFor="name">Business name</label>
            <input id="name" name="name" type="text" defaultValue={p.name} required maxLength={100} />
            <span className="hint">Shown to customers on the checkout page.</span>
          </div>
          <button className="btn btn-primary">Save</button>
        </form>
      </div>

      <div className="card">
        <h2>Webhook</h2>
        <p className="small muted">
          We POST a signed <code>checkout.session.completed</code> (or <code>.expired</code>) event here. Verify the{" "}
          <code>X-Zela-Checkout-Signature</code> header: HMAC-SHA256 of <code>timestamp.body</code> using your secret,
          timestamp from <code>X-Zela-Checkout-Timestamp</code>. HTTPS endpoints on public addresses only.
        </p>
        <Notice n={hook} />
        {secret && (
          <div className="field">
            <label>Signing secret — shown once</label>
            <div className="addr"><code>{secret}</code><CopyButton value={secret} /></div>
          </div>
        )}
        <form onSubmit={saveWebhook}>
          <div className="field">
            <label htmlFor="webhookUrl">Endpoint URL</label>
            <input id="webhookUrl" name="webhookUrl" type="url" defaultValue={p.webhookUrl ?? ""} placeholder="https://your.site/webhooks/zela" />
            <span className="hint">Leave empty and save to remove the endpoint.</span>
          </div>
          <div className="row">
            <button className="btn btn-primary">Save webhook</button>
            {hookSet && <button type="button" className="btn" onClick={rotate}>Rotate secret</button>}
          </div>
        </form>
      </div>

      <div className="card card-sensitive">
        <h2>Payouts</h2>
        <p className="small muted">
          Money is sent to <span className="mono">{p.settlementWallet}</span> ({p.settlementToken}). Changing where
          it goes requires your password.
        </p>
        <Notice n={payout} />
        <form onSubmit={savePayout} autoComplete="off">
          <div className="field">
            <label htmlFor="settlementWallet">New payout address</label>
            <input id="settlementWallet" name="settlementWallet" type="text" required spellCheck={false} placeholder="0x…" />
          </div>
          <div className="field">
            <label htmlFor="pw1">Current password</label>
            <input id="pw1" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn btn-primary">Update payouts</button>
        </form>
      </div>

      <div className="card card-sensitive">
        <h2>Password</h2>
        <Notice n={password} />
        <form onSubmit={savePassword}>
          <div className="field">
            <label htmlFor="pw2">Current password</label>
            <input id="pw2" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="pw3">New password</label>
            <input id="pw3" name="newPassword" type="password" required minLength={10} autoComplete="new-password" />
            <span className="hint">At least 10 characters.</span>
          </div>
          <button className="btn btn-primary">Change password</button>
        </form>
      </div>

      <SecurityPanel />
    </>
  );
}
