# Favorite Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship dialogue quotes on film/TV detail (upvote + save), patron submit → staff moderation → notifications, `/quotes` lobby, profile strip, and optional external API import.

**Architecture:** Approach 2 from spec — `listing_quote` (published catalog) separate from `quote_submission` (moderation queue). Detail top bar expands to **About · Community · Quotes · Streaming**. TV quotes scoped by season + episode selects. Saves use existing `content_visibility` (default `private`).

**Tech Stack:** Next.js App Router, Elysia, Drizzle/Neon (`neon-http`, sequential writes — no transactions), `bun:test`, `transitions-dev` CSS, `motion/react`.

**Spec:** [`docs/superpowers/specs/2026-06-14-favorite-quotes-design.md`](../specs/2026-06-14-favorite-quotes-design.md)

---

## Conventions

- Migration next tag: **`0032_listing_quotes`**
- Register in `packages/db/src/migrations/meta/_journal.json` before `bun run db:migrate`
- Tests: `bun test` colocated `*.test.ts`
- API client: `api.api.<segment>` via `@still/api-client`
- After code changes: `graphify update .` (when available)
- Do **not** commit unless the human asks
- Executor: **one task at a time**; human **`go`** / **`ok`** between tasks

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/db/src/migrations/0032_listing_quotes.sql` | Tables + enums |
| `packages/db/src/schema/quote.ts` | Drizzle schema |
| `apps/server/src/lib/listing-quote.ts` | Validation, timestamp format, row mappers |
| `apps/server/src/lib/listing-quote.test.ts` | Unit tests |
| `apps/server/src/lib/quote-submission.ts` | Submit + staff approve/reject |
| `apps/server/src/lib/quote-submission.test.ts` | Moderation tests |
| `apps/server/src/lib/quote-provider.ts` | Pluggable external API adapter + stub |
| `apps/server/src/lib/quote-import.ts` | Upsert job |
| `apps/server/src/routes/quotes.ts` | Catalog, upvote, save, submit, staff |
| `apps/server/src/routes/movies.ts` | Mount `GET /:id/quotes` or delegate |
| `apps/server/src/routes/tv.ts` | `GET /:id/quotes?season&episode` |
| `apps/server/src/routes/profiles.ts` | `GET /:handle/quotes` public saves |
| `apps/server/src/routes/staff.ts` | Wire staff quote panel endpoints |
| `apps/server/src/lib/product-event-kinds.ts` | New kinds |
| `apps/web/src/lib/movie-detail-view.ts` | Extend `MovieDetailView` |
| `apps/web/src/lib/quote-timestamp.ts` | `msToHhMmSs` / parse |
| `apps/web/src/lib/quote-timestamp.test.ts` | Format tests |
| `apps/web/src/components/movie/movie-detail-top-bar.tsx` | Four top tabs |
| `apps/web/src/components/movie/movie-detail-view-shell.tsx` | Mount community/quotes panels |
| `apps/web/src/components/movie/movie-detail-community-panel.tsx` | Extracted Community tab body |
| `apps/web/src/components/movie/movie-detail-quotes-panel.tsx` | Quotes tab UI |
| `apps/web/src/components/quote/quote-suggest-sheet.tsx` | Submit form |
| `apps/web/src/components/quote/quote-row.tsx` | Single quote card + actions |
| `apps/web/src/app/(app)/quotes/page.tsx` | Saved quotes lobby |
| `apps/web/src/components/profile/profile-saved-quotes-strip.tsx` | Profile summary |
| `apps/web/src/components/staff/staff-quotes-panel.tsx` | Moderation queue |
| `apps/web/src/lib/notification-href.ts` | Deep link `?view=quotes` |
| `packages/ui/src/styles/globals.css` | `transitions-dev` tokens if missing |

---

## Task 1: Migration + Drizzle schema

**Files:**
- Create: `packages/db/src/migrations/0032_listing_quotes.sql`
- Create: `packages/db/src/schema/quote.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Add SQL migration**

```sql
CREATE TYPE "listing_quote_source" AS ENUM ('external_api', 'staff', 'patron');
CREATE TYPE "quote_submission_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "listing_quote" (
  "id" text PRIMARY KEY NOT NULL,
  "movie_id" integer REFERENCES "movie"("tmdb_id") ON DELETE CASCADE,
  "tv_id" integer REFERENCES "tv"("tmdb_id") ON DELETE CASCADE,
  "season_number" smallint,
  "episode_number" smallint,
  "body" text NOT NULL,
  "speaker" text,
  "timestamp_ms" integer,
  "source" "listing_quote_source" NOT NULL,
  "submitted_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "external_provider" text,
  "external_id" text,
  "upvote_count" integer DEFAULT 0 NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "listing_quote_movie_xor_tv" CHECK (
    ("movie_id" IS NOT NULL AND "tv_id" IS NULL)
    OR ("movie_id" IS NULL AND "tv_id" IS NOT NULL)
  ),
  CONSTRAINT "listing_quote_tv_episode_required" CHECK (
    "tv_id" IS NULL OR ("season_number" IS NOT NULL AND "episode_number" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "listing_quote_external_uk"
  ON "listing_quote" ("external_provider", "external_id")
  WHERE "external_provider" IS NOT NULL AND "external_id" IS NOT NULL;

CREATE INDEX "listing_quote_movie_upvotes_idx"
  ON "listing_quote" ("movie_id", "upvote_count" DESC);

CREATE INDEX "listing_quote_tv_episode_upvotes_idx"
  ON "listing_quote" ("tv_id", "season_number", "episode_number", "upvote_count" DESC);

CREATE TABLE "listing_quote_upvote" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "quote_id" text NOT NULL REFERENCES "listing_quote"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "quote_id")
);

CREATE TABLE "listing_quote_save" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "quote_id" text NOT NULL REFERENCES "listing_quote"("id") ON DELETE CASCADE,
  "visibility" "content_visibility" DEFAULT 'private' NOT NULL,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "listing_quote_save_user_quote_uk" UNIQUE ("user_id", "quote_id")
);

CREATE INDEX "listing_quote_save_user_idx" ON "listing_quote_save" ("user_id", "saved_at" DESC);

CREATE TABLE "quote_submission" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "movie_id" integer REFERENCES "movie"("tmdb_id") ON DELETE CASCADE,
  "tv_id" integer REFERENCES "tv"("tmdb_id") ON DELETE CASCADE,
  "season_number" smallint,
  "episode_number" smallint,
  "body" text NOT NULL,
  "speaker" text,
  "timestamp_ms" integer,
  "status" "quote_submission_status" DEFAULT 'pending' NOT NULL,
  "staff_note" text,
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "resolved_quote_id" text REFERENCES "listing_quote"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "quote_submission_movie_xor_tv" CHECK (
    ("movie_id" IS NOT NULL AND "tv_id" IS NULL)
    OR ("movie_id" IS NULL AND "tv_id" IS NOT NULL)
  )
);

CREATE INDEX "quote_submission_pending_idx"
  ON "quote_submission" ("status", "created_at" DESC);
```

- [ ] **Step 2: Drizzle schema** — `packages/db/src/schema/quote.ts` with enums, tables, relations; export from `index.ts`

- [ ] **Step 3: Journal entry** — add `0032_listing_quotes` to `_journal.json`

- [ ] **Step 4: Run migration**

```bash
cd packages/db && bun run db:migrate
```

Expected: migration applies without error.

- [ ] **Step 5: Human checkpoint** — confirm Task 1 before Task 2.

---

## Task 2: Server helpers + catalog query tests

**Files:**
- Create: `apps/server/src/lib/listing-quote.ts`
- Create: `apps/server/src/lib/listing-quote.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:
- `formatQuoteTimestampMs(834000)` → `"00:13:54"`
- `parseQuoteTimestampInput("1:02:03")` → `3723000`
- `validateQuoteBody("")` throws
- `validateQuoteBody("x".repeat(501))` throws

- [ ] **Step 2: Implement helpers** — body max 500, timestamp parse/format, listing row → API DTO

- [ ] **Step 3: Run tests**

```bash
cd apps/server && bun test src/lib/listing-quote.test.ts
```

Expected: all PASS.

---

## Task 3: Quotes API routes (catalog + engagement)

**Files:**
- Create: `apps/server/src/routes/quotes.ts`
- Modify: `apps/server/src/server/app.ts`
- Modify: `apps/server/src/routes/movies.ts` — delegate or mount nested
- Modify: `apps/server/src/routes/tv.ts`

- [ ] **Step 1: `GET /api/movies/:id/quotes`** — paginate, sort `upvotes|newest`, include `viewerHasUpvoted` / `viewerHasSaved` when session present

- [ ] **Step 2: `GET /api/tv/:id/quotes`** — require `season` + `episode` query params (400 if missing)

- [ ] **Step 3: `POST /api/quotes/:id/upvote`** — toggle; update `upvoteCount` denormalized

- [ ] **Step 4: `POST /api/quotes/:id/save`**, `PATCH /api/quotes/saves/:id`, `DELETE /api/quotes/saves/:id`

- [ ] **Step 5: Route tests** — `apps/server/src/routes/quotes.test.ts` with mocked db or integration pattern used in `lists.test.ts`

- [ ] **Step 6: Human checkpoint**

---

## Task 4: Submit + staff moderation + notifications

**Files:**
- Create: `apps/server/src/lib/quote-submission.ts`
- Create: `apps/server/src/lib/quote-submission.test.ts`
- Modify: `apps/server/src/routes/quotes.ts`
- Modify: `apps/server/src/routes/staff.ts`
- Modify: `apps/server/src/routes/notifications.ts` — enrich payload for new kinds

- [ ] **Step 1: `POST /api/quotes/submit`** — rate limit 5/24h per user; status `pending`

- [ ] **Step 2: Staff `GET /api/quotes/submissions`**, `POST .../approve`, `POST .../reject`

- [ ] **Step 3: On approve** — insert `listing_quote` (`source: patron`), set `resolvedQuoteId`, notify `quote.submission.approved` with `href` to title Quotes tab

- [ ] **Step 4: On reject** — notify `quote.submission.rejected` with optional `staffNote`

- [ ] **Step 5: Tests** — approve creates catalog row; reject includes note in payload

- [ ] **Step 6: Human checkpoint**

---

## Task 5: Product events + profile/public saves API

**Files:**
- Modify: `apps/server/src/lib/product-event-kinds.ts`
- Modify: `apps/web/src/lib/product-event-kinds.ts` (client mirror)
- Modify: `apps/server/src/routes/quotes.ts` or `profiles.ts`

- [ ] **Step 1: Add kinds** — `quote.upvote`, `quote.save`, `quote.unsave`, `quote.submit`

- [ ] **Step 2: `GET /api/me/quotes/saved`** — paginated lobby payload (quote + listing thumb)

- [ ] **Step 3: `GET /api/profiles/:handle/quotes`** — public saves only; 404 private profile

- [ ] **Step 4: Human checkpoint**

---

## Task 6: Detail view IA — four top tabs

**Files:**
- Modify: `apps/web/src/lib/movie-detail-view.ts`
- Modify: `apps/web/src/components/movie/movie-detail-top-bar.tsx`
- Modify: `apps/web/src/components/movie/movie-detail-view-shell.tsx`
- Create: `apps/web/src/components/movie/movie-detail-community-panel.tsx` (extract from about async)
- Modify: `apps/web/src/components/movie/movie-detail-about-async.tsx`

- [ ] **Step 1: Extend type** — `MovieDetailView = "about" | "community" | "quotes" | "streaming"`

- [ ] **Step 2: Update `parseMovieDetailView` / `buildMovieDetailViewHref`** — `?view=community`, `?view=quotes`, TV adds `season` + `episode` when on quotes

- [ ] **Step 3: Top bar** — four `SegmentedPillToolbar` tabs; keep mounted panels pattern

- [ ] **Step 4: Extract Community** from About scroll into dedicated panel (reviews carousel, lists, following ratings)

- [ ] **Step 5: Manual QA** — instant tab switch film + TV detail

- [ ] **Step 6: Human checkpoint**

---

## Task 7: Quotes tab UI + suggest sheet

**Files:**
- Create: `apps/web/src/components/movie/movie-detail-quotes-panel.tsx`
- Create: `apps/web/src/components/quote/quote-row.tsx`
- Create: `apps/web/src/components/quote/quote-suggest-sheet.tsx`
- Create: `apps/web/src/lib/quote-timestamp.ts` + test

- [ ] **Step 1: Quotes panel** — fetch `GET .../quotes`, list with upvote/save, TV season/episode selects

- [ ] **Step 2: Suggest sheet** — form → `POST /api/quotes/submit`; toast on success

- [ ] **Step 3: Motion** — save icon `t-icon-swap`, upvote count `t-number-pop-in` (add transitions-dev tokens to globals if absent)

- [ ] **Step 4: Empty state** + CTA suggest

- [ ] **Step 5: Human checkpoint**

---

## Task 8: `/quotes` lobby + profile strip

**Files:**
- Create: `apps/web/src/app/(app)/quotes/page.tsx`
- Create: `apps/web/src/components/profile/profile-saved-quotes-strip.tsx`
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx`
- Modify: `apps/web/src/lib/notification-href.ts`

- [ ] **Step 1: Lobby page** — `HomeStickyChrome`, saved quotes list, filters movie/tv

- [ ] **Step 2: Profile strip** — 3 recent (public for visitors); link to `/quotes`

- [ ] **Step 3: Notification deep links** — `?view=quotes&season=&episode=` on movie/tv paths

- [ ] **Step 4: Human checkpoint**

---

## Task 9: Staff panel + import adapter (env-gated)

**Files:**
- Create: `apps/web/src/components/staff/staff-quotes-panel.tsx`
- Modify: `apps/web/src/app/(app)/staff/page.tsx`
- Create: `apps/server/src/lib/quote-provider.ts`
- Create: `apps/server/src/lib/quote-import.ts`

- [ ] **Step 1: Staff UI** — pending queue, approve/reject, optional note on reject

- [ ] **Step 2: Stub provider** — returns `[]` until `QUOTE_API_PROVIDER` configured; document env vars in server `.env.example` if present

- [ ] **Step 3: Import upsert** — by `(externalProvider, externalId)`; skip overwrite patron/staff rows

- [ ] **Step 4: Human checkpoint**

---

## Task 10: Verification + changelog

- [ ] **Step 1: Run server tests** — `cd apps/server && bun test`

- [ ] **Step 2: Run web tests** — quote timestamp + any new tests

- [ ] **Step 3: Manual E2E** — submit → staff approve → notification → save → `/quotes` → profile strip

- [ ] **Step 4: Changelog entry** — `apps/web/src/lib/product-changelog.ts` + `whats-new-releases` bump when human requests release notes

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `listing_quote` + submissions split | 1, 4 |
| Upvote toggle | 3 |
| Save default private | 3, 5 |
| Quotes tab + TV season/episode | 6, 7 |
| Submit → staff → notify | 4, 8 |
| `/quotes` lobby | 8 |
| Profile strip | 8 |
| External API adapter | 9 |
| Product events | 5 |
| transitions-dev motion | 7 |
| Showcase quote deferred | — (v1.1) |

---

## Execution handoff

Plan saved. **Subagent-driven (recommended):** one task per subagent, human **`go`** between tasks. **Inline:** execute Task 1 now in this session.
