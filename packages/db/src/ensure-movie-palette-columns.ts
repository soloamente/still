import { type SQL, sql } from "drizzle-orm";

/**
 * Adds poster-derived palette columns when they are missing (e.g. deploy ran before
 * `db:migrate`, or a Neon branch never received migration 0001). Uses Postgres
 * `IF NOT EXISTS` so this is safe to call on every server boot.
 */
export async function ensureMoviePaletteColumns(db: {
  execute: (query: SQL) => Promise<unknown>;
}): Promise<void> {
  const alters = [
    `ALTER TABLE "movie" ADD COLUMN IF NOT EXISTS "palette_accent" text`,
    `ALTER TABLE "movie" ADD COLUMN IF NOT EXISTS "palette_muted" text`,
    `ALTER TABLE "movie" ADD COLUMN IF NOT EXISTS "palette_foreground" text`,
  ];
  for (const rawSql of alters) {
    await db.execute(sql.raw(rawSql));
  }
}
