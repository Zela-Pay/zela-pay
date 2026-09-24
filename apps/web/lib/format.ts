import { explorerBase, type ArcNetwork } from "@zela-checkout/shared";

/** "19.99" -> "19.99"; keeps up to 6 decimals only when they carry information. */
export function formatAmount(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  settling: "Settling",
  settled: "Paid",
  expired: "Expired",
  failed: "Failed",
};

export const explorerTx = (hash: string, network: ArcNetwork) => `${explorerBase(network)}/tx/${hash}`;
