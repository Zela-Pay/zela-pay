/**
 * End-to-end-ish test over the real Express app and real SQL migrations, using
 * an in-process Postgres (PGlite) and a fake Arc (EVM) JSON-RPC node that
 * simulates a funded balance and successful transactions (see
 * `fundedAddresses`) — real settlement and refund sweeps ARE exercised here,
 * just against a simulated chain rather than a real one.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { decodeFunctionData, encodeFunctionResult, parseUnits } from "viem";

const ARC_MAINNET_CHAIN_ID = "0x" + (5042).toString(16);
const FAKE_TX_HASH = "0x" + "11".repeat(32);
const FUNDED_BALANCE_RAW = parseUnits("100", 6); // matches USDC's ERC-20 6 decimals

const BALANCE_OF_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Addresses the fake RPC treats as funded ($100 USDC via the ERC-20
// balanceOf interface), lowercased. The refund tests add the deposit
// address here once the session is created.
const fundedAddresses = new Set<string>();

// ── fake Arc (EVM) JSON-RPC ─────────────────────────────────────────────────
// Every account has a zero USDC balance except those in `fundedAddresses`,
// and every transaction "succeeds" instantly — enough surface for viem's
// readContract/writeContract + waitForTransactionReceipt to complete
// without a real chain. `eth_call`/`eth_estimateGas` are decoded with viem's
// own ABI utilities against the exact ABI usdcContract.ts uses, so the mock
// can't silently drift from what real encoding actually looks like.
const rpc = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const { id, method, params } = JSON.parse(body);
    res.setHeader("content-type", "application/json");
    let result: unknown = null;
    switch (method) {
      case "eth_call": {
        const { data } = params[0];
        const decoded = decodeFunctionData({ abi: BALANCE_OF_ABI, data });
        const addr = String(decoded.args[0]).toLowerCase();
        const balance = fundedAddresses.has(addr) ? FUNDED_BALANCE_RAW : 0n;
        result = encodeFunctionResult({ abi: BALANCE_OF_ABI, functionName: "balanceOf", result: balance });
        break;
      }
      case "eth_gasPrice":
      case "eth_maxPriorityFeePerGas":
        result = "0x3b9aca00";
        break;
      case "eth_chainId":
        result = ARC_MAINNET_CHAIN_ID;
        break;
      case "eth_blockNumber":
        result = "0x1";
        break;
      case "eth_estimateGas":
        result = "0xfde8"; // 65000
        break;
      case "eth_getTransactionCount":
        result = "0x0";
        break;
      case "eth_getBlockByNumber":
        result = { number: "0x1", baseFeePerGas: "0x3b9aca00", hash: "0x" + "22".repeat(32) };
        break;
      case "eth_sendRawTransaction":
        result = FAKE_TX_HASH;
        break;
      case "eth_getTransactionReceipt":
        result = {
          blockHash: "0x" + "22".repeat(32),
          blockNumber: "0x1",
          contractAddress: null,
          cumulativeGasUsed: "0xfde8",
          effectiveGasPrice: "0x3b9aca00",
          from: "0x" + "33".repeat(20),
          gasUsed: "0xfde8",
          logs: [],
          logsBloom: "0x" + "0".repeat(512),
          status: "0x1",
          to: "0x" + "44".repeat(20),
          transactionHash: FAKE_TX_HASH,
          transactionIndex: "0x0",
          type: "0x2",
        };
        break;
    }
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
  });
});

// ── webhook receiver ────────────────────────────────────────────────────────
let receiverStatus = 200;
const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
const receiver = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push({ headers: req.headers, body });
    res.statusCode = receiverStatus;
    res.end();
  });
});

const listen = (s: http.Server) => new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as AddressInfo).port)));

let base = "";
let apiServer: http.Server;
let db: PGlite;
let mods: {
  query: typeof import("../db/postgres.js").query;
  enqueueWebhook: typeof import("../services/webhookDelivery.js").enqueueWebhook;
  deliverPendingWebhooks: typeof import("../services/webhookDelivery.js").deliverPendingWebhooks;
  signPayload: typeof import("../services/webhookDelivery.js").signPayload;
  pollPendingSessions: typeof import("../services/paymentMonitor.js").pollPendingSessions;
  getSessionRow: typeof import("../services/sessionStore.js").getSessionRow;
  toSession: typeof import("../services/sessionStore.js").toSession;
};
let receiverUrl = "";

before(async () => {
  const rpcPort = await listen(rpc);
  const receiverPort = await listen(receiver);
  receiverUrl = `http://127.0.0.1:${receiverPort}/hook`;

  Object.assign(process.env, {
    ARC_NETWORK: "arc-mainnet",
    ARC_MAINNET_RPC_URL: `http://127.0.0.1:${rpcPort}`,
    SETTLEMENT_FEE_PAYER_SECRET_KEY: "0x" + "11".repeat(32),
    DATABASE_URL: "postgres://unused/unused",
    DEPOSIT_KEY_ENCRYPTION_KEY: "cd".repeat(32),
    CHECKOUT_WEB_ORIGIN: "http://localhost:4200",
    PLATFORM_FEE_BPS: "100",
    ALLOW_PRIVATE_WEBHOOK_URLS: "true", // the test receiver is on localhost
  });

  // Route the app's pg pool to PGlite.
  db = await PGlite.create();
  const runQuery = async (text: string, params?: unknown[]) => {
    // Migration files (and BEGIN/COMMIT) hold statements PGlite only allows via exec().
    if (!params && (text.split(";").filter((s) => s.trim()).length > 1 || /^(BEGIN|COMMIT|ROLLBACK)\b/i.test(text.trim()))) {
      await db.exec(text);
      return { rows: [], rowCount: 0 };
    }
    const r = await db.query(text, params ?? []);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  const { pool } = await import("../db/postgres.js");
  (pool as unknown as { query: unknown }).query = runQuery;
  (pool as unknown as { connect: unknown }).connect = async () => ({ query: runQuery, release: () => {} });

  const { migrate } = await import("../db/migrate.js");
  const files = await migrate();
  assert.equal(files.length, 12);
  // Re-running against an already-migrated database must be a no-op, not
  // re-run non-idempotent statements like 005's RENAME COLUMN.
  assert.deepEqual(await migrate(), []);

  const { app } = await import("../app.js");
  apiServer = http.createServer(app);
  base = `http://127.0.0.1:${await listen(apiServer)}`;

  mods = {
    ...(await import("../db/postgres.js")),
    ...(await import("../services/webhookDelivery.js")),
    ...(await import("../services/paymentMonitor.js")),
    ...(await import("../services/sessionStore.js")),
  };
});

after(async () => {
  for (const s of [apiServer, rpc, receiver]) s?.closeAllConnections?.();
  for (const s of [apiServer, rpc, receiver]) s?.close();
  await db?.close();
  setTimeout(() => process.exit(0), 100).unref();
});

const json = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let merchantId = "";
let sk = "";
let pk = "";
let sessionId = "";
let depositAddress = "";

const WALLET = "0x1111111111111111111111111111111111111111";
const PASSWORD = "correct horse battery";
let dash = "";
let otherDash = ""; // a second merchant's session, reused across tests rather than signing up again each time — /v1/auth/signup shares a 10/min/IP limiter with /v1/auth/login

test("signup creates an account and a session token; password is stored hashed", async () => {
  const base = { password: PASSWORD, name: "X", settlementWallet: WALLET, settlementToken: "USDC" };
  assert.equal((await json("POST", "/v1/auth/signup", { ...base, email: "nope" })).status, 400);
  assert.equal((await json("POST", "/v1/auth/signup", { ...base, email: "a@b.co", password: "short" })).status, 400);
  assert.equal((await json("POST", "/v1/auth/signup", { ...base, email: "a@b.co", settlementWallet: "not-an-address" })).status, 400);
  assert.equal((await json("POST", "/v1/auth/signup", { ...base, email: "a@b.co", settlementToken: "USDT" })).status, 400);

  const res = await json("POST", "/v1/auth/signup", { ...base, email: "Owner@Test.Store", name: "Test Store" });
  assert.equal(res.status, 201);
  const data = await res.json();
  merchantId = data.merchantId;
  dash = data.token;
  assert.match(dash, /^dash_/);

  const { rows } = await mods.query<{ password_hash: string; settlement_wallet: string }>(
    `SELECT password_hash, settlement_wallet FROM merchants WHERE id = $1`,
    [merchantId],
  );
  assert.ok(rows[0]!.password_hash.startsWith("scrypt$"));
  assert.ok(!rows[0]!.password_hash.includes(PASSWORD));
  assert.equal(rows[0]!.settlement_wallet, WALLET); // checksum-normalized, unchanged since already checksummed

  // duplicate email (case-insensitive)
  assert.equal((await json("POST", "/v1/auth/signup", { ...base, email: "owner@test.store" })).status, 409);
});

test("login works, wrong credentials are rejected", async () => {
  assert.equal((await json("POST", "/v1/auth/login", { email: "owner@test.store", password: "wrong wrong wrong" })).status, 401);
  assert.equal((await json("POST", "/v1/auth/login", { email: "nobody@test.store", password: PASSWORD })).status, 401);
  const ok = await json("POST", "/v1/auth/login", { email: "OWNER@test.store", password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).token, /^dash_/);
});

test("dashboard requires a session; API keys are shown once, listed without secrets, and revocable", async () => {
  assert.equal((await json("GET", "/v1/dashboard/me")).status, 401);
  assert.equal((await json("GET", "/v1/dashboard/me", undefined, { authorization: "Bearer dash_bogus" })).status, 401);

  const auth = { authorization: `Bearer ${dash}` };
  const me = await (await json("GET", "/v1/dashboard/me", undefined, auth)).json();
  assert.equal(me.settlementToken, "USDC");
  assert.equal(me.email, "Owner@Test.Store");
  assert.ok(!JSON.stringify(me).includes("scrypt"));

  // Explicitly live: this suite's fake RPC server (below) only answers for
  // arc-mainnet, and issueApiKeyPair now defaults new keys to sandbox
  // (arc-testnet) for safety — see that function's own comment.
  const created = await (await json("POST", "/v1/dashboard/api-keys", { isTest: false }, auth)).json();
  sk = created.secretKey;
  pk = created.publishableKey;
  assert.match(sk, /^sk_live_/);
  assert.match(pk, /^pk_live_/);

  const listRaw = await (await json("GET", "/v1/dashboard/api-keys", undefined, auth)).text();
  assert.ok(!listRaw.includes(sk), "listing must never contain the secret key");
  assert.ok(listRaw.includes(pk));

  const { rows } = await mods.query<{ secret_key_hash: string }>(`SELECT secret_key_hash FROM api_keys WHERE merchant_id = $1`, [merchantId]);
  assert.equal(rows[0]!.secret_key_hash.length, 64);
  assert.notEqual(rows[0]!.secret_key_hash, sk);

  // Revoking a key stops it working; a second key still does. Also kept
  // live — sk/pk get reassigned to this one below and reused by every
  // later test in this suite.
  const second = await (await json("POST", "/v1/dashboard/api-keys", { isTest: false }, auth)).json();
  assert.equal((await json("DELETE", `/v1/dashboard/api-keys/${created.id}`, undefined, auth)).status, 200);
  assert.equal((await json("POST", "/v1/sessions", { amount: "5" }, { authorization: `Bearer ${sk}` })).status, 401);
  assert.equal((await json("POST", "/v1/sessions/public", { amount: "3" }, { "x-publishable-key": pk })).status, 401);
  assert.equal((await json("DELETE", `/v1/dashboard/api-keys/${created.id}`, undefined, auth)).status, 404);
  sk = second.secretKey;
  pk = second.publishableKey;
});

test("session creation requires a valid secret key", async () => {
  assert.equal((await json("POST", "/v1/sessions", { amount: "5" })).status, 401);
  assert.equal((await json("POST", "/v1/sessions", { amount: "5" }, { authorization: "Bearer sk_live_wrong" })).status, 401);
  assert.equal((await json("POST", "/v1/sessions", { amount: "5" }, { authorization: `Bearer ${pk}` })).status, 401);
});

test("session creation validates amount", async () => {
  const auth = { authorization: `Bearer ${sk}` };
  for (const amount of ["0", "-3", "abc", "", "1e3", "0.0000001", "1,5", "0.000000"]) {
    assert.equal((await json("POST", "/v1/sessions", { amount }, auth)).status, 400, `amount=${amount}`);
  }
});

test("session redirect URLs must be http(s)", async () => {
  const auth = { authorization: `Bearer ${sk}` };
  for (const successUrl of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "not a url"]) {
    assert.equal((await json("POST", "/v1/sessions", { amount: "5", successUrl }, auth)).status, 400, successUrl);
  }
  assert.equal((await json("POST", "/v1/sessions", { amount: "5", cancelUrl: "javascript:1" }, auth)).status, 400);
});

test("creates a session and never leaks key material", async () => {
  const res = await json("POST", "/v1/sessions", { amount: "20", metadata: { order: "42" } }, { authorization: `Bearer ${sk}` });
  assert.equal(res.status, 201);
  const raw = await res.text();
  assert.ok(!/secret|deposit_secret/i.test(raw), "response must not contain key material");
  const data = JSON.parse(raw);
  sessionId = data.session.id;
  depositAddress = data.session.depositAddress;
  assert.match(sessionId, /^cs_/);
  assert.match(depositAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(data.session.status, "awaiting_payment");
  assert.equal(data.session.network, "arc-mainnet");
  assert.equal(Number(data.session.amountSettlement), 20);
  assert.equal(Number(data.session.platformFeeAmount), 0.2); // 1% of 20
  assert.deepEqual(data.session.metadata, { order: "42" });
  assert.equal(data.checkoutUrl, `http://localhost:4200/pay/${sessionId}`);

  // The stored secret is encrypted, not a raw key.
  const { rows } = await mods.query<{ deposit_secret_enc: string }>(`SELECT deposit_secret_enc FROM checkout_sessions WHERE id = $1`, [sessionId]);
  assert.ok(rows[0]!.deposit_secret_enc.length > 60);
});

test("GET session, EIP-681 payment URI, and Zela deep link", async () => {
  const got = await (await json("GET", `/v1/sessions/${sessionId}`)).json();
  assert.equal(got.session.id, sessionId);
  assert.equal(got.merchant.name, "Test Store");
  assert.equal((await json("GET", "/v1/sessions/cs_missing")).status, 404);

  const pay = await (await json("GET", `/v1/sessions/${sessionId}/payment-uri`)).json();
  assert.equal(pay.uri, `ethereum:0x3600000000000000000000000000000000000000@5042/transfer?address=${depositAddress}&uint256=20000000`);

  const zela = await (await json("GET", `/v1/zela/deep-link/${sessionId}`)).json();
  assert.ok(zela.deepLink.startsWith("zela://pay?"));
  assert.ok(zela.deepLink.includes(`session=${sessionId}`));
  assert.ok(zela.deepLink.includes("chainId=5042"));
});

test("public (widget) endpoint accepts only a publishable key", async () => {
  assert.equal((await json("POST", "/v1/sessions/public", { amount: "3" })).status, 401);
  assert.equal((await json("POST", "/v1/sessions/public", { amount: "3" }, { "x-publishable-key": sk })).status, 401);
  assert.equal((await json("POST", "/v1/sessions/public", { amount: "3" }, { "x-publishable-key": "pk_live_nope" })).status, 401);
  const ok = await json("POST", "/v1/sessions/public", { amount: "3" }, { "x-publishable-key": pk });
  assert.equal(ok.status, 201);
});

test("webhook is signed, delivered and marked delivered", async () => {
  const secret = "whsec_test";
  const put = await json("PUT", "/v1/webhooks", { webhookUrl: receiverUrl, webhookSecret: secret }, { authorization: `Bearer ${sk}` });
  assert.equal(put.status, 200);

  const row = (await mods.getSessionRow(sessionId))!;
  await mods.enqueueWebhook(mods.toSession(row), "checkout.session.completed");
  received.length = 0;
  await mods.deliverPendingWebhooks();

  assert.equal(received.length, 1);
  const { headers, body } = received[0]!;
  const ts = String(headers["x-zela-checkout-timestamp"]);
  assert.equal(headers["x-zela-checkout-signature"], mods.signPayload(ts, body, secret));
  const event = JSON.parse(body);
  assert.equal(event.type, "checkout.session.completed");
  assert.equal(event.data.id, sessionId);

  const { rows } = await mods.query<{ delivered_at: Date | null }>(`SELECT delivered_at FROM webhook_events WHERE session_id = $1`, [sessionId]);
  assert.ok(rows[0]!.delivered_at);
});

test("failed webhook delivery backs off instead of dropping the event", async () => {
  const row = (await mods.getSessionRow(sessionId))!;
  await mods.query(`DELETE FROM webhook_events`);
  await mods.enqueueWebhook(mods.toSession(row), "checkout.session.completed");
  receiverStatus = 500;
  await mods.deliverPendingWebhooks();
  receiverStatus = 200;

  const { rows } = await mods.query<{ attempts: number; delivered_at: Date | null; last_error: string; next_attempt_at: Date }>(
    `SELECT attempts, delivered_at, last_error, next_attempt_at FROM webhook_events`,
  );
  assert.equal(rows[0]!.attempts, 1);
  assert.equal(rows[0]!.delivered_at, null);
  assert.equal(rows[0]!.last_error, "HTTP 500");
  assert.ok(rows[0]!.next_attempt_at.getTime() > Date.now());

  // Not retried until the backoff elapses.
  received.length = 0;
  await mods.deliverPendingWebhooks();
  assert.equal(received.length, 0);
});

test("empty deposit account stays open; past-TTL session expires with a webhook", async () => {
  await mods.query(`DELETE FROM webhook_events`);
  await mods.pollPendingSessions(); // fake RPC reports a zero balance for every address
  assert.equal((await mods.getSessionRow(sessionId))!.status, "awaiting_payment");

  await mods.query(`UPDATE checkout_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1`, [sessionId]);
  await mods.pollPendingSessions();
  assert.equal((await mods.getSessionRow(sessionId))!.status, "expired");

  const { rows } = await mods.query<{ type: string }>(`SELECT type FROM webhook_events WHERE session_id = $1`, [sessionId]);
  assert.deepEqual(rows.map((r) => r.type), ["checkout.session.expired"]);
});

test("dashboard stats and paginated session list are scoped to the merchant", async () => {
  const auth = { authorization: `Bearer ${dash}` };
  const stats = await (await json("GET", "/v1/dashboard/stats", undefined, auth)).json();
  assert.equal(stats.settledCount, 0);
  assert.equal(stats.expiredCount, 1);
  assert.equal(stats.settledVolume, "0");

  const all = await (await json("GET", "/v1/dashboard/sessions?limit=1", undefined, auth)).json();
  assert.equal(all.sessions.length, 1);
  assert.ok(all.nextBefore);
  const next = await (await json("GET", `/v1/dashboard/sessions?limit=1&before=${encodeURIComponent(all.nextBefore)}`, undefined, auth)).json();
  assert.ok(next.sessions.every((s: { id: string }) => !all.sessions.some((a: { id: string }) => a.id === s.id)));
  const expired = await (await json("GET", "/v1/dashboard/sessions?status=expired", undefined, auth)).json();
  assert.ok(expired.sessions.length >= 1 && expired.sessions.every((s: { status: string }) => s.status === "expired"));
  assert.ok(!JSON.stringify(all).includes("deposit_secret"));

  // A second merchant sees none of these.
  const other = await (await json("POST", "/v1/auth/signup", { email: "two@test.store", password: PASSWORD, name: "Two", settlementWallet: WALLET, settlementToken: "USDC" })).json();
  otherDash = other.token;
  const theirs = await (await json("GET", "/v1/dashboard/sessions", undefined, { authorization: `Bearer ${other.token}` })).json();
  assert.equal(theirs.sessions.length, 0);
});

test("changing the settlement wallet or password requires the current password", async () => {
  const auth = { authorization: `Bearer ${dash}` };
  const NEW_WALLET = "0x2222222222222222222222222222222222222222";
  assert.equal((await json("PATCH", "/v1/dashboard/settings", { settlementWallet: NEW_WALLET }, auth)).status, 403);
  assert.equal((await json("PATCH", "/v1/dashboard/settings", { settlementWallet: NEW_WALLET, currentPassword: "wrong" }, auth)).status, 403);
  assert.equal((await json("PATCH", "/v1/dashboard/settings", { settlementWallet: "bad", currentPassword: PASSWORD }, auth)).status, 400);
  assert.equal((await json("PATCH", "/v1/dashboard/settings", { settlementWallet: NEW_WALLET, currentPassword: PASSWORD }, auth)).status, 200);
  assert.equal((await (await json("GET", "/v1/dashboard/me", undefined, auth)).json()).settlementWallet, NEW_WALLET);
  assert.equal((await json("PATCH", "/v1/dashboard/settings", { name: "Renamed" }, auth)).status, 200);
});

test("dashboard webhook: secret shown once, rotatable, invalid URLs rejected", async () => {
  const auth = { authorization: `Bearer ${dash}` };
  assert.equal((await json("PUT", "/v1/dashboard/webhook", { webhookUrl: "ftp://x.test" }, auth)).status, 400);
  assert.equal((await json("PUT", "/v1/dashboard/webhook", { webhookUrl: "nonsense" }, auth)).status, 400);
  const set = await (await json("PUT", "/v1/dashboard/webhook", { webhookUrl: receiverUrl }, auth)).json();
  assert.equal(set.webhookUrl, receiverUrl);
  const again = await (await json("PUT", "/v1/dashboard/webhook", { webhookUrl: receiverUrl }, auth)).json();
  assert.equal(again.webhookSecret, null, "existing secret is not re-shown");
  const rotated = await (await json("POST", "/v1/dashboard/webhook/rotate-secret", {}, auth)).json();
  assert.match(rotated.webhookSecret, /^whsec_/);
});

test("refund sweeps a stuck balance back out, and only once", async () => {
  const auth = { authorization: `Bearer ${sk}` };
  const created = await (await json("POST", "/v1/sessions", { amount: "5" }, auth)).json();
  const refundSessionId: string = created.session.id;
  const refundDepositAddress: string = created.session.depositAddress;

  const dashAuth = { authorization: `Bearer ${dash}` };
  const REFUND_TO = "0x5555555555555555555555555555555555555555".slice(0, 42);

  // Not refundable yet: it's awaiting_payment with nothing on it — the RPC
  // reports a zero balance, so "nothing to sweep" rather than a false success.
  const nothingYet = await json("POST", `/v1/dashboard/sessions/${refundSessionId}/refund`, { toAddress: REFUND_TO }, dashAuth);
  assert.equal(nothingYet.status, 422);
  assert.match((await nothingYet.json()).error, /nothing to refund/i);

  // Validation: bad address, wrong owner, unknown session.
  assert.equal((await json("POST", `/v1/dashboard/sessions/${refundSessionId}/refund`, { toAddress: "not-an-address" }, dashAuth)).status, 400);
  assert.equal((await json("POST", `/v1/dashboard/sessions/${refundSessionId}/refund`, { toAddress: REFUND_TO })).status, 401);
  assert.equal((await json("POST", `/v1/dashboard/sessions/cs_missing/refund`, { toAddress: REFUND_TO }, dashAuth)).status, 404);

  // Expire it while still unfunded (a real expiry), THEN a balance shows up —
  // the monitor only polls 'awaiting_payment' sessions, so this genuinely
  // gets stuck rather than being picked up as a late settlement.
  await mods.query(`UPDATE checkout_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1`, [refundSessionId]);
  await mods.pollPendingSessions();
  assert.equal((await mods.getSessionRow(refundSessionId))!.status, "expired");
  fundedAddresses.add(refundDepositAddress.toLowerCase());

  const ok = await json("POST", `/v1/dashboard/sessions/${refundSessionId}/refund`, { toAddress: REFUND_TO }, dashAuth);
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.equal(okBody.txHash, FAKE_TX_HASH);
  assert.equal(okBody.amount, "99.999903"); // the fake RPC's $100 funded balance, minus the estimated gas reserve

  const row = (await mods.getSessionRow(refundSessionId))!;
  assert.equal(row.status, "failed");
  assert.equal(row.refund_tx_hash, FAKE_TX_HASH);
  assert.equal(row.refund_to, REFUND_TO);

  const { rows: events } = await mods.query<{ type: string }>(`SELECT type FROM webhook_events WHERE session_id = $1`, [refundSessionId]);
  assert.ok(events.some((e) => e.type === "checkout.session.failed"));

  // Can't refund twice.
  const twice = await json("POST", `/v1/dashboard/sessions/${refundSessionId}/refund`, { toAddress: REFUND_TO }, dashAuth);
  assert.equal(twice.status, 400);
  assert.match((await twice.json()).error, /already been refunded/i);
});

test("payment links: fixed-amount link pins the amount and ignores the payer's", async () => {
  const dashAuth = { authorization: `Bearer ${dash}` };

  assert.equal((await json("POST", "/v1/dashboard/payment-links", { name: "" }, dashAuth)).status, 400);
  assert.equal((await json("POST", "/v1/dashboard/payment-links", { name: "Coffee", amount: "not-a-number" }, dashAuth)).status, 400);
  assert.equal((await json("POST", "/v1/dashboard/payment-links", { name: "Coffee", successUrl: "javascript:1" }, dashAuth)).status, 400);
  assert.equal((await json("POST", "/v1/dashboard/payment-links", { name: "Coffee" })).status, 401);

  const created = await json("POST", "/v1/dashboard/payment-links", { name: "Coffee", amount: "5" }, dashAuth);
  assert.equal(created.status, 201);
  const { paymentLink, linkUrl } = await created.json();
  assert.match(paymentLink.id, /^plink_/);
  assert.equal(Number(paymentLink.amount), 5);
  assert.equal(paymentLink.active, true);
  assert.equal(linkUrl, `http://localhost:4200/pay/link/${paymentLink.id}`);

  // Public read.
  const got = await (await json("GET", `/v1/payment-links/${paymentLink.id}`)).json();
  assert.equal(got.paymentLink.name, "Coffee");
  assert.equal(got.merchant.name, "Renamed");
  assert.equal((await json("GET", "/v1/payment-links/plink_missing")).status, 404);

  // Paying through it ignores any amount the caller supplies — it's pinned by the link.
  const paid = await json("POST", `/v1/payment-links/${paymentLink.id}/sessions`, { amount: "999" });
  assert.equal(paid.status, 201);
  const { session } = await paid.json();
  assert.equal(Number(session.amountSettlement), 5);
  assert.equal(session.paymentLinkId, paymentLink.id);

  // It shows up filtered by link, and the link's own listing includes it.
  const bySession = await (await json("GET", `/v1/dashboard/sessions?paymentLinkId=${paymentLink.id}`, undefined, dashAuth)).json();
  assert.equal(bySession.sessions.length, 1);
  assert.equal(bySession.sessions[0].id, session.id);

  // Deactivate: can't be paid, but the underlying session is untouched.
  assert.equal((await json("PATCH", `/v1/dashboard/payment-links/${paymentLink.id}`, { active: false }, dashAuth)).status, 200);
  const afterDeactivate = await json("POST", `/v1/payment-links/${paymentLink.id}/sessions`, {});
  assert.equal(afterDeactivate.status, 400);
  assert.match((await afterDeactivate.json()).error, /no longer active/i);

  // Can't manage someone else's link.
  assert.equal((await json("PATCH", `/v1/dashboard/payment-links/${paymentLink.id}`, { active: true }, { authorization: `Bearer ${otherDash}` })).status, 404);
});

test("payment links: open-amount link requires the payer to choose", async () => {
  const dashAuth = { authorization: `Bearer ${dash}` };
  const created = await json("POST", "/v1/dashboard/payment-links", { name: "Donate" }, dashAuth);
  assert.equal(created.status, 201);
  const { paymentLink } = await created.json();
  assert.equal(paymentLink.amount, null);

  assert.equal((await json("POST", `/v1/payment-links/${paymentLink.id}/sessions`, {})).status, 400);

  const paid = await json("POST", `/v1/payment-links/${paymentLink.id}/sessions`, { amount: "12.34" });
  assert.equal(paid.status, 201);
  const { session } = await paid.json();
  assert.equal(Number(session.amountSettlement), 12.34);
});

test("a funded deposit settles: fee leg + merchant sweep, both idempotent on retry", async () => {
  const auth = { authorization: `Bearer ${sk}` };
  const created = await (await json("POST", "/v1/sessions", { amount: "10" }, auth)).json();
  const settleSessionId: string = created.session.id;
  const settleDepositAddress: string = created.session.depositAddress;

  fundedAddresses.add(settleDepositAddress.toLowerCase());
  await mods.query(`DELETE FROM webhook_events WHERE session_id = $1`, [settleSessionId]);

  await mods.pollPendingSessions();

  const row = (await mods.getSessionRow(settleSessionId))!;
  assert.equal(row.status, "settled");
  assert.equal(row.settlement_tx_hash, FAKE_TX_HASH);
  assert.ok(row.fee_tx_hash, "fee leg tx hash was recorded");
  assert.ok(row.funds_confirmed_at, "funds_confirmed_at was stamped");
  assert.equal(Number(row.platform_fee_amount), 0.1); // 1% of 10

  const { rows: events } = await mods.query<{ type: string }>(
    `SELECT type FROM webhook_events WHERE session_id = $1`,
    [settleSessionId],
  );
  assert.deepEqual(events.map((e) => e.type), ["checkout.session.completed"]);

  // Re-polling an already-settled session (status is no longer
  // 'awaiting_payment') must not touch it again.
  const feeTxHashBefore = row.fee_tx_hash;
  await mods.pollPendingSessions();
  const rowAfter = (await mods.getSessionRow(settleSessionId))!;
  assert.equal(rowAfter.status, "settled");
  assert.equal(rowAfter.fee_tx_hash, feeTxHashBefore);
});

test("logout invalidates the session token", async () => {
  // Reuses the session from the very first signup test rather than logging in
  // again — /v1/auth/login and /v1/auth/signup share one rate limiter
  // (10/min/IP), and this test file's earlier tests are already close to it.
  const auth = { authorization: `Bearer ${dash}` };
  assert.equal((await json("GET", "/v1/dashboard/me", undefined, auth)).status, 200);
  assert.equal((await json("POST", "/v1/auth/logout", {}, auth)).status, 200);
  assert.equal((await json("GET", "/v1/dashboard/me", undefined, auth)).status, 401);
});
