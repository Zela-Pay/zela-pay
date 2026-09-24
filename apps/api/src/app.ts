import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { sessionsRouter } from "./routes/sessions.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { zelaRouter } from "./routes/zela.js";
import { paymentLinksRouter } from "./routes/paymentLinks.js";

export const app = express();
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

// A pure JSON API (no HTML views), so contentSecurityPolicy — meant to
// constrain what a rendered page can load — has nothing to apply to here;
// that belongs to apps/web instead (see its next.config.js). CORP set to
// cross-origin rather than helmet's same-origin default: same-origin would
// have browsers block POST /v1/sessions/public's response from being read
// by the arbitrary merchant sites it's specifically meant to serve (see
// that route's own CORS comment) — helmet doesn't know that route is a
// deliberate exception, so this is scoped for the whole app rather than
// fighting it per-route.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Every route here is scoped to CHECKOUT_WEB_ORIGIN alone, applied
 * per-router rather than as one blanket app.use() — the one exception,
 * POST /v1/sessions/public, needs its own permissive cors() (see that
 * route's own comment) and sits inside sessionsRouter alongside routes
 * that DO need the restriction. Applying this restrictive instance as
 * router-level middleware on sessionsRouter would run for every route in
 * it including /public, and cors() short-circuits preflight (OPTIONS)
 * requests directly — so the restrictive middleware would reject a
 * merchant site's preflight before /public's own override ever got a
 * chance to run. Passing it as middleware scoped to sessionsRouter's other
 * paths keeps /public the only route without it.
 */
const restrictedCors = cors({ origin: env.CHECKOUT_WEB_ORIGIN });

app.use("/v1/sessions", sessionsRouter);
app.use("/v1/auth", restrictedCors, authRouter);
app.use("/v1/dashboard", restrictedCors, dashboardRouter);
app.use("/v1/webhooks", restrictedCors, webhooksRouter);
app.use("/v1/zela", restrictedCors, zelaRouter);
app.use("/v1/payment-links", restrictedCors, paymentLinksRouter);
