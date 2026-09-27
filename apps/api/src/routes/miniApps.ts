/**
 * Public, unauthenticated Mini App directory — the Zela app's own Mini
 * Apps tab fetches this to render its list. Only merchants that have
 * turned is_mini_app on (see routes/dashboard.ts's PATCH /mini-app) and
 * have a launch URL show up.
 */

import { Router } from "express";
import { query } from "../db/postgres.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const miniAppsRouter = Router();

miniAppsRouter.get("/", rateLimit({ windowMs: 60_000, max: 60 }), async (_req, res) => {
  const { rows } = await query<{
    id: string;
    name: string;
    mini_app_url: string;
    mini_app_icon_url: string | null;
    mini_app_tagline: string | null;
  }>(
    `SELECT id, name, mini_app_url, mini_app_icon_url, mini_app_tagline
     FROM merchants
     WHERE is_mini_app = true AND mini_app_url IS NOT NULL
     ORDER BY name ASC`,
  );
  res.json({
    miniApps: rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.mini_app_url,
      iconUrl: r.mini_app_icon_url,
      tagline: r.mini_app_tagline,
    })),
  });
});
