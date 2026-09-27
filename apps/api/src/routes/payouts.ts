/**
 * Mini App payouts — always non-custodial (see services/payoutResolve.ts's
 * own header for the full flow). zela-checkout never holds or signs
 * anything here; it only resolves recipients and verifies+records
 * transfers the Mini App's own backend already sent.
 *
 * There's no sandbox/testnet concept for payouts the way there is for
 * Checkout — a payout always targets a real Zela user's real Arc mainnet
 * wallet, so sandbox (is_test) keys are rejected outright rather than
 * pretending a "test payout" is a meaningful, safe thing to run.
 */

import { Router } from "express";
import { nanoid } from "nanoid";
import { isAddress } from "viem";
import { query } from "../db/postgres.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireSecretKey, type AuthedRequest } from "../middleware/apiKeyAuth.js";
import { resolvePayoutRecipient } from "../services/payoutResolve.js";
import { verifyPayoutOnChain } from "../services/payoutVerify.js";
import { toPayout, type PayoutRow } from "../services/payoutStore.js";
import { enqueuePayoutWebhook } from "../services/webhookDelivery.js";

export const payoutsRouter = Router();

payoutsRouter.use(requireSecretKey);
payoutsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

payoutsRouter.use((req: AuthedRequest, res, next) => {
  if (req.isTest) {
    res.status(400).json({ error: "Payouts don't support sandbox keys — use a production secret key. A payout always sends real funds on Arc mainnet." });
    return;
  }
  next();
});

payoutsRouter.post("/resolve", async (req, res) => {
  const { to } = (req.body ?? {}) as { to?: unknown };
  if (typeof to !== "string" || !to.trim()) {
    res.status(400).json({ error: "to is required — a Zela ID, email, or merchant ID." });
    return;
  }

  const result = await resolvePayoutRecipient(to);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ walletAddress: result.walletAddress, network: result.network, displayName: result.displayName });
});

payoutsRouter.post("/", async (req: AuthedRequest, res) => {
  const { toIdentifier, txHash, amount } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof toIdentifier !== "string" || !toIdentifier.trim()) {
    res.status(400).json({ error: "toIdentifier is required (whatever you passed to /resolve)." });
    return;
  }
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    res.status(400).json({ error: "txHash must be a 32-byte transaction hash." });
    return;
  }
  if (typeof amount !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(amount) || !(Number(amount) > 0)) {
    res.status(400).json({ error: "amount must be a positive decimal string." });
    return;
  }

  const resolved = await resolvePayoutRecipient(toIdentifier);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (!isAddress(resolved.walletAddress)) {
    res.status(500).json({ error: "Resolved recipient address is invalid." });
    return;
  }

  const verification = await verifyPayoutOnChain({
    network: resolved.network,
    txHash: txHash as `0x${string}`,
    toWallet: resolved.walletAddress,
    amount,
  });

  const id = `pay_${nanoid(20)}`;
  const status = verification.ok ? "verified" : "failed";

  try {
    await query(
      `INSERT INTO payouts (id, merchant_id, network, to_identifier, to_wallet, amount, tx_hash, status, verify_error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, req.merchantId, resolved.network, toIdentifier, resolved.walletAddress, amount, txHash, status, verification.ok ? null : verification.error],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This transaction has already been reported." });
      return;
    }
    throw err;
  }

  if (!verification.ok) {
    res.status(422).json({ error: verification.error });
    return;
  }

  const { rows } = await query<PayoutRow & Record<string, unknown>>(`SELECT * FROM payouts WHERE id = $1`, [id]);
  const payout = toPayout(rows[0]!);
  await enqueuePayoutWebhook(payout);

  res.status(201).json({ payout });
});
