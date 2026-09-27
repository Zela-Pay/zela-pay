import { apiFetch } from "../../../lib/api";
import { MiniAppCard } from "../../../components/MiniAppCard";

export default async function MiniAppPage() {
  const [manifestRes, payoutsRes] = await Promise.all([
    apiFetch("/v1/dashboard/mini-app"),
    apiFetch("/v1/dashboard/payouts"),
  ]);
  const manifest = await manifestRes.json();
  const { payouts } = await payoutsRes.json();

  return (
    <>
      <div className="page-head">
        <h1>Mini App</h1>
        <p className="muted">
          Run inside the Zela app and integrate USDC checkout and payouts directly.
        </p>
      </div>
      <MiniAppCard initial={manifest} initialPayouts={payouts} />
    </>
  );
}
