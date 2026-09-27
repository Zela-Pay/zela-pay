"use client";

import { useEffect, useState, type FormEvent } from "react";
import { dashApi } from "./dashApi";
import { CopyButton } from "./CopyButton";

type Notice = { kind: "ok" | "bad"; text: string } | null;

/**
 * Lets a merchant claim "<handle>.zela.merchant" — a payment ID the Zela
 * app itself resolves (see Zela-backend's /v1/identity/resolve and
 * routes/dashboard.ts's GET/PUT /merchant-id here). Paying this ID is a
 * DIRECT wallet-to-wallet transfer inside the Zela app — it does not go
 * through a checkout session, so there's no fee, no webhook, and it
 * won't show up in the sessions table. That's worth saying plainly here
 * rather than letting a merchant assume it behaves like Checkout.
 */
export function MerchantIdCard() {
  const [handle, setHandle] = useState<string | null | undefined>(undefined); // undefined = loading
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dashApi<{ handle: string | null }>("merchant-id", "GET").then((r) => {
      if (r.ok) setHandle(r.data.handle);
      else setHandle(null);
    });
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const r = await dashApi<{ handle: string }>("merchant-id", "PUT", { handle: input.trim().toLowerCase() });
    setBusy(false);
    if (!r.ok) {
      setNotice({ kind: "bad", text: r.error });
      return;
    }
    setHandle(r.data.handle);
    setInput("");
    setNotice({ kind: "ok", text: "Saved." });
  }

  return (
    <div className="card">
      <h2>Zela Payment ID</h2>
      <p className="small muted">
        A payment ID customers can pay you with directly inside the ZelaPay App — no link, no QR. This is a{" "}
        <strong>direct wallet transfer</strong>, separate from Checkout: no fee, no webhook, and it won&rsquo;t appear
        in your sessions list.
      </p>
      <Notice n={notice} />

      {handle === undefined ? (
        <p className="small muted">Loading…</p>
      ) : handle ? (
        <>
          <div className="field">
            <label>Your payment ID</label>
            <div className="addr">
              <code>{handle}.zela.merchant</code>
              <CopyButton value={`${handle}.zela.merchant`} />
            </div>
          </div>
          <form onSubmit={submit} className="row" style={{ alignItems: "flex-end", gap: 10 }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="handle">Change it</label>
              <input
                id="handle"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={handle}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]{3,20}"
              />
            </div>
            <button className="btn" disabled={busy || !input.trim()}>{busy ? "Saving…" : "Update"}</button>
          </form>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="handle">Choose a payment ID</label>
            <input
              id="handle"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="yourstore"
              required
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9_]{3,20}"
            />
            <span className="hint">3-20 lowercase letters, numbers, or underscores. Shown as {input.trim().toLowerCase() || "yourstore"}.zela.merchant</span>
          </div>
          <button className="btn btn-primary" disabled={busy || !input.trim()}>{busy ? "Claiming…" : "Claim payment ID"}</button>
        </form>
      )}
    </div>
  );
}

function Notice({ n }: { n: Notice }) {
  return n ? <div className={`alert alert-${n.kind}`} role={n.kind === "bad" ? "alert" : "status"}>{n.text}</div> : null;
}
