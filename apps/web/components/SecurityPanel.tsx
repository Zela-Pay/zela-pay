"use client";

import { useEffect, useState } from "react";
import { dashApi } from "./dashApi";
import { formatDate } from "../lib/format";

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

interface LoginRow {
  method: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

const METHOD_LABEL: Record<string, string> = {
  password: "Password",
  google: "Google",
  email_link: "Email",
};

/** Picks out browser + OS from a raw User-Agent string — good enough for "which device is this", not meant to be exhaustive. */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function SecurityPanel() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [logins, setLogins] = useState<LoginRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function load() {
    const [s, l] = await Promise.all([
      dashApi<{ sessions: SessionRow[] }>("security/sessions", "GET"),
      dashApi<{ logins: LoginRow[] }>("security/login-history", "GET"),
    ]);
    if (s.ok) setSessions(s.data.sessions);
    else setError(s.error);
    if (l.ok) setLogins(l.data.logins);
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: string) {
    if (!confirm("Sign out this device? It will need to sign in again to access the dashboard.")) return;
    setRevoking(id);
    const r = await dashApi(`security/sessions/${id}`, "DELETE");
    setRevoking(null);
    if (r.ok) setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    else setError(r.error);
  }

  return (
    <div className="card">
      <h2>Security</h2>
      {error && <div className="alert alert-bad">{error}</div>}

      <h3 className="small muted" style={{ textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 }}>
        Active sessions
      </h3>
      {sessions === null ? (
        <p className="small muted">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="small muted">No active sessions.</p>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>IP</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="small">
                    {describeDevice(s.userAgent)}
                    {s.isCurrent && <span className="badge badge-settled" style={{ marginLeft: 6 }}>This device</span>}
                  </td>
                  <td className="small mono">{s.ip ?? "—"}</td>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{formatDate(s.lastSeenAt)}</td>
                  <td>
                    {!s.isCurrent && (
                      <button type="button" className="link-btn small" disabled={revoking === s.id} onClick={() => revoke(s.id)}>
                        {revoking === s.id ? "Signing out…" : "Sign out"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="small muted" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
        Recent login activity
      </h3>
      {logins === null ? (
        <p className="small muted">Loading…</p>
      ) : logins.length === 0 ? (
        <p className="small muted">No login activity yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Method</th>
                <th>IP</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l, i) => (
                <tr key={i}>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{formatDate(l.createdAt)}</td>
                  <td className="small">{METHOD_LABEL[l.method] ?? l.method}</td>
                  <td className="small mono">{l.ip ?? "—"}</td>
                  <td className="small">
                    {l.success ? <span style={{ color: "var(--accent)" }}>Success</span> : <span style={{ color: "var(--bad)" }}>Failed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
