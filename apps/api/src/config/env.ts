import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // zela-app itself only supports Arc mainnet (no testnet Arc chain is
  // defined there) — anything meant to be recognizable/payable by a real
  // Zela app user only ever works on arc-mainnet, so that's the default.
  ARC_NETWORK: z.enum(["arc-mainnet", "arc-testnet"]).default("arc-mainnet"),
  // viem ships default public RPC endpoints for both networks — these only
  // override that default (better reliability/rate limits than a shared
  // public endpoint) when set.
  ARC_MAINNET_RPC_URL: z.string().url().optional().or(z.literal("")),
  ARC_TESTNET_RPC_URL: z.string().url().optional().or(z.literal("")),
  // USDC's ERC-20 contract on Arc — mainnet's is a verified constant (see
  // packages/shared/src/tokens.ts); no verified testnet address exists, so
  // it must be supplied here if you actually need testnet, never guessed.
  ARC_TESTNET_USDC_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),

  // EVM private key (0x-prefixed hex), funded with Arc-native USDC for gas.
  // Pays network fees for settlement sweeps and receives the platform fee.
  SETTLEMENT_FEE_PAYER_SECRET_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte private key"),

  DATABASE_URL: z.string().min(1),
  DEPOSIT_KEY_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "must be 32 bytes as 64 hex chars"),

  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(100),

  // Firebase Auth (Admin SDK) for merchant signup/login (email/password +
  // Google) — optional. Left unset, routes/auth.ts's Firebase path is
  // disabled and the plain-password path keeps working unchanged (see
  // services/firebaseAdmin.ts).
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  CHECKOUT_WEB_ORIGIN: z.string().url(),
  ALLOW_PRIVATE_WEBHOOK_URLS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  // Number of reverse proxies in front of the API (0 = none). Needed so per-IP rate limits see real client IPs.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  ZELA_APP_SCHEME: z.string().default("zela://pay"),
})
  .refine((v) => v.ARC_NETWORK !== "arc-testnet" || v.ARC_TESTNET_USDC_ADDRESS, {
    message: "ARC_TESTNET_USDC_ADDRESS is required when ARC_NETWORK=arc-testnet — no verified default exists",
    path: ["ARC_TESTNET_USDC_ADDRESS"],
  });

export const env = envSchema.parse(process.env);

export type Env = typeof env;
