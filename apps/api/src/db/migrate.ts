import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./postgres.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/db/migrations");

/**
 * Applies every not-yet-applied .sql file in migrations/, in filename order,
 * tracked in a `_migrations` table. Each file runs in its own transaction
 * with its tracking row, so a failure partway through a file can't leave it
 * half-applied-but-marked-done (or applied-but-unmarked, which would just
 * re-run it next time and fail on a non-idempotent statement like 005's
 * RENAME COLUMN).
 */
export async function migrate(): Promise<string[]> {
  // Checkout tables live in their own schema (selected via search_path in DATABASE_URL) so they never mix with other apps sharing the server.
  await pool.query("CREATE SCHEMA IF NOT EXISTS zela_checkout");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );

  const { rows } = await pool.query<{ filename: string }>(`SELECT filename FROM _migrations`);
  const applied = new Set(rows.map((r) => r.filename));

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const newlyApplied: string[] = [];

  for (const f of files) {
    if (applied.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(path.join(dir, f), "utf8"));
      await client.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [f]);
      await client.query("COMMIT");
      newlyApplied.push(f);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate()
    .then((files) => {
      console.log(files.length ? `[migrate] applied ${files.join(", ")}` : "[migrate] nothing to apply, already up to date");
      return pool.end();
    })
    .catch((err) => {
      console.error("[migrate] failed:", err);
      process.exit(1);
    });
}
