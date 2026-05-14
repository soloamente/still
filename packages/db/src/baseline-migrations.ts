/**
 * Records each migration’s SHA-256 hash in `drizzle.__drizzle_migrations` (same algorithm as
 * Drizzle’s migrator) so `db:migrate` skips SQL that already exists — typical after
 * `drizzle-kit push` or manual setup. Does **not** verify schema; only use when the DB matches
 * the migration files. Requires `--yes` to avoid accidental baselining of empty databases.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, "../../../apps/server/.env") });

const confirmed =
  process.argv.includes("--yes") || process.env.BASELINE_MIGRATIONS === "1";

if (!confirmed) {
  console.error(
    "baseline: refuses without confirmation (marks migrations as applied without running SQL).",
  );
  console.error("        From repo root: bun run db:baseline -- --yes");
  console.error("        Or env:        BASELINE_MIGRATIONS=1 bun run db:baseline");
  console.error("        (If you use turbo directly: turbo -F @still/db db:baseline -- --yes)");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("baseline: DATABASE_URL is not set (check apps/server/.env).");
  process.exit(1);
}

const migrationsFolder = join(__dirname, "migrations");
const journalPath = join(migrationsFolder, "meta/_journal.json");

interface Journal {
  entries: { tag: string; when: number; breakpoints: boolean }[];
}

const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  // Mirror Drizzle’s migrator table shape (`pg-core/dialect`).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  for (const entry of journal.entries) {
    const sqlPath = join(migrationsFolder, `${entry.tag}.sql`);
    const body = fs.readFileSync(sqlPath, "utf8");
    const hash = crypto.createHash("sha256").update(body).digest("hex");

    const result = await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
       SELECT $1::text, $2::bigint
       WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations m WHERE m.hash = $1)`,
      [hash, entry.when],
    );

    if (result.rowCount === 1) {
      console.log(`baseline: recorded ${entry.tag}`);
    } else {
      console.log(`baseline: skipped ${entry.tag} (hash already in journal table)`);
    }
  }

  console.log("baseline: done. Run `bun run db:migrate` to apply any newer migrations.");
} finally {
  await pool.end();
}
