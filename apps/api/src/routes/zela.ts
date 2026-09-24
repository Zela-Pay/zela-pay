import { Router } from "express";
import { query } from "../db/postgres.js";
import { env } from "../config/env.js";
import { ARC_CHAIN_ID, type ArcNetwork } from "@zela-checkout/shared";
import { rateLimit } from "../middleware/rateLimit.js";

export const zelaRouter = Router();

/**
 * GET /v1/zela/deep-link/:sessionId
 *
 * Builds the "Pay with Zela" deep link for a session: opens the Zela app
 * directly to a pre-filled payment-confirmation screen (amount + deposit
 * address + session reference), so the payer only has to confirm with their
 * PIN — no manual address entry. The QR-code fallback (for desktop
 * checkout, scanned by the Zela mobile app) just encodes this same URL.
 *
 * Zela's wallet already has an EVM address (used for its existing
 * Ethereum/BNB Chain/HyperEVM support) — Arc is just another EVM chain ID
 * to that same address, no new key material needed on Zela's side.
 *
 * This is a SEPARATE path from the generic EIP-681 QR in paymentUri.ts —
 * that one is spec-generic for any wallet; this one is Zela-specific and
 * can carry richer context (e.g. skip the wallet's own send flow entirely).
 */
zelaRouter.get("/deep-link/:sessionId", rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const { rows } = await query<{
    id: string;
    deposit_address: string;
    amount_settlement: string;
    settlement_token: string;
    network: string;
  }>(
    `SELECT id, deposit_address, amount_settlement, settlement_token, network
     FROM checkout_sessions WHERE id = $1`,
    [req.params.sessionId],
  );

  const session = rows[0];
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  const params = new URLSearchParams({
    session: session.id,
    to: session.deposit_address,
    amount: session.amount_settlement,
    token: session.settlement_token,
    chainId: String(ARC_CHAIN_ID[session.network as ArcNetwork]),
  });

  res.json({ deepLink: `${env.ZELA_APP_SCHEME}?${params.toString()}` });
});
