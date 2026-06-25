import { neon } from "@neondatabase/serverless";
import { env } from "@still/env/server";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { resolveDbDriver } from "./driver";
import * as schema from "./schema";

export type Schema = typeof schema;

// All call sites consume this type; both drivers expose the same drizzle query
// surface, so we type on neon-http and cast the postgres-js instance to match.
export type Database = ReturnType<typeof drizzleHttp<Schema>>;

let _hyperdriveConnString: string | undefined;
let _db: Database | null = null;
let _driverName: "neon-http" | "postgres-js" | null = null;

/**
 * Called once per request from the Workers entry, before `app.fetch`. Idempotent.
 * Passing `undefined` (Node/Vercel/local/tests) keeps the neon-http fallback.
 */
export function setDbConnectionString(connString: string | undefined): void {
	_hyperdriveConnString = connString;
}

/** Build the real drizzle instance for the resolved driver. Connections are lazy. */
function init(): Database {
	if (_db) return _db;
	const choice = resolveDbDriver({
		hyperdriveConnString: _hyperdriveConnString,
		databaseUrl: env.DATABASE_URL,
	});
	_driverName = choice.driver;
	if (choice.driver === "postgres-js") {
		const client = postgres(choice.connectionString, {
			max: 5,
			prepare: false,
			fetch_types: false,
		});
		_db = drizzlePg(client, { schema }) as unknown as Database;
	} else {
		_db = drizzleHttp(neon(choice.connectionString), { schema });
	}
	return _db;
}

/**
 * Lazy proxy — the real client is created on first property access. Keeps the
 * `import { db } from "@still/db"` singleton API stable across 113 call sites.
 */
export const db: Database = new Proxy({} as Database, {
	get: (_target, prop) => Reflect.get(init() as object, prop),
});

/** Build a standalone client (tests, Node backfill, auth bootstrap fallback). */
export function createDb(): Database {
	const choice = resolveDbDriver({
		hyperdriveConnString: _hyperdriveConnString,
		databaseUrl: env.DATABASE_URL,
	});
	if (choice.driver === "postgres-js") {
		const client = postgres(choice.connectionString, {
			max: 5,
			prepare: false,
			fetch_types: false,
		});
		return drizzlePg(client, { schema }) as unknown as Database;
	}
	return drizzleHttp(neon(choice.connectionString), { schema });
}

/** Test-only: the driver chosen at the last `init()`. */
export function currentDbDriverName(): "neon-http" | "postgres-js" | null {
	return _driverName;
}

/** Test-only: drop the memoized client so the next access re-inits. */
export function resetDbForTests(): void {
	_db = null;
	_driverName = null;
}

export { ensureMoviePaletteColumns } from "./ensure-movie-palette-columns";

// Re-export the schema so consumers can do `import { user, log } from "@still/db"`.
export * from "./schema";
export * from "./tv-log-scope";
export { schema };
