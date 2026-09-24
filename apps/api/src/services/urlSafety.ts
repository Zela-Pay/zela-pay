/**
 * SSRF guard for merchant-supplied webhook URLs. The API server can reach
 * internal networks (databases, cloud metadata), so a webhook URL must never
 * be allowed to point there.
 */
import dns from "node:dns/promises";
import net from "node:net";
import { env } from "../config/env.js";

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^(fc|fd|fe[89ab])/.test(v) || v.startsWith("ff");
  }
  const p = ip.split(".").map(Number);
  const a = p[0]!;
  const b = p[1]!;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && p[2] === 0)
  );
}

/** Throws unless `raw` is an https URL resolving only to public addresses. */
export async function assertSafeWebhookUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Webhook URL is not a valid URL");
  }
  if (env.ALLOW_PRIVATE_WEBHOOK_URLS) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Webhook URL must be http(s)");
    return url;
  }
  if (url.protocol !== "https:") throw new Error("Webhook URL must use https");
  if (url.username || url.password) throw new Error("Webhook URL must not contain credentials");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) {
    throw new Error("Webhook URL must resolve to a public address");
  }
  return url;
}
