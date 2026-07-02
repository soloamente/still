# Production Taste Hero API Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore taste hero title logos and trailers on production by deploying current Elysia routes and hardening clients against silent `NOT_FOUND` JSON.

**Architecture:** Browser calls `cinema.sense.fans/api/*` → Next rewrites to `API_REWRITE_ORIGIN` Elysia host. Routes `GET /api/movies/:id/title-logo` and `/trailer` live in `movies.ts`; production API is stale. Primary fix is API redeploy + `TMDB_API_KEY` on API project. Secondary code fix: Elysia `onError` returns 404 for `NOT_FOUND`; web fetch helpers reject error payloads.

**Tech Stack:** Elysia, Next.js rewrites, Bun tests

**Spec:** `docs/superpowers/specs/2026-07-02-production-taste-hero-api-routes-design.md`

---

### Task 1: API redeploy (ops — human)

**Files:** None (Vercel dashboard)

- [ ] **Step 1: Confirm web env**

Web project (`cinema.sense.fans`):

- `NEXT_PUBLIC_SERVER_URL=https://cinema.sense.fans`
- `API_REWRITE_ORIGIN` = Elysia API host URL (not the web URL)

- [ ] **Step 2: Confirm API env**

API project (`apps/server`):

- `TMDB_API_KEY` set (≥10 chars)
- `BETTER_AUTH_URL=https://cinema.sense.fans`
- `CORS_ORIGIN=https://cinema.sense.fans`

- [ ] **Step 3: Redeploy API from current `main`**

Redeploy the Vercel project behind `API_REWRITE_ORIGIN`. Web redeploy not required unless env changed.

- [ ] **Step 4: Smoke test**

```bash
curl.exe -sS "https://cinema.sense.fans/api/movies/76/title-logo"
curl.exe -sS "https://cinema.sense.fans/api/movies/76/trailer"
```

Expected: JSON with `logoPath` / `trailerKey` keys (values may be `null`). Must **not** contain `"code":"NOT_FOUND"`.

- [ ] **Step 5: Browser verify**

Signed in on `/home` Movies — taste hero shows wordmark + trailer when TMDb has assets.

---

### Task 2: Elysia `onError` HTTP status codes

**Files:**
- Modify: `apps/server/src/server/app.ts`
- Create: `apps/server/src/server/app-on-error.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { mapElysiaErrorStatus } from "./app-on-error";

describe("mapElysiaErrorStatus", () => {
	test("NOT_FOUND maps to 404", () => {
		expect(mapElysiaErrorStatus("NOT_FOUND")).toBe(404);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun test apps/server/src/server/app-on-error.test.ts`

- [ ] **Step 3: Implement status mapper + wire onError**

Extract `mapElysiaErrorStatus` and set `set.status` in `.onError`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** (if requested)

---

### Task 3: Client rejects Elysia error JSON

**Files:**
- Create: `apps/web/src/lib/still-api-error-payload.ts`
- Create: `apps/web/src/lib/still-api-error-payload.test.ts`
- Modify: `apps/web/src/lib/still-api-fetch.ts` (`fetchMovieTitleLogoPath`, `fetchMovieTrailer`)

- [ ] **Step 1: Write failing test for `isStillApiErrorPayload`**

- [ ] **Step 2: Implement helper**

- [ ] **Step 3: Use in title-logo / trailer fetchers after `response.json()`**

- [ ] **Step 4: Run tests**

Run: `bun test apps/web/src/lib/still-api-error-payload.test.ts`

- [ ] **Step 5: Commit** (if requested)

---

### Task 4: Mark spec approved + graphify

- [ ] Update spec status to **Approved**
- [ ] Run `graphify update .` after code changes
