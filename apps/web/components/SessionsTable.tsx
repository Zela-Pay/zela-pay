import type { CheckoutSession } from "@zela-checkout/shared";
import { explorerTx, formatAmount, formatDate, shortAddress, STATUS_LABEL } from "../lib/format";
import { RefundAction } from "./RefundAction";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function SessionsTable({ sessions, showActions = false }: { sessions: CheckoutSession[]; showActions?: boolean }) {
  if (sessions.length === 0) {
    return <div className="empty">No checkout sessions yet.</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Created</th>
            <th>Session</th>
            <th className="num">Amount</th>
            <th>Status</th>
            <th>Settlement</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td className="small" style={{ whiteSpace: "nowrap" }}>{formatDate(s.createdAt)}</td>
              <td>
                <a className="mono small" href={`/pay/${s.id}`} target="_blank" rel="noreferrer">
                  {s.id.slice(0, 13)}…
                </a>
                {Object.keys(s.metadata).length > 0 && (
                  <div className="small muted">{Object.entries(s.metadata).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
                )}
              </td>
              <td className="num">
                {formatAmount(s.amountSettlement)} {s.settlementToken}
              </td>
              <td>
                <StatusBadge status={s.status} />
                {s.lastSettlementError && s.status !== "settled" && (
                  <div className="small muted" style={{ marginTop: 4, maxWidth: 220 }} title={s.lastSettlementError}>
                    ⚠ {s.lastSettlementError}
                  </div>
                )}
              </td>
              <td className="small">
                {s.settlementTxHash ? (
                  <a href={explorerTx(s.settlementTxHash, s.network)} target="_blank" rel="noreferrer" className="mono">
                    {shortAddress(s.settlementTxHash)}
                  </a>
                ) : s.refundTxHash ? (
                  <a href={explorerTx(s.refundTxHash, s.network)} target="_blank" rel="noreferrer" className="mono">
                    {shortAddress(s.refundTxHash)} <span className="muted">(refund)</span>
                  </a>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              {showActions && (
                <td>
                  <RefundAction sessionId={s.id} status={s.status} refunded={Boolean(s.refundTxHash)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
