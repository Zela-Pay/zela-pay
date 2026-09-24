import Link from "next/link";
import type { CheckoutSession } from "@zela-checkout/shared";
import { apiFetch } from "../../../lib/api";
import { SessionsTable } from "../../../components/SessionsTable";

const FILTERS = [
  { value: "", label: "All" },
  { value: "settled", label: "Paid" },
  { value: "awaiting_payment", label: "Awaiting" },
  { value: "expired", label: "Expired" },
];

export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; before?: string }>;
}) {
  const { status = "", before = "" } = await searchParams;
  const qs = new URLSearchParams({ limit: "25" });
  if (status) qs.set("status", status);
  if (before) qs.set("before", before);

  const res = await apiFetch(`/v1/dashboard/sessions?${qs}`);
  const data = (await res.json()) as { sessions: CheckoutSession[]; nextBefore: string | null };

  const link = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status ? { status } : {}), ...extra });
    const s = p.toString();
    return `/dashboard/transactions${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <h1>Transactions</h1>
        <p className="muted">Every checkout session created with your API keys.</p>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <Link key={f.value} href={f.value ? `/dashboard/transactions?status=${f.value}` : "/dashboard/transactions"} className={`btn btn-sm${status === f.value ? " btn-primary" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="card">
        <SessionsTable sessions={data.sessions} showActions />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {before && <Link className="btn btn-sm" href={link({})}>← Newest</Link>}
        {data.nextBefore && <Link className="btn btn-sm" href={link({ before: data.nextBefore })}>Older →</Link>}
      </div>
    </>
  );
}
