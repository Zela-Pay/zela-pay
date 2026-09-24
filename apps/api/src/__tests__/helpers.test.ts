import test from "node:test";
import assert from "node:assert/strict";

// env.ts validates on import, so set required vars before loading modules.
Object.assign(process.env, {
  SETTLEMENT_FEE_PAYER_SECRET_KEY: "0x" + "ab".repeat(32),
  DATABASE_URL: "postgres://localhost/test",
  DEPOSIT_KEY_ENCRYPTION_KEY: "ab".repeat(32),
  CHECKOUT_WEB_ORIGIN: "http://localhost:4200",
  PLATFORM_FEE_BPS: "100",
});

const { toRaw, rawToDecimal } = await import("../services/settlement.js");
const { encryptSecret, decryptSecret } = await import("../services/keyVault.js");
const { signPayload } = await import("../services/webhookDelivery.js");
const { calculatePlatformFee } = await import("../services/feeService.js");
const { rateLimit } = await import("../middleware/rateLimit.js");

// USDC on Arc is handled via its ERC-20 interface — 6 decimals, not the
// native/gas layer's 18 — see packages/shared/src/tokens.ts.
test("toRaw converts decimal strings without float error", () => {
  assert.equal(toRaw("19.99"), 19_990_000n);
  assert.equal(toRaw("1"), 1_000_000n);
  assert.equal(toRaw("0.000001"), 1n);
});

test("rawToDecimal round-trips toRaw", () => {
  for (const v of ["19.99", "0.000001", "1234.5"]) {
    assert.equal(rawToDecimal(toRaw(v)), v);
  }
  assert.equal(rawToDecimal(0n), "0");
});

test("keyVault round-trips and detects tampering", () => {
  const secret = new Uint8Array(64).map((_, i) => i);
  const enc = encryptSecret(secret);
  assert.deepEqual(decryptSecret(enc), secret);
  assert.notEqual(encryptSecret(secret), enc); // fresh IV each time

  const buf = Buffer.from(enc, "base64");
  buf[buf.length - 1]! ^= 1;
  assert.throws(() => decryptSecret(buf.toString("base64")));
});

test("signPayload is deterministic and depends on timestamp, body and secret", () => {
  const a = signPayload("1700000000", '{"a":1}', "s");
  assert.equal(a, signPayload("1700000000", '{"a":1}', "s"));
  assert.notEqual(a, signPayload("1700000001", '{"a":1}', "s"));
  assert.notEqual(a, signPayload("1700000000", '{"a":2}', "s"));
  assert.notEqual(a, signPayload("1700000000", '{"a":1}', "t"));
});

test("calculatePlatformFee takes 1%", () => {
  const { feeAmount, netAmount, feeBps } = calculatePlatformFee(200);
  assert.equal(feeBps, 100);
  assert.equal(feeAmount, 2);
  assert.equal(netAmount, 198);
});

test("rateLimit blocks after max requests in a window", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  let status = 200;
  const res = {
    setHeader() {},
    status(s: number) { status = s; return this; },
    json() {},
  };
  let passed = 0;
  for (let i = 0; i < 4; i++) limiter({ ip: "1.1.1.1" } as never, res as never, () => { passed++; });
  assert.equal(passed, 2);
  assert.equal(status, 429);
});
