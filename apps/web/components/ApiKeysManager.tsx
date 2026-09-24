"use client";

import { useState } from "react";
import { dashApi } from "./dashApi";
import { CopyButton } from "./CopyButton";
import { formatDate } from "../lib/format";
import { useSandboxMode } from "../lib/useSandboxMode";

interface Key {
  id: string;
  publishableKey: string;
  isTest: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export function ApiKeysManager({ initialKeys }: { initialKeys: Key[] }) {
  const [sandbox] = useSandboxMode();
  const [keys, setKeys] = useState(initialKeys);
  const [fresh, setFresh] = useState<{ publishableKey: string; secretKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await dashApi<{ keys: Key[] }>("api-keys", "GET");
    if (r.ok) setKeys(r.data.keys);
  }

  async function create(isTest: boolean) {
    setBusy(true);
    setError(null);
    const r = await dashApi<{ publishableKey: string; secretKey: string }>("api-keys", "POST", { isTest });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setFresh(r.data);
    await refresh();
  }

  async function revoke(k: Key) {
    if (!confirm(`Revoke ${k.publishableKey}? Anything using this key will stop working immediately.`)) return;
    const r = await dashApi(`api-keys/${k.id}`, "DELETE");
    if (!r.ok) return setError(r.error);
    await refresh();
  }

  return (
    <>
      {error && <div className="alert alert-bad" role="alert">{error}</div>}

      {fresh && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2>Your new API key</h2>
          <div className="alert alert-warn">
            Copy the secret key now. It is shown once and can&apos;t be recovered — if you lose it, create a new key.
          </div>
          <div className="field">
            <label>Secret key (server-side only)</label>
            <div className="addr"><code>{fresh.secretKey}</code><CopyButton value={fresh.secretKey} /></div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Publishable key (safe for the browser / widget)</label>
            <div className="addr"><code>{fresh.publishableKey}</code><CopyButton value={fresh.publishableKey} /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-sm" onClick={() => setFresh(null)}>I&apos;ve saved it</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Keys</h2>
          <button className="btn btn-primary btn-sm" onClick={() => create(sandbox)} disabled={busy}>
            {busy ? "Creating…" : `Create ${sandbox ? "sandbox" : "production"} key`}
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          New keys are {sandbox ? "sandbox" : "production"} by default — change that in Settings.
        </p>
        {keys.length === 0 ? (
          <div className="empty">No keys yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Publishable key</th><th>Mode</th><th>Created</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="mono small">{k.publishableKey}</td>
                    <td>{k.isTest ? <span className="badge badge-awaiting_payment">Sandbox</span> : <span className="badge badge-settled">Production</span>}</td>
                    <td className="small">{formatDate(k.createdAt)}</td>
                    <td>{k.revokedAt ? <span className="badge badge-revoked">Revoked</span> : <span className="badge badge-settled">Active</span>}</td>
                    <td className="right">
                      {!k.revokedAt && <button className="btn btn-sm btn-danger" onClick={() => revoke(k)}>Revoke</button>}
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
