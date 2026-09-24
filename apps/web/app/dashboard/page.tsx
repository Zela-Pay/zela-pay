import Link from "next/link";
import type { CheckoutSession } from "@zela-checkout/shared";
import { apiFetch, getMe } from "../../lib/api";
import { formatAmount } from "../../lib/format";
import { SessionsTable } from "../../components/SessionsTable";

interface Stats {
  settledCount: number;
  openCount: number;
  expiredCount: number;
  settledVolume: string;
  platformFees: string;
  volume30d: string;
}

export default async function Overview() {
  const [me, statsRes, sessionsRes, keysRes] = await Promise.all([
    getMe(),
    apiFetch("/v1/dashboard/stats"),
    apiFetch("/v1/dashboard/sessions?limit=5"),
    apiFetch("/v1/dashboard/api-keys"),
  ]);
  const stats = (await statsRes.json()) as Stats;
  const { sessions } = (await sessionsRes.json()) as { sessions: CheckoutSession[] };
  const { keys } = (await keysRes.json()) as { keys: { revokedAt: string | null }[] };
  const token = me?.settlementToken ?? "USDC";
  const hasKey = keys.some((k) => !k.revokedAt);

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p className="muted">Payments settle to {me?.settlementWallet ? <span className="mono">{me.settlementWallet}</span> : "your wallet"} in {token}.</p>
      </div>

      {!hasKey && (
        <div className="alert alert-warn">
          You don&apos;t have an API key yet. <Link href="/dashboard/api-keys">Create one</Link> to start creating checkout sessions.
        </div>
      )}
      {!me?.webhookUrl && (
        <div className="alert alert-warn">
          No webhook endpoint set. Without it your server won&apos;t be told when a payment settles.{" "}
          <Link href="/dashboard/settings">Add one</Link>.
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="label">Settled volume</div><div className="value">{formatAmount(stats.settledVolume)}</div><div className="small muted">{token}, all time</div></div>
        <div className="stat"><div className="label">Last 30 days</div><div className="value">{formatAmount(stats.volume30d)}</div><div className="small muted">{token}</div></div>
        <div className="stat"><div className="label">Paid sessions</div><div className="value">{stats.settledCount}</div></div>
        <div className="stat"><div className="label">Open</div><div className="value">{stats.openCount}</div><div className="small muted">awaiting payment</div></div>
        <div className="stat"><div className="label">Platform fees</div><div className="value">{formatAmount(stats.platformFees)}</div><div className="small muted">{token} deducted (1%)</div></div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Recent sessions</h2>
          <Link href="/dashboard/transactions" className="small">View all</Link>
        </div>
        <SessionsTable sessions={sessions} />
      </div>

      <div className="card">
        <h2>Create a session from your server</h2>
        <pre className="snippet">{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100"}/v1/sessions \\
  -H "authorization: Bearer sk_live_..." \\
  -H "content-type: application/json" \\
  -d '{"amount":"19.99","successUrl":"https://your.site/thanks"}'`}</pre>
        <p className="small muted" style={{ margin: "10px 0 0" }}>
          Redirect the customer to the returned <code>checkoutUrl</code>. You&apos;ll get a <code>checkout.session.completed</code> webhook when it settles.
        </p>
      </div>
    </>
  );
}
