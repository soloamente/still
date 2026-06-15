/**
 * Seeds launch Journal articles without `psql` (Windows-friendly).
 * Uses the same `pg` driver as `migrate.ts` — needs a direct DATABASE_URL.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, "../../../apps/server/.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error(
		"seed-journal: DATABASE_URL is not set (check apps/server/.env).",
	);
	process.exit(1);
}

const sqlPath = join(__dirname, "seeds/journal-posts.sql");
const sql = readFileSync(sqlPath, "utf8");

const pool = new Pool({ connectionString: databaseUrl });

try {
	console.log("Seeding journal posts from", sqlPath);
	await pool.query(sql);
	console.log(
		"Journal seed finished (skipped rows already present via ON CONFLICT).",
	);
} catch (error) {
	console.error("seed-journal failed:", error);
	process.exitCode = 1;
} finally {
	await pool.end();
}
