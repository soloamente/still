/**
 * Applies Drizzle SQL migrations using the `pg` TCP driver.
 * Neon (and similar) pooled/serverless drivers often fail on `drizzle-kit migrate`;
 * use DATABASE_URL pointing at the **direct** Postgres host (port 5432, not `-pooler`).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve from `packages/db/src/` → repo `apps/server/.env` (matches `drizzle.config` which loads from `packages/db/`)
dotenv.config({ path: join(__dirname, "../../../apps/server/.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("migrate: DATABASE_URL is not set (check apps/server/.env).");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

const migrationsFolder = join(__dirname, "migrations");

try {
  console.log("Applying migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("Migrations finished successfully.");
} catch (error) {
  console.error("migrate failed:", error);

  // Postgres 42710 = duplicate_object — usually schema exists from `drizzle-kit push` while
  // `drizzle.__drizzle_migrations` is empty, so Drizzle tries to re-apply 0000 from scratch.
  let err: unknown = error;
  while (
    err != null &&
    typeof err === "object" &&
    "cause" in err &&
    (err as { cause?: unknown }).cause != null
  ) {
    err = (err as { cause: unknown }).cause;
  }
  const code =
    err != null &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : null;
  if (code === "42710") {
    console.error(`
Baselining hint: schema already exists but drizzle.__drizzle_migrations has no (or incomplete) rows
(common after drizzle-kit push). If the database matches the SQL files under packages/db/src/migrations, run:

  bun run db:baseline -- --yes
  # or: BASELINE_MIGRATIONS=1 bun run db:baseline
  # (turbo needs an extra -- : turbo -F @still/db db:baseline -- --yes)

Then run bun run db:migrate again. Or use a fresh database. Use Neon’s direct (non-pooler) DATABASE_URL for migrate.
`);
  }

  process.exitCode = 1;
} finally {
  await pool.end();
}
