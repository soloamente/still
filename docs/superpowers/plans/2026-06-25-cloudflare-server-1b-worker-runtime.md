# Phase 1B — Worker Runtime Bring-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/server` (the Elysia app) build and run on the Cloudflare Workers runtime — a `fetch` entry that wires Hyperdrive into the lazy `db` (from Plan 1A), with the two Node-only request-path dependencies removed and the Elysia WebSocket route excluded from the Workers bundle.

**Architecture:** A thin `worker.ts` calls `setDbConnectionString(env.HYPERDRIVE.connectionString)` then delegates to `app.fetch`. `node:crypto` is replaced with a Web Crypto constant-time compare shared from `@still/realtime`. The legacy in-process `/ws/chat` route (Elysia `.ws`, used only by local-dev SSE chat) is mounted in the Bun `local.ts` entry instead of in the shared `app`, so the Workers bundle never imports it. Poster-palette extraction (`node-vibrant`) leaves the request path and becomes a standalone Node backfill script. Hyperdrive provisioning, secrets, custom domain, and the production deploy/cutover are **Plan 1D** — 1B ends at a local `wrangler deploy --dry-run` bundle build (no Cloudflare auth required).

**Tech Stack:** Cloudflare Workers (`wrangler`, `nodejs_compat`), Elysia 1.4, Hyperdrive, Web Crypto, Bun test.

---

## Why this ships safely

None of these changes alter Vercel/Bun behavior:
- The constant-time compare is byte-for-byte equivalent to `node:crypto.timingSafeEqual` for the secret check.
- `wsRoute` still mounts in `local.ts`, so local-dev SSE chat (`/ws/chat`) is unchanged. Prod already uses the `ws` transport (CF realtime Worker), not `/ws/chat`.
- Removing the inline palette call only defers palette population to the backfill job; the UI already falls back to genre colors when palette columns are null.
- `worker.ts` + `wrangler.jsonc` are additive — nothing references them until Plan 1D deploys.

## File Structure

- **Create** `packages/realtime/src/constant-time.ts` — Web Crypto constant-time string compare.
- **Create** `packages/realtime/src/constant-time.test.ts` — tests.
- **Modify** `packages/realtime/src/index.ts` — export the new helper.
- **Modify** `apps/server/src/routes/realtime-connect.ts` — use the shared helper; drop `node:crypto`.
- **Modify** `apps/server/src/server/app.ts` — remove the `wsRoute` import + mount.
- **Modify** `apps/server/src/local.ts` — mount `wsRoute` for the Bun dev process.
- **Modify** `apps/server/src/routes/movies.ts` — remove the inline `syncMoviePosterPalette` call + now-unused import.
- **Create** `apps/server/scripts/backfill-movie-palette.ts` — standalone Node palette backfill.
- **Modify** `apps/server/package.json` — add `palette:backfill` script + `wrangler`/`@cloudflare/workers-types` devDeps + `cf:dry-run` script.
- **Create** `apps/server/src/worker.ts` — Workers `fetch` entry.
- **Create** `apps/server/wrangler.jsonc` — Worker config.

---

### Task 1: Shared constant-time string compare (TDD)

**Files:**
- Create: `packages/realtime/src/constant-time.ts`
- Test: `packages/realtime/src/constant-time.test.ts`
- Modify: `packages/realtime/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/realtime/src/constant-time.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { constantTimeEqual } from "./constant-time";

describe("constantTimeEqual", () => {
	test("returns true for identical strings", () => {
		expect(constantTimeEqual("s3cret-token", "s3cret-token")).toBe(true);
	});

	test("returns false for different same-length strings", () => {
		expect(constantTimeEqual("aaaaaa", "aaaaab")).toBe(false);
	});

	test("returns false for different-length strings", () => {
		expect(constantTimeEqual("short", "longer-value")).toBe(false);
	});

	test("returns true for two empty strings", () => {
		expect(constantTimeEqual("", "")).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/realtime/src/constant-time.test.ts`
Expected: FAIL — `Cannot find module './constant-time'`

- [ ] **Step 3: Implement**

Create `packages/realtime/src/constant-time.ts`:

```ts
/**
 * Constant-time string comparison using Web Crypto-safe primitives (no
 * `node:crypto`). Runtime-agnostic: works on Bun, Node, and Cloudflare Workers.
 * Length differences short-circuit (lengths are not secret).
 */
export function constantTimeEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	const ab = enc.encode(a);
	const bb = enc.encode(b);
	if (ab.length !== bb.length) return false;
	let diff = 0;
	for (let i = 0; i < ab.length; i++) {
		diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
	}
	return diff === 0;
}
```

- [ ] **Step 4: Export it.** In `packages/realtime/src/index.ts`, add after the existing exports:

```ts
export * from "./constant-time";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/realtime/src/constant-time.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/realtime/src/constant-time.ts packages/realtime/src/constant-time.test.ts packages/realtime/src/index.ts
git commit -m "feat(realtime): add Web Crypto constant-time string compare"
```

---

### Task 2: Replace `node:crypto` in realtime-connect

**Files:**
- Modify: `apps/server/src/routes/realtime-connect.ts`

- [ ] **Step 1: Swap the import.** At the top of `apps/server/src/routes/realtime-connect.ts`, remove:

```ts
import { timingSafeEqual } from "node:crypto";
```

and add `constantTimeEqual` to the existing `@still/realtime` import. The current import is:

```ts
import {
	classifyRoom,
	parseChatRoomId,
	parseListRoomId,
	parseReviewRoomId,
} from "@still/realtime";
```

Change it to:

```ts
import {
	classifyRoom,
	constantTimeEqual,
	parseChatRoomId,
	parseListRoomId,
	parseReviewRoomId,
} from "@still/realtime";
```

- [ ] **Step 2: Rewrite `checkInternalSecret`.** Replace the whole function (currently lines ~18-30) with:

```ts
function checkInternalSecret(authHeader: string | null): boolean {
	if (!env.REALTIME_INTERNAL_SECRET) return false;
	if (!authHeader?.startsWith("Bearer ")) return false;
	const provided = authHeader.slice(7);
	return constantTimeEqual(provided, env.REALTIME_INTERNAL_SECRET);
}
```

This removes the only `node:crypto` and `Buffer` usage in the file.

- [ ] **Step 3: Verify no `node:`/`Buffer` left in the file**

Run: `grep -nE "node:crypto|timingSafeEqual|Buffer" apps/server/src/routes/realtime-connect.ts`
Expected: no output.

- [ ] **Step 4: Run the route's tests + typecheck**

Run: `bun test apps/server/src/routes/realtime-connect.test.ts` (if present) and `bun test apps/server/src/routes`
Expected: no new failures vs. baseline.
Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep realtime-connect`
Expected: no errors referencing `realtime-connect.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/realtime-connect.ts
git commit -m "refactor(server): use Web Crypto constant-time compare (drop node:crypto)"
```

---

### Task 3: Exclude `wsRoute` from the Workers app

**Files:**
- Modify: `apps/server/src/server/app.ts`
- Modify: `apps/server/src/local.ts`

Context: `wsRoute` is an Elysia `.ws` route that does not run on the Workers runtime. It is used only by local-dev SSE chat (`apps/web/.../chat-pane.tsx` connects to `/ws/chat`). Mounting it in `local.ts` (the Bun entry) instead of the shared `app` keeps local dev working while keeping the Workers bundle clean. No Eden `.subscribe` consumer depends on the ws route type (verified), so dropping it from `App` is safe. `ws/hub.ts`'s `broadcast()` stays imported by `chat.ts` — it is a harmless no-op on Workers (no in-process subscribers).

- [ ] **Step 1: Remove the import from `app.ts`.** Delete this line (currently line 39):

```ts
import { wsRoute } from "../ws";
```

- [ ] **Step 2: Remove the mount from `app.ts`.** In the `.use(...)` chain, delete the line (currently line 125):

```ts
	.use(wsRoute)
```

Leave the surrounding `.use(planFeaturesRoute)` and `.onError(...)` intact.

- [ ] **Step 3: Mount it in `local.ts`.** In `apps/server/src/local.ts`, add the import near the top (with the other local imports):

```ts
import { wsRoute } from "./ws";
```

and mount it on `app` immediately before `app.listen(3000, ...)`:

```ts
// Local-only: the Elysia WebSocket chat route runs on Bun, not Workers.
app.use(wsRoute);

app.listen(3000, () => {
```

- [ ] **Step 4: Verify the Workers-facing app no longer references ws.**

Run: `grep -n "wsRoute" apps/server/src/server/app.ts`
Expected: no output.
Run: `grep -n "wsRoute" apps/server/src/local.ts`
Expected: shows the import and the `app.use(wsRoute)`.

- [ ] **Step 5: Typecheck + smoke the local server boots**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -E "app\.ts|local\.ts|ws"`
Expected: no new errors for these files.
Run (boot smoke, optional but recommended): `timeout 12 bun run apps/server/src/local.ts 2>&1 | grep -i "listening" || true`
Expected: prints the "Server listening" line (then the timeout kills it). Skip if no local DATABASE_URL.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/server/app.ts apps/server/src/local.ts
git commit -m "refactor(server): mount ws chat route in local entry only (Workers-safe app)"
```

---

### Task 4: Move poster-palette off the request path + backfill script

**Files:**
- Modify: `apps/server/src/routes/movies.ts`
- Create: `apps/server/scripts/backfill-movie-palette.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Remove the inline call in `movies.ts`.** Delete this line (currently line 285):

```ts
	await syncMoviePosterPalette(detail.id, detail.poster_path);
```

- [ ] **Step 2: Remove the now-unused import in `movies.ts`.** Delete this line (currently line 46):

```ts
import { syncMoviePosterPalette } from "../lib/sync-movie-palette";
```

(`jobs/tmdb-sync.ts` keeps its own import — do not touch it. `sync-movie-palette.ts` stays.)

- [ ] **Step 3: Create the backfill script.** Create `apps/server/scripts/backfill-movie-palette.ts`:

```ts
import { db, movie } from "@still/db";
import { and, isNotNull, isNull } from "drizzle-orm";

import { syncMoviePosterPalette } from "../src/lib/sync-movie-palette";

/**
 * Backfill poster palettes for movies missing them. Runs in Node/Bun (uses
 * node-vibrant), NOT on Workers. Intended for a scheduled cron (e.g. GitHub
 * Action) now that the movie detail request path no longer extracts palettes.
 */
async function main(): Promise<void> {
	const rows = await db
		.select({ tmdbId: movie.tmdbId, posterPath: movie.posterPath })
		.from(movie)
		.where(and(isNull(movie.paletteAccent), isNotNull(movie.posterPath)));

	console.log(`[palette-backfill] ${rows.length} movies need a palette`);
	let done = 0;
	for (const row of rows) {
		await syncMoviePosterPalette(row.tmdbId, row.posterPath);
		done += 1;
		if (done % 50 === 0) {
			console.log(`[palette-backfill] ${done}/${rows.length}`);
		}
	}
	console.log(`[palette-backfill] complete — ${done} processed`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[palette-backfill] failed", err);
		process.exit(1);
	});
```

- [ ] **Step 4: Add the package script.** In `apps/server/package.json`, add to `scripts`:

```json
"palette:backfill": "bun run ./scripts/backfill-movie-palette.ts",
```

- [ ] **Step 5: Verify movies.ts no longer references the palette sync, and typecheck**

Run: `grep -n "syncMoviePosterPalette" apps/server/src/routes/movies.ts`
Expected: no output.
Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -E "movies\.ts|backfill-movie-palette"`
Expected: no errors for these files.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/movies.ts apps/server/scripts/backfill-movie-palette.ts apps/server/package.json
git commit -m "refactor(server): move poster-palette extraction to a backfill job"
```

---

### Task 5: Worker entry + wrangler config

**Files:**
- Create: `apps/server/src/worker.ts`
- Create: `apps/server/wrangler.jsonc`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Create the Worker entry.** Create `apps/server/src/worker.ts`:

```ts
import { setDbConnectionString } from "@still/db";

import { app } from "./server/app";

/**
 * Cloudflare Workers entry. Bindings (Hyperdrive, R2) arrive per-request via
 * `env`; string config arrives through `process.env` (populated by Wrangler
 * vars/secrets under `nodejs_compat`). We wire Hyperdrive into the lazy `db`
 * singleton, then hand the request to the Elysia app.
 */
export interface Env {
	HYPERDRIVE?: { connectionString: string };
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		setDbConnectionString(env.HYPERDRIVE?.connectionString);
		return app.fetch(request);
	},
};
```

Note: if the dry-run build (Task 6) reports `app.fetch` is not a function, use `app.handle(request)` instead — Elysia exposes both; `.handle` is the core request handler.

- [ ] **Step 2: Create `apps/server/wrangler.jsonc`:**

```jsonc
{
	"name": "cue-server",
	"main": "src/worker.ts",
	// process.env is populated from vars/secrets under nodejs_compat for
	// compatibility dates >= 2025-04-01.
	"compatibility_date": "2025-06-01",
	"compatibility_flags": ["nodejs_compat"],
	"hyperdrive": [
		{
			"binding": "HYPERDRIVE",
			// id is set in Plan 1D after `wrangler hyperdrive create`.
			"id": "REPLACE_IN_1D",
			// Used by `wrangler dev` only — point at Neon directly for local runs.
			"localConnectionString": "postgres://USER:PASS@HOST/DB?sslmode=require"
		}
	]
	// Secrets (set in Plan 1D via `wrangler secret put`):
	//   DATABASE_URL (neon-http fallback), BETTER_AUTH_SECRET, BETTER_AUTH_URL,
	//   CORS_ORIGIN, REALTIME_JWT_SECRET, REALTIME_INTERNAL_SECRET,
	//   RESEND_API_KEY, EMAIL_FROM, TMDB_API_KEY, POLAR_ACCESS_TOKEN,
	//   POLAR_SUCCESS_URL, BLOB_READ_WRITE_TOKEN (until 1C), UPSTASH_REDIS_REST_URL,
	//   UPSTASH_REDIS_REST_TOKEN.
	// Custom domain route (api.sense.fans) is bound in Plan 1D.
}
```

- [ ] **Step 3: Add wrangler tooling + scripts.** In `apps/server/package.json`:
  - Add to `devDependencies`: `"@cloudflare/workers-types": "^4.20250617.0"` and `"wrangler": "^4.40.0"`.
  - Add to `scripts`: `"cf:dry-run": "wrangler deploy --dry-run --outdir .wrangler-dryrun"` and `"cf:dev": "wrangler dev"`.

- [ ] **Step 4: Install**

Run: `bun install`
Expected: exit 0; `wrangler` resolves in the workspace.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/worker.ts apps/server/wrangler.jsonc apps/server/package.json bun.lock
git commit -m "feat(server): add Cloudflare Workers entry + wrangler config"
```

---

### Task 6: Verification — bundle for Workers + no regressions

**Files:** none (verification only). Add `.wrangler-dryrun/` to `.gitignore` if it appears.

- [ ] **Step 1: Build the Workers bundle (the core check).**

Run: `cd apps/server && bun run cf:dry-run; cd ../..`
Expected: wrangler builds the bundle and prints "Total Upload" / "Dry run". No fatal bundling errors. If it fails on a specific dependency (e.g. `@vercel/blob`), record the dependency and report — it may need Plan 1C (R2) to land first. Resolve `app.fetch` vs `app.handle` here if needed (Task 5 Step 1 note).

- [ ] **Step 2: Realtime package tests** (constant-time helper):

Run: `bun test packages/realtime/src`
Expected: PASS (existing + 4 new constant-time tests).

- [ ] **Step 3: Full server suite — no new failures.**

Run: `bun test apps/server/src`
Expected: the same baseline pass/fail set as before this plan (known baseline failures unchanged; **no new** failures from the ws move, palette removal, or crypto swap).

- [ ] **Step 4: Server typecheck.**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
Expected: no new errors vs. baseline (pre-existing `pg`/`index.mjs` baseline errors may remain; nothing new in `worker.ts`, `app.ts`, `local.ts`, `movies.ts`, `realtime-connect.ts`).

- [ ] **Step 5: Gitignore the dry-run artifact (if created).**

If `.wrangler-dryrun/` exists, add it to the root `.gitignore`, then:
```bash
git add .gitignore
git commit -m "chore: gitignore wrangler dry-run output"
```

---

## Self-Review

- **Spec coverage:** Implements spec §2 (Worker entry + wrangler), §3 (`node:crypto`→Web Crypto), §5 (palette off request path + backfill), and §6 (legacy ws) — refined from "delete /ws" to "exclude from the Workers app, keep for local dev," because `chat-pane.tsx` still uses `/ws/chat` in SSE mode. §4 (Blob→R2) is intentionally deferred to Plan 1C; §7 (boot-time `ensureMoviePaletteColumns`) stays in `local.ts` (Bun) and is handled in Plan 1D's deploy/migrate step.
- **Placeholder scan:** the only intentional placeholders are `wrangler.jsonc`'s `id: "REPLACE_IN_1D"` and `localConnectionString` — both are resolved in Plan 1D (provisioning) and explicitly labeled.
- **Type consistency:** `constantTimeEqual` is defined (Task 1) before use (Task 2). `setDbConnectionString` (Plan 1A) is consumed by `worker.ts` (Task 5). `Env.HYPERDRIVE.connectionString` matches the Plan 1A setter signature (`string | undefined`).
- **Risk carried to verification:** `process.env` population under `nodejs_compat` is asserted via the compat date; the dry-run validates *bundling* but not *runtime env* — a `wrangler dev` smoke (Task 5 `cf:dev`, run manually with a real `localConnectionString`) is the way to confirm env loads before Plan 1D deploys.

## Next plan

- **1C — Blob → R2:** R2 binding + module, rewrite put/get in `profiles.ts`/`lists.ts`/`reviews.ts`, copy existing Vercel Blob objects to R2, migrate stored URLs in the DB. (Do this before 1D if the Task 6 dry-run shows `@vercel/blob` does not bundle cleanly for workerd.)
- **1D — Cutover:** `wrangler hyperdrive create` (fill the binding id), `wrangler secret put` for all listed secrets, bind `api.sense.fans`, deploy, flip web `NEXT_PUBLIC_SERVER_URL`/`API_REWRITE_ORIGIN` + realtime `SERVER_ORIGIN`, run `ensureMoviePaletteColumns`/migrations, prod smoke, retire the Vercel server.
