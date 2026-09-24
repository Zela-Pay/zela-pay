import test from "node:test";
import assert from "node:assert/strict";

Object.assign(process.env, {
  SETTLEMENT_FEE_PAYER_SECRET_KEY: "0x" + "22".repeat(32),
  DATABASE_URL: "postgres://unused/unused",
  DEPOSIT_KEY_ENCRYPTION_KEY: "ef".repeat(32),
  CHECKOUT_WEB_ORIGIN: "http://localhost:4200",
  ALLOW_PRIVATE_WEBHOOK_URLS: "false",
});

const { isPrivateAddress, assertSafeWebhookUrl } = await import("../services/urlSafety.js");
const { hashPassword, verifyPassword } = await import("../services/passwords.js");
const { normalizeEvmAddress } = await import("../routes/auth.js");

test("isPrivateAddress flags internal ranges and allows public ones", () => {
  const internal = ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"];
  for (const ip of internal) assert.equal(isPrivateAddress(ip), true, ip);
  const external = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "31.97.58.198", "2606:4700:4700::1111"];
  for (const ip of external) assert.equal(isPrivateAddress(ip), false, ip);
});

test("assertSafeWebhookUrl rejects non-https, credentials and internal targets", async () => {
  const bad = [
    "http://example.com/h",
    "https://user:pw@example.com/h",
    "https://127.0.0.1/h",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/h",
    "https://localhost/h",
    "ftp://example.com",
    "nonsense",
  ];
  for (const u of bad) await assert.rejects(assertSafeWebhookUrl(u), Error, u);
  await assert.doesNotReject(assertSafeWebhookUrl("https://1.1.1.1/hook"));
});

test("password hashing verifies only the right password", () => {
  const h = hashPassword("correct horse battery");
  assert.equal(verifyPassword("correct horse battery", h), true);
  assert.equal(verifyPassword("wrong", h), false);
  assert.equal(verifyPassword("anything", null), false);
  assert.equal(verifyPassword("anything", "garbage"), false);
  assert.notEqual(hashPassword("x"), hashPassword("x"));
});

test("normalizeEvmAddress accepts valid addresses (any case) and rejects everything else", () => {
  assert.equal(normalizeEvmAddress("0x1111111111111111111111111111111111111111"), "0x1111111111111111111111111111111111111111");
  // Checksum-normalizes a lowercase address to its EIP-55 mixed-case form.
  assert.equal(
    normalizeEvmAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045"),
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  );
  assert.equal(normalizeEvmAddress("not-an-address"), null);
  assert.equal(normalizeEvmAddress("11111111111111111111111111111112"), null); // a Solana address
  assert.equal(normalizeEvmAddress("0x123"), null); // too short
  assert.equal(normalizeEvmAddress(null), null);
  assert.equal(normalizeEvmAddress(42), null);
});
