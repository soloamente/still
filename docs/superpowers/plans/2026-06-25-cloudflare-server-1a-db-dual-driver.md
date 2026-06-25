# Phase 1A — DB Dual-Driver (neon-http + postgres-js/Hyperdrive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@still/db` select its driver at runtime — neon-http (HTTP, serverless-safe) on Node/Vercel, postgres-js over Hyperdrive on Cloudflare Workers — without changing any of the 113 files that import the `db` singleton.

**Architecture:** Replace the eager `export const db = drizzle(...)` with a lazy `Proxy` that initializes on first property access. A `setDbConnectionString()` setter (called once per request from the future Worker entry) flips the chosen driver to postgres-js; when unset, the proxy falls back to neon-http via `env.DATABASE_URL`, so Node, local dev, tests, and the current Vercel deploy are unchanged. Auth shares the same lazy singleton instead of building its own client.

**Tech Stack:** Drizzle ORM (`drizzle-orm/neon-http`, `drizzle-orm/postgres-js`), `@neondatabase/serverless`, `postgres` (postgres-js), Bun test.

---

## Why this ships on its own

This is a behavior-preserving refactor. On Node/Vercel/local/tests, `setDbConnectionString` is never called, so `init()` resolves to neon-http with `env.DATABASE_URL` — identical to today. The postgres-js branch only activates when a Hyperdrive connection string is set (Plan 1B's Worker entry). The full server `bun test` suite is the regression gate.

## File Structure

- **Create** `packages/db/src/driver.ts` — pure driver-resolution logic (no I/O), unit-tested.
- **Create** `packages/db/src/driver.test.ts` — tests for the resolver.
- **Create** `packages/db/src/index.test.ts` — tests for the lazy proxy + setter wiring.
- **Modify** `packages/db/package.json` — add `postgres` dependency.
- **Modify** `packages/db/src/index.ts` — lazy proxy, dual driver, `setDbConnectionString`, test helpers.
- **Modify** `packages/auth/src/index.ts:62` — use the shared `db` instead of `createDb()`.

`createDb()` stays exported (used by tests/backfill/Node), now implemented via the same resolver.

---

### Task 1: Add the postgres-js dependency

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add `postgres` to dependencies**

In `packages/db/package.json`, add to the `dependencies` object (keep alphabetical-ish ordering near the other db deps):

```json
"postgres": "^3.4.5",
```

- [ ] **Step 2: Install**

Run: `bun install`
Expected: lockfile updates, `postgres` resolves, exit 0.

- [ ] **Step 3: Verify the import resolves**

Run: `bun -e "import('postgres').then(m => console.log(typeof m.default))"`
Expected: prints `function`

- [ ] **Step 4: Commit**

```bash
git add packages/db/package.json bun.lock
git commit -m "chore(db): add postgres-js dependency for Hyperdrive driver"
```

---

### Task 2: Pure driver resolver (TDD)

**Files:**
- Create: `packages/db/src/driver.ts`
- Test: `packages/db/src/driver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/driver.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { resolveDbDriver } from "./driver";

describe("resolveDbDriver", () => {
	test("uses neon-http with DATABASE_URL when no Hyperdrive string", () => {
		const choice = resolveDbDriver({
			hyperdriveConnString: undefined,
			databaseUrl: "postgres://neon-http-url",
		});
		expect(choice).toEqual({
			driver: "neon-http",
			connectionString: "postgres://neon-http-url",
		});
	});

	test("uses postgres-js with the Hyperdrive string when present", () => {
		const choice = resolveDbDriver({
			hyperdriveConnString: "postgres://hyperdrive-pooled",
			databaseUrl: "postgres://neon-http-url",
		});
		expect(choice).toEqual({
			driver: "postgres-js",
			connectionString: "postgres://hyperdrive-pooled",
		});
	});

	test("treats an empty/whitespace Hyperdrive string as unset", () => {
		const choice = resolveDbDriver({
			hyperdriveConnString: "   ",
			databaseUrl: "postgres://neon-http-url",
		});
		expect(choice.driver).toBe("neon-http");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/db/src/driver.test.ts`
Expected: FAIL — `Cannot find module './driver'`

- [ ] **Step 3: Write the implementation**

Create `packages/db/src/driver.ts`:

```ts
export type DbDriverChoice = {
	driver: "neon-http" | "postgres-js";
	connectionString: string;
};

/**
 * Pick the DB driver at runtime. Hyperdrive (Workers) provides a pooled
 * Postgres wire-protocol connection string → postgres-js. Everywhere else
 * (Node, Vercel, local dev, tests) falls back to neon-http over `DATABASE_URL`,
 * which is stateless and serverless-safe.
 */
export function resolveDbDriver(opts: {
	hyperdriveConnString: string | undefined;
	databaseUrl: string;
}): DbDriverChoice {
	const hyperdrive = opts.hyperdriveConnString?.trim();
	if (hyperdrive) {
		return { driver: "postgres-js", connectionString: hyperdrive };
	}
	return { driver: "neon-http", connectionString: opts.databaseUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/db/src/driver.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/driver.ts packages/db/src/driver.test.ts
git commit -m "feat(db): add pure runtime driver resolver"
```

---

### Task 3: Lazy dual-driver `db` proxy + connection-string setter (TDD)

**Files:**
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/index.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";

import {
	currentDbDriverName,
	db,
	resetDbForTests,
	setDbConnectionString,
} from "./index";

afterEach(() => {
	setDbConnectionString(undefined);
	resetDbForTests();
});

describe("db lazy proxy", () => {
	test("exposes drizzle query methods without opening a connection", () => {
		// neon-http + postgres-js both connect lazily per-query, so touching a
		// method must not require the network.
		expect(typeof db.select).toBe("function");
		expect(typeof db.execute).toBe("function");
	});

	test("defaults to the neon-http driver", () => {
		// Force init by touching a property, then read the chosen driver.
		void db.select;
		expect(currentDbDriverName()).toBe("neon-http");
	});

	test("switches to postgres-js once a Hyperdrive string is set", () => {
		setDbConnectionString("postgres://hyperdrive-pooled/db");
		void db.select;
		expect(currentDbDriverName()).toBe("postgres-js");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/db/src/index.test.ts`
Expected: FAIL — `currentDbDriverName`/`resetDbForTests`/`setDbConnectionString` are not exported.

- [ ] **Step 3: Rewrite `packages/db/src/index.ts`**

Replace the entire file with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/db/src/index.test.ts`
Expected: PASS (3 tests). `DATABASE_URL` must be present in the test env (it already is for the existing db tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/index.ts packages/db/src/index.test.ts
git commit -m "feat(db): lazy dual-driver db proxy with Hyperdrive setter"
```

---

### Task 4: Auth shares the lazy `db`

**Files:**
- Modify: `packages/auth/src/index.ts:62`

- [ ] **Step 1: Change the import**

In `packages/auth/src/index.ts`, change the import on line 3 from:

```ts
import { createDb } from "@still/db";
```

to:

```ts
import { db } from "@still/db";
```

- [ ] **Step 2: Use the shared singleton**

Replace line 62 (`const db = createDb();`) — delete that local declaration so the `drizzleAdapter(...)` call below uses the imported shared `db`. (The adapter call already references a `db` variable; it now resolves to the import.)

- [ ] **Step 3: Typecheck the auth package**

Run: `./node_modules/.bin/tsc -p packages/auth/tsconfig.json --noEmit`
Expected: no new errors referencing `db` or `createDb` in `index.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "refactor(auth): use shared lazy db singleton"
```

---

### Task 5: Regression gate — full server suite + typecheck

**Files:** none (verification only)

- [ ] **Step 1: Run the db package tests**

Run: `bun test packages/db/src`
Expected: PASS (driver + index + existing db tests).

- [ ] **Step 2: Run the full server test suite**

Run: `bun test apps/server/src`
Expected: same pass/fail set as before this plan (the known baseline failures are unchanged; no *new* failures). If a test that previously passed now fails, the lazy proxy broke a `db.*` usage — investigate before continuing.

- [ ] **Step 3: Typecheck db package**

Run: `./node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit`
Expected: no new errors. (`as unknown as Database` casts are intentional; the postgres-js and neon-http query surfaces are runtime-compatible.)

- [ ] **Step 4: Commit (if any incidental fixes were needed)**

```bash
git add -A
git commit -m "test(db): verify dual-driver refactor passes server suite"
```

---

## Self-Review

- **Spec coverage:** Implements the spec's §1 "Database: neon-http → postgres-js over Hyperdrive" — lazy proxy, `setDbConnectionString`, auth sharing `db`, neon-http fallback for non-Worker runtimes. The actual Hyperdrive *binding* wiring lives in Plan 1B (Worker entry calls `setDbConnectionString(env.HYPERDRIVE.connectionString)`).
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `setDbConnectionString`, `currentDbDriverName`, `resetDbForTests`, `resolveDbDriver`, `DbDriverChoice`, `Database` are defined before use and named consistently across tasks.
- **Open item carried to 1B:** local dev DB driver (keep neon-http for `bun dev`) — satisfied automatically here, since `setDbConnectionString` is never called in `local.ts`.

## Next plans (Phase 1 remainder)

- **1B — Worker runtime bring-up:** `worker.ts` (calls `setDbConnectionString(env.HYPERDRIVE.connectionString)`), `wrangler.jsonc`, `node:crypto`→Web Crypto, delete `src/ws/`, remove inline palette call + standalone backfill script. Deploy to `*.workers.dev`, smoke test.
- **1C — Blob → R2:** R2 module, rewrite put/get in `profiles.ts`/`lists.ts`/`reviews.ts`, copy blobs to R2, migrate stored URLs in the DB.
- **1D — Cutover:** provision Hyperdrive/R2/secrets, bind `api.sense.fans`, flip web `NEXT_PUBLIC_SERVER_URL`/`API_REWRITE_ORIGIN` + realtime `SERVER_ORIGIN`, prod smoke, retire the Vercel server project.
