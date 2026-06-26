# Phase 1D — Production Cutover Runbook

> **This is an operational runbook, not a code plan.** You run the `wrangler`/dashboard steps (they need your Cloudflare login + DNS); Claude prepares exact commands and verifies each gate. Steps use checkbox (`- [ ]`) syntax. Do them in order — each has a verification gate and a rollback.

**Goal:** Serve `cue-server` from a Cloudflare Worker at `api.sense.fans` (Neon via Hyperdrive, images on R2 `cue-assets`, audio on public R2 `cue-media`), migrate existing blobs, flip the web + realtime origins, and retire the Vercel server — with the ability to roll back via a single env/DNS flip at every stage.

**Nothing here changes code** — Phases 1A–1C-audio already landed all of it on `main`. This is provisioning + deploy + cutover.

---

## Step 0 — Prerequisites (verify BEFORE starting)

- [ ] **`wrangler` authenticated:** `cd apps/server && wrangler whoami` → shows your account (the same one running the realtime Worker). If not: `wrangler login`.
- [ ] **Workers Paid plan active** (already true — the realtime DO runs on it). Hyperdrive, R2, KV all ride this $5 plan.
- [ ] **DNS decision — the blocker to resolve first.** Cloudflare Worker *custom domains* (`api.sense.fans`) and R2 *custom domains* (`media.sense.fans`) require the **`sense.fans` zone to be managed in Cloudflare**.
  - If `sense.fans` is already a Cloudflare zone → proceed with custom domains (preferred).
  - If `sense.fans` DNS lives elsewhere (e.g. Vercel) → either (a) move the zone to Cloudflare, or (b) use the **fallback origins** noted at each step: `cue-server.<acct>.workers.dev` for the API and the R2 **public dev URL** for media (acceptable to start; r2.dev is rate-limited, so move media to a custom domain before heavy use).
  - **Confirm which path** before continuing — it changes Steps 2, 5, and 6.
- [ ] **Have these values ready** (you'll paste them into commands): Neon **direct** (non-pooled) Postgres connection string; all server secrets (see Step 3 list); the realtime Worker's `REALTIME_JWT_SECRET` + `REALTIME_INTERNAL_SECRET` (must match what the server uses).

---

## Step 1 — Provision Hyperdrive (→ Neon)

Hyperdrive fronts the **direct** Postgres connection (it does its own pooling — do NOT give it Neon's `-pooler` URL).

- [ ] Create it:
```bash
cd apps/server
wrangler hyperdrive create cue-neon --connection-string="postgres://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```
- [ ] Copy the returned **id** into `apps/server/wrangler.jsonc` → `hyperdrive[0].id` (replace `REPLACE_IN_1D`). Also set `localConnectionString` to the same Neon URL (used only by `wrangler dev`).
- [ ] **Commit** the wrangler.jsonc id change: `git add apps/server/wrangler.jsonc && git commit -m "chore(server): set Hyperdrive id for cutover"`.

**Gate:** `wrangler hyperdrive list` shows `cue-neon`.
**Rollback:** none needed yet (nothing serves traffic).

---

## Step 2 — Provision R2 buckets

- [ ] Create both buckets:
```bash
wrangler r2 bucket create cue-assets
wrangler r2 bucket create cue-media
```
- [ ] **Make `cue-media` public on a custom domain** (audio is served directly to browsers):
```bash
wrangler r2 bucket custom-domain add cue-media --domain media.sense.fans
```
  - *Fallback (no CF zone):* enable the managed dev URL instead — `wrangler r2 bucket dev-url enable cue-media` — and set `MEDIA_PUBLIC_BASE` (Step 3 / wrangler.jsonc `vars`) to the printed `https://pub-xxxx.r2.dev` URL. Keep `cue-assets` **private** (it's proxied through the Worker — never make it public).

**Gate:** `wrangler r2 bucket list` shows both; `curl -I https://media.sense.fans/` (or the dev URL) resolves (404 for an unknown key is fine — it means the domain is live).
**Rollback:** none needed yet.

---

## Step 3 — Set Worker secrets + vars

Non-secret `vars` (`MEDIA_PUBLIC_BASE`) are already in `wrangler.jsonc` — update it if you used the r2.dev fallback. Set the **secrets** (each prompts for the value; run from `apps/server`):

- [ ] Required:
```bash
wrangler secret put DATABASE_URL            # Neon HTTP url (neon-http fallback path)
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL         # see note below
wrangler secret put CORS_ORIGIN             # https://cinema.sense.fans
wrangler secret put REALTIME_JWT_SECRET     # MUST match the realtime Worker
wrangler secret put REALTIME_INTERNAL_SECRET# MUST match the realtime Worker
wrangler secret put TMDB_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret put BLOB_READ_WRITE_TOKEN   # keep — migration reads legacy Vercel images
wrangler secret put UPSTASH_REDIS_REST_URL  # still used for cache/rate-limit (Phase 2 removes)
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```
- [ ] Optional (only if used): `POLAR_ACCESS_TOKEN`, `POLAR_SUCCESS_URL`, `MOVIQUOTES_API_KEY`.
- [ ] Non-secret vars to confirm in `wrangler.jsonc` `vars` (add as needed): `NODE_ENV: "production"`, `BLOB_STORE_ACCESS` (match your Vercel store — default `public`), `TMDB_WATCH_REGION`, `QUOTE_API_PROVIDER`. (t3-env validates these at isolate startup, so a missing required one fails the deploy fast — that's the signal to add it.)

> **`BETTER_AUTH_URL` + CORS/cookies note (decide before Step 6):** auth cookies are origin-scoped. The lowest-risk cutover keeps the **browser calling the web origin** and proxies `/api/*` to the Worker via the Next rewrite (Step 6, option A) — then `BETTER_AUTH_URL` stays the web origin and cookies are unaffected. If instead the browser calls `api.sense.fans` directly (option B), `BETTER_AUTH_URL` = `https://api.sense.fans`, cookies need a shared parent domain (`.sense.fans`) and CORS `credentials` must allow the web origin. **Recommend option A.**

**Gate:** `wrangler secret list` shows all the names.
**Rollback:** none needed yet.

---

## Step 4 — Deploy the Worker (no traffic yet)

- [ ] Deploy to the `*.workers.dev` URL first (no custom domain bound yet):
```bash
cd apps/server && wrangler deploy
```
- [ ] **Smoke-test the workers.dev URL** (replace with the printed URL):
```bash
BASE=https://cue-server.<acct>.workers.dev
curl -s $BASE/                       # {"ok":true,"name":"still-server",...}
curl -s $BASE/api/health/db          # {"ok":true}  ← proves Hyperdrive→Neon works
```
- [ ] If `/api/health/db` fails: check the Hyperdrive id, the Neon connection string, and that `process.env` is populated (a 500 mentioning env validation means a required secret/var is missing — add it and redeploy).

**Gate:** `/` and `/api/health/db` both return ok on workers.dev. This is the **make-or-break gate** — the server runs on Workers against real Neon.
**Rollback:** none — nothing points at this URL yet.

---

## Step 5 — Bind `api.sense.fans` + full smoke

- [ ] Add the custom domain route to `apps/server/wrangler.jsonc` (top level):
```jsonc
	"routes": [{ "pattern": "api.sense.fans", "custom_domain": true }]
```
  *Fallback (no CF zone):* skip this; use the `cue-server.<acct>.workers.dev` URL as the API origin in Step 6.
- [ ] Redeploy: `wrangler deploy`. Commit the wrangler.jsonc route change.
- [ ] **Full smoke on `api.sense.fans`** (or the workers.dev URL):
```bash
BASE=https://api.sense.fans
curl -s $BASE/api/health/db                     # {"ok":true}
# Auth: from a browser logged into the app, hit an authed GET and confirm 200.
# Image round-trip: upload an avatar, then GET /api/profiles/avatar/<handle> → image bytes.
# Audio round-trip: record a review clip → confirm it lands at media.sense.fans/reviews/...
# Realtime authorize: the realtime Worker calls $BASE/api/realtime/authorize internally (Step 6 wires SERVER_ORIGIN).
```

**Gate:** auth, an image upload+serve, and an audio upload all work against `api.sense.fans`, with new uploads landing in R2 (check `wrangler r2 object get`/the dashboard).
**Rollback:** remove the route / leave the Vercel server as the active origin (Step 6 hasn't flipped yet).

---

## Step 6 — Migrate blobs, then flip origins

Do the data migration **before** flipping reads, so every row resolves post-flip.

- [ ] **Run the image + audio migrations** (loop until `remaining: 0`). `SECRET` = `REALTIME_INTERNAL_SECRET`:
```bash
BASE=https://api.sense.fans
SECRET=<REALTIME_INTERNAL_SECRET>
while :; do
  R=$(curl -s -X POST "$BASE/api/admin/assets/migrate-images?limit=50" -H "Authorization: Bearer $SECRET")
  echo "$R"; echo "$R" | grep -q '"remaining":0' && break
done
while :; do
  R=$(curl -s -X POST "$BASE/api/admin/assets/migrate-audio?limit=50" -H "Authorization: Bearer $SECRET")
  echo "$R"; echo "$R" | grep -q '"remaining":0' && break
done
```
  (Migration is idempotent — re-running is safe. It copies Vercel→R2 and rewrites DB values to R2 keys/URLs.)
- [ ] **Spot-check** a few migrated rows resolve: load a profile avatar and play a review clip in the app (still pointed at Vercel — both backends resolve, so this should already work).

- [ ] **Flip the realtime Worker origin.** In `apps/realtime/wrangler.jsonc`, set `SERVER_ORIGIN` to `https://api.sense.fans`, then `cd apps/realtime && wrangler deploy`. Commit.

- [ ] **Flip the web origin (Vercel env), option A — recommended (proxy, no cookie/CORS change):**
  - Set `API_REWRITE_ORIGIN = https://api.sense.fans` in the Vercel **web** project env. Leave `NEXT_PUBLIC_SERVER_URL` as the web origin. Redeploy web. The browser keeps calling the web origin; Next rewrites `/api/*` to the Worker.
  - *Option B (direct):* set `NEXT_PUBLIC_SERVER_URL = https://api.sense.fans` too — only if you handled `BETTER_AUTH_URL`/cookies/CORS per the Step 3 note.

**Gate:** with web redeployed, exercise the app end-to-end (sign in, view a profile image, play review audio, see realtime presence/notifications). Watch the Worker logs: `wrangler tail` (apps/server) during the smoke.
**Rollback (single flip):** set `API_REWRITE_ORIGIN` (and `NEXT_PUBLIC_SERVER_URL` if changed) back to `https://cue-server-lac.vercel.app`, and the realtime `SERVER_ORIGIN` back to the Vercel URL; redeploy. The Vercel server is still live and the DB rows resolve from either backend.

---

## Step 7 — Retire the Vercel server (after a soak)

- [ ] Let it run a day or two on Cloudflare; watch `wrangler tail` + the app for errors.
- [ ] Once confident: in the Vercel **server** project, pause/delete the deployment (keep the project until the next billing cycle confirms the drop). The web project stays on Vercel (that's Phase 3).
- [ ] Optional cleanup PRs (separate, not blocking): drop `BLOB_READ_WRITE_TOKEN` once no legacy Vercel image URLs remain; remove `@vercel/blob` from local-dev fallback if you switch local dev to R2.

**Gate:** app healthy on Cloudflare with the Vercel server stopped.
**Rollback:** re-enable the Vercel server deployment + flip origins back (Step 6 rollback).

---

## What this leaves for later (not 1D)

- **Phase 2 — kill Upstash:** cache → Workers KV, rate-limit → DO, delete the dead SSE/Redis path. (Server is on Workers now, so KV is finally available.)
- **Phase 3 — web → Cloudflare** via OpenNext (removes the rest of the Vercel bill).
- **Cron Triggers** (optional): the background jobs in `local.ts` don't run on prod today; add Cloudflare Cron Triggers if you want them to.

## Definition of done (Phase 1)

`api.sense.fans` serves the Elysia app from a Worker; Neon via Hyperdrive; avatars/banners/covers on R2 `cue-assets` (proxied); review audio on public R2 `cue-media`; all legacy blobs migrated; web + realtime point at `api.sense.fans`; the Vercel **server** is retired. Vercel (web only) + Neon + Upstash remain — addressed in Phases 2/3.
