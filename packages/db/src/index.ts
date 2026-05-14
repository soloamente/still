import { neon } from "@neondatabase/serverless";
import { env } from "@still/env/server";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type Schema = typeof schema;

export function createDb() {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;

export const db = createDb();

export { ensureMoviePaletteColumns } from "./ensure-movie-palette-columns";

// Re-export the schema so consumers can do `import { user, log } from "@still/db"`.
export * from "./schema";
export { schema };
