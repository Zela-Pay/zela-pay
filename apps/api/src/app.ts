import express from "express";
// Patches Express's router so a rejected Promise from an `async` route
// handler reaches the error-handling middleware below, the same as a
// synchronous throw already does. Without this (Express 4 has no built-in
// support for it), an unhandled async rejection anywhere in a route just
// leaves the request hanging with no response at all until the client's
// own timeout — confirmed the hard way when a test hit exactly this and
// hung for minutes instead of getting a 500. Must be imported after
// `express` and before any router is defined.
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { sessionsRouter } from "./routes/sessions.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { zelaRouter } from "./routes/zela.js";
import { paymentLinksRouter } from "./routes/paymentLinks.js";
import { payoutsRouter } from "./routes/payouts.js";
import { miniAppsRouter } from "./routes/miniApps.js";

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
// Server-to-server only (a Mini App's own backend, secret-key auth) —
// never called from a browser, but restrictedCors costs nothing and adds
// defense-in-depth against the secret key ever being used from one.
app.use("/v1/payouts", restrictedCors, payoutsRouter);
// Public, unauthenticated, meant to be fetched broadly (the Zela app's own
// Mini Apps directory tab) — no CORS restriction needed.
app.use("/v1/mini-apps", miniAppsRouter);

/**
 * Last-resort catch-all — every route above is expected to send its own
 * response, this only fires for a genuinely unhandled error (a thrown
 * exception, or, thanks to express-async-errors above, a rejected Promise
 * from an async handler). Always logs the real error server-side; the
 * client only ever gets a generic message, never a stack trace or a raw
 * DB/driver error string.
 */
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[app] unhandled error on ${req.method} ${req.path}:`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
});
