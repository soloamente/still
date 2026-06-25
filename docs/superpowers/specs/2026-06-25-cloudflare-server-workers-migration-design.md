# Phase 1 — cue-server (Elysia) → Cloudflare Workers

**Status:** Design / approved direction, pending spec review
**Date:** 2026-06-25
**Author:** brainstorming session

## Context & motivation

The product runs on Vercel (web + server), Upstash (Redis), and Neon (Postgres).
Vercel usage is trending over the included Pro credit ($17.64 of $20 with 15 days
left in the cycle), so the driver here is **cost**. The agreed end state is "full
Cloudflare for compute + cache, Neon stays for Postgres" (~$24/mo), reached in
three independently shippable phases:

1. **Phase 1 (this spec): server → Cloudflare Workers.** Keystone — it unlocks
   KV/DO/Hyperdrive on the $5 Workers Paid plan already paid for realtime.
2. Phase 2: kill Upstash (cache → KV, rate-limit → DO, delete dead SSE/Redis path).
3. Phase 3: web (Next.js 16) → Workers via OpenNext (`@opennextjs/cloudflare`).

Realtime already moved to a Cloudflare Worker + Durable Object in a prior change
and is live on prod (`ws` transport). **D1 is explicitly rejected**: the schema is
deeply Postgres-specific (jsonb/arrays/tsvector across 34 files); Neon→D1 is a
full SQLite rewrite, not a migration.

## Goal

Run the existing Elysia app on a Workers `fetch` entry point, with Neon reached
through **Hyperdrive**, and remove the two Node-bound request-path dependencies.
After Phase 1: `cue-server` is served by a Worker at `api.sense.fans`; the web app
and the realtime worker point at that origin; the Vercel server project is retired.

## Non-goals (later phases / out of scope)

- Upstash removal — the server keeps calling Upstash over REST in Phase 1 (works
  from Workers). KV/DO migration is Phase 2.
- Web app migration — Phase 3.
- Any database engine change — Neon Postgres stays; only the *driver* changes.
- Schema changes beyond what palette backfill already uses.

## Current state — what is already Workers-compatible

- **Elysia** exposes a WinterCG `fetch` handler (`app.fetch`), so a Worker can
  delegate directly.
- **Better Auth, Resend, Polar, TMDb** are all HTTP/`fetch`-based and run under
  `nodejs_compat`.
- Only **two** non-test `node:` imports exist in the server:
  - `node:crypto` `timingSafeEqual` in `apps/server/src/routes/realtime-connect.ts`
  - `node:buffer` in `apps/server/src/lib/poster-palette.ts` (moves off-Worker)
- **113 files import from `@still/db`**, but they consume the `db` *singleton*.
  Keeping `db` as a lazy proxy inside the package means **none of those 113 files
  change** — only the package internals and one `createDb()` call in auth.

## Design

### 1. Database: neon-http → postgres-js over Hyperdrive

Today `packages/db/src/index.ts` does:

```ts
const sql = neon(env.DATABASE_URL);            // HTTP, stateless, module-scope OK
export const db = drizzle(sql, { schema });    // eager singleton
```

Hyperdrive fronts the **TCP Postgres wire protocol**, not Neon's HTTP endpoint,
so the driver becomes `postgres-js` (drizzle `postgres-js` adapter) pointed at
`env.HYPERDRIVE.connectionString`. Two constraints follow:

- Workers cannot open sockets at module top level, so the client must be created
  **lazily on first use**, not eagerly at import.
- The connection string arrives per-request via the binding (`env`), not via
  `process.env` at module scope.

**Approach — lazy proxy + connection-string setter (keeps all 113 call sites):**

```ts
let _db: Database | null = null;
let _connString: string | undefined;

/** Called once per request from the Worker entry before app.fetch. Idempotent. */
export function setDbConnectionString(s: string) { _connString = s; }

function init(): Database {
  if (_db) return _db;
  const client = postgres(_connString ?? env.DATABASE_URL, {
    max: 5, prepare: false, fetch_types: false, // Hyperdrive-friendly
  });
  _db = drizzle(client, { schema });
  return _db;
}

// Lazy proxy: `db.select(...)`, `db.execute(...)`, `db.query.*` all forward to
// the real instance created on first property access.
export const db: Database = new Proxy({} as Database, {
  get: (_t, prop) => Reflect.get(init() as object, prop),
});
```

The Worker isolate persists `_db` across requests, so the pool is reused.
Hyperdrive provides pooling + optional edge query caching (the latter also trims
Neon data-transfer, a known cost gotcha for this project).

**Auth shares the same `db`.** `packages/auth/src/index.ts:62` currently calls
`createDb()` eagerly (would init with no connection string). Change it to import
and pass the shared lazy `db` from `@still/db` into `drizzleAdapter`.

**Fallback path:** when `setDbConnectionString` is never called (local Node dev,
backfill job, tests), `init()` falls back to `env.DATABASE_URL` so non-Worker
runtimes keep working unchanged. Local dev may stay on neon-http or use the
direct Neon connection string via postgres-js — decided at implementation time;
either keeps the lazy-proxy shape.

### 2. Worker entry + Wrangler config

New `apps/server/src/worker.ts`:

```ts
import { app } from "./server/app";
export interface Env { HYPERDRIVE: Hyperdrive; ASSETS: R2Bucket; /* + vars/secrets */ }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    setDbConnectionString(env.HYPERDRIVE.connectionString);
    return app.fetch(request);
  },
};
```

`apps/server/wrangler.jsonc`:
- `main: src/worker.ts`, `compatibility_date` ≥ `2024-09-23`,
  `compatibility_flags: ["nodejs_compat"]`
- `hyperdrive` binding → Neon connection
- `r2_buckets` binding (`ASSETS`) for blob storage
- `vars` for non-secret config; `wrangler secret put` for
  `BETTER_AUTH_SECRET`, `DATABASE_URL` (fallback), `REALTIME_JWT_SECRET`,
  `REALTIME_INTERNAL_SECRET`, `RESEND_API_KEY`, `POLAR_ACCESS_TOKEN`, `TMDB_API_KEY`,
  `UPSTASH_REDIS_REST_URL`/`TOKEN` (still used in Phase 1), etc.
- Route: `api.sense.fans/*`

**Env access:** the codebase reads `@still/env/server` (t3-env over `process.env`)
at module scope. Under `nodejs_compat`, Workers populate `process.env` from
`vars` + secrets, so the existing env module keeps working for **string** config.
Only **bindings** (Hyperdrive, R2) are accessed via the `env` argument and threaded
explicitly (DB via `setDbConnectionString`; R2 via the blob module — see §4).
The `build:vercel` bundling step (`bun build … --target node`) is removed in favor
of Wrangler's build.

### 3. node:crypto → Web Crypto

`realtime-connect.ts` uses `timingSafeEqual` from `node:crypto`. Replace with the
constant-time string compare already implemented in the realtime worker
(`apps/realtime/src/auth.ts`), or a shared helper in `@still/realtime`. No behavior
change.

### 4. Vercel Blob → R2

In scope:
- `apps/server/src/lib/vercel-blob-image-put.ts` → R2 `put` via the `ASSETS` binding.
- `apps/server/src/lib/vercel-blob-audio-put.ts` → R2 `put`.
- Blob-reading image routes (profile avatar/banner, list covers) → stream from R2
  (`env.ASSETS.get(key)`), preserving the current `/api/profiles/**` and
  `/api/lists/**` URL shapes the web `next.config.ts` `remotePatterns` expect.
- The R2 bucket must be reachable from the blob module; thread the binding through
  Elysia context (or a request-scoped setter mirroring the DB approach).

Data migration: copy existing Vercel Blob objects to R2 (one-shot script: list
blobs, stream into R2 under the same keys) before cutover. Keys/paths stay stable
so existing DB-stored URLs keep resolving.

### 5. Poster palette → scheduled Node backfill

`movies.ts:285` currently `await syncMoviePosterPalette(...)` inline (runs
`node-vibrant`, a Node image decoder). Decision: **move off the request path**.

- Remove the inline call in `movies.ts`; the request path only reads the stored
  `movie.palette_*` columns. The UI already falls back to genre colors when null,
  so no visual regression for un-synced movies.
- Add a **scheduled Node job** (GitHub Action cron, or a tiny container) that runs
  `extractPosterPalette` against movies with null palette columns and backfills
  them. `node-vibrant` keeps running in Node — never on Workers.
- `poster-palette.ts` / `sync-movie-palette.ts` stay as-is but are imported only by
  the backfill job, not the Worker bundle.

### 6. Delete legacy `/ws/chat`

`apps/server/src/ws/` is an in-process, single-process WS pub-sub (its own comment:
"Single-process only… swap for Redis later"). It cannot run on Vercel serverless or
Workers, and chat realtime now flows through the Cloudflare DO. Remove `src/ws/`,
the `wsRoute` mount in `app.ts`, and any `broadcast()` callers (verify none are
load-bearing — chat events publish via `publishRealtimeEvent`).

### 7. Boot-time work

Workers have no persistent boot. `ensureMoviePaletteColumns` (called from
`local.ts` at startup) moves into the migration step (run on deploy / by the
backfill job), not per-request.

## Architecture (after Phase 1)

```
Browser ──► web (Vercel, Next 16)
   │            │  /api/* rewrite
   │            ▼
   │        api.sense.fans  ── Cloudflare Worker (Elysia app.fetch)
   │            │   ├─ Hyperdrive ──► Neon Postgres (fra1)
   │            │   ├─ R2 (ASSETS)  ──► avatars/banners/covers/audio
   │            │   └─ Upstash REST ──► cache + rate-limit (Phase 2 removes)
   ▼
realtime.* ── Cloudflare Worker + DO (already live)
                └─ calls api.sense.fans/api/realtime/authorize

Backfill (Node cron, off-platform) ── node-vibrant ──► movie.palette_* columns
```

## Migration & cutover

1. Land code changes behind the existing Vercel deploy (no traffic impact):
   DB lazy proxy + postgres-js, auth shares `db`, Web Crypto swap, R2 blob module,
   remove inline palette + legacy WS, Worker entry + `wrangler.jsonc`.
2. Provision Hyperdrive (→ Neon), R2 bucket, set Worker secrets/vars.
3. Migrate existing blobs to R2.
4. Deploy Worker to a `*.workers.dev` URL; smoke-test (`/`, `/api/health/db`,
   auth, a couple of read + write routes, realtime authorize).
5. Bind `api.sense.fans` to the Worker (DNS).
6. Flip web `NEXT_PUBLIC_SERVER_URL` / `API_REWRITE_ORIGIN` and the realtime
   worker `SERVER_ORIGIN` to `https://api.sense.fans`. Deploy.
7. Verify in prod; retire the Vercel server project.

## Rollback

Each step is reversible by pointing DNS / the web env var back at the Vercel
server origin (`cue-server-*.vercel.app`), which stays deployed until Phase 1 is
confirmed stable. Blob reads keep working off Vercel Blob until the R2 cutover
step; keep Vercel Blob until R2 is verified.

## Testing

- **Unit:** existing realtime/auth/lib `bun test` suites stay green. New: Web
  Crypto `timingSafeEqual` parity test; R2 blob put/get module test (mock binding).
- **DB:** lazy proxy must satisfy current `db.*` usage; run the server test suite
  against postgres-js (local Postgres or Neon direct string) to catch dialect gaps
  between neon-http and postgres-js.
- **Smoke (staging Worker):** `/api/health/db`, auth sign-in/session, an image
  upload (R2 round-trip), a movie detail (palette-from-column + genre fallback),
  realtime `/authorize`.
- **Cutover gate:** prod smoke on `api.sense.fans` before retiring Vercel server.

## Risks

| Risk | Mitigation |
|---|---|
| postgres-js vs neon-http dialect/behavior gaps | Run full server test suite on postgres-js before cutover; both target Postgres. |
| `process.env` not populated for some config under `nodejs_compat` | Verify each `@still/env/server` key resolves on Workers; thread via binding if any gap. |
| Better Auth edge compatibility (email render, crypto) | Smoke auth flows on staging Worker; React Email render is pure JS under nodejs_compat. |
| R2 URL-shape mismatch breaks web `<Image>` remotePatterns | Preserve `/api/profiles/**` + `/api/lists/**` paths; migrate keys 1:1. |
| Hyperdrive caching returns stale rows on writes | Configure caching off for dynamic queries / use Hyperdrive's caching controls. |
| Backfill lag → movies show genre fallback briefly | Acceptable; run backfill before/after cutover; fallback already shipped. |

## Open questions

- Local dev DB driver: keep neon-http for `bun dev`, or run postgres-js against a
  direct Neon string? (Lazy proxy supports either; decide in the plan.)
- Backfill job host: GitHub Action cron vs a tiny always-on container. (Cron is
  cheaper/simpler; container only if backfill volume grows.)
