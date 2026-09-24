import crypto from "node:crypto";

const KEYLEN = 64;
// Verified against when the account doesn't exist, so timing doesn't reveal which emails are registered.
const DUMMY_SALT = Buffer.alloc(16, 1);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) {
    crypto.scryptSync(password, DUMMY_SALT, KEYLEN);
    return false;
  }
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), KEYLEN);
  return expected.length === KEYLEN && crypto.timingSafeEqual(actual, expected);
}
