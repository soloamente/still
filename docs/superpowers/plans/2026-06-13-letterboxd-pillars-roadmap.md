# Letterboxd Pillars Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the twelve Letterboxd obsessive-usage gaps in Sense via four parallel tracks — identity showcase, ritual moments, social virality, and platform bets (Journal, Wrapped, Members, streaming alerts).

**Architecture:** Approach B — Wave 0 shared prerequisites (`showcase_items` migration + `product_event` kinds), then parallel waves 1a–2b (showcase, post-log strip, viral reviews, Journal, Members), then waves 3a–4 (Wrapped, streaming alerts, motion polish, catalogue stat). Each track produces independently testable software.

**Tech Stack:** Next.js App Router, Elysia, Drizzle/Neon (`neon-http`, no transactions), `bun:test`, Satori OG routes, `transitions-dev` CSS, `motion/react`, Resend (Pro email only).

**Spec:** [`docs/superpowers/specs/2026-06-13-letterboxd-pillars-roadmap-design.md`](../specs/2026-06-13-letterboxd-pillars-roadmap-design.md)

---

## Conventions

- Migration next tag: **`0028_profile_showcase_items`** (then `0029_journal_post`, `0030_streaming_alert_state` as needed)
- Register every migration in `packages/db/src/migrations/meta/_journal.json` before `bun run db:migrate`
- Tests: `bun:test`, colocated `*.test.ts`
- API client: `api.api.<segment>` via `@still/api-client`
- After code changes: `graphify update .`
- Do **not** commit unless the human asks
- Executor: **one task at a time**; human verifies before next task
- Open questions resolved for this plan:
  - Showcase section label: **"Showcase"**
  - Post-log one-line note: **review composer CTA only** (no log schema change in v1)
  - Journal body: **Markdown string** in `body` column; render with existing markdown/typography patterns (no MDX pipeline in v1)

---

## File structure (by wave)

### Wave 0

| File | Responsibility |
|------|----------------|
| `packages/db/src/migrations/0028_profile_showcase_items.sql` | `showcase_items` jsonb on `profile` |
| `packages/db/src/schema/profile.ts` | `showcaseItems` column + `ShowcaseItem` type |
| `apps/server/src/lib/product-event-kinds.ts` | New funnel kinds |
| `apps/server/src/lib/record-product-event.ts` | (unchanged — uses kinds) |
| `apps/web/src/lib/product-event-kinds.ts` | Client-allowed kinds mirror |

### Wave 1a — Profile Showcase

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/profile-showcase.ts` | Validate/normalize/migrate `favoriteMovieIds` → showcase |
| `apps/server/src/lib/profile-showcase.test.ts` | Max 4, dupes, kind validation, legacy migration |
| `apps/server/src/routes/profiles.ts` | `PATCH /me/showcase`, serialize on `GET /:handle` |
| `apps/web/src/lib/profile-showcase.ts` | Client types + `resolveShowcaseTiles()` hydration helper |
| `apps/web/src/lib/profile-showcase.test.ts` | Tile resolution tests |
| `apps/web/src/components/profile/profile-showcase-strip.tsx` | Hero row UI |
| `apps/web/src/components/profile/profile-showcase-edit-sheet.tsx` | Owner slot picker sheet |
| `apps/web/src/components/profile/profile-patron-header.tsx` | Insert strip under taste signature |

### Wave 1b — Post-log ritual

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/log/quick-log-celebration-strip.tsx` | Inline strip after new log |
| `apps/web/src/components/log/quick-log-sheet.tsx` | Wire strip on POST success |
| `packages/ui/src/styles/globals.css` | `transitions-dev` `:root` tokens if missing |
| `apps/web/src/components/diary/diary-filter-chips.tsx` | Year/decade chips (create or extend diary lobby) |

### Wave 1c — Viral reviews

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/viral-reviews-query.ts` | Engagement + body length filter |
| `apps/server/src/lib/viral-reviews-query.test.ts` | Query helper tests |
| `apps/server/src/routes/reviews.ts` | `GET /viral` |
| `apps/web/src/components/home/home-viral-reviews-rail.tsx` | Community rail |
| `apps/web/src/components/home/home-community-lobby.tsx` | Mount rail when `feed=reviews` or top of community |

### Wave 2a — Journal

| File | Responsibility |
|------|----------------|
| `packages/db/src/migrations/0029_journal_post.sql` | `journal_post` table |
| `packages/db/src/schema/journal.ts` | Drizzle schema |
| `apps/server/src/routes/journal.ts` | Public list/detail + staff CRUD |
| `apps/server/src/routes/staff.ts` | Staff journal tab handlers |
| `apps/web/src/app/journal/page.tsx` | Public index (outside `(app)`) |
| `apps/web/src/app/journal/[slug]/page.tsx` | Article page |
| `apps/web/src/app/og/journal/[slug]/route.tsx` | OG image |
| `apps/web/src/components/journal/journal-article-body.tsx` | Markdown render |
| `apps/web/src/components/home/home-journal-rail.tsx` | Latest 3 rail |
| `apps/web/src/components/staff/staff-journal-panel.tsx` | Draft/publish UI |

### Wave 2b — Members directory

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/members-leaderboard-query.ts` | Patron sort dimensions |
| `apps/server/src/lib/members-leaderboard-query.test.ts` | Sort + privacy tests |
| `apps/server/src/routes/members.ts` | `GET /leaderboard` |
| `apps/web/src/app/(app)/members/page.tsx` | Directory page |
| `apps/web/src/components/members/members-leaderboard.tsx` | Sort/period UI + rows |

### Wave 2c — Detail social proof

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/listing-community-stats.ts` | Watches + watchlist counts |
| `apps/server/src/routes/movies.ts` | Include counts in `community` payload |
| `apps/server/src/routes/tv.ts` | TV parity |
| `apps/web/src/components/movie/movie-detail-community-rating-hero.tsx` | Render counts |

### Wave 3a — Year in Review

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/year-in-review.ts` | `computeYearInReview` |
| `apps/server/src/lib/year-in-review.test.ts` | Fixture tests |
| `apps/server/src/routes/me.ts` or `profiles.ts` | `GET /me/year/:year` |
| `apps/web/src/app/(app)/me/year/[year]/page.tsx` | Wrapped page |
| `apps/web/src/app/og/year/[handle]/[year]/route.tsx` | Share OG |
| `apps/web/src/components/achievements/year-in-review-card.tsx` | Achievements entry |

### Wave 3b — Streaming alerts

| File | Responsibility |
|------|----------------|
| `packages/db/src/migrations/0030_watchlist_streaming_snapshot.sql` | Per-title provider snapshot |
| `apps/server/src/lib/watchlist-streaming-alerts.ts` | Diff job + notification insert |
| `apps/server/src/lib/watchlist-streaming-alerts.test.ts` | Diff fixture tests |
| `apps/server/src/lib/notification-kinds.ts` | `watchlist_now_streaming` kind |
| `apps/web/src/components/profile/settings-section-panels.tsx` | Toggle UI |
| `apps/web/src/components/watchlist/watchlist-poster-tile.tsx` | "Now on …" pill |

### Wave 3c / 4 — Polish + catalogue

| File | Responsibility |
|------|----------------|
| `packages/ui/src/styles/globals.css` | `t-*` transition snippets |
| `apps/web/src/lib/catalogue-stats.ts` | Cached film/TV counts |
| `apps/web/src/components/home/home-movies-lobby.tsx` | Stat line in header |

---

## Wave 0 — Shared prerequisites

### Task 1: `showcase_items` migration + schema

**Files:**
- Create: `packages/db/src/migrations/0028_profile_showcase_items.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`
- Modify: `packages/db/src/schema/profile.ts`

- [ ] **Step 1: Add SQL migration**

```sql
-- packages/db/src/migrations/0028_profile_showcase_items.sql
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "showcase_items" jsonb DEFAULT '[]'::jsonb NOT NULL;
```

- [ ] **Step 2: Register in `_journal.json`** (idx 28, tag `0028_profile_showcase_items`, when timestamp after `0027`)

- [ ] **Step 3: Add Drizzle column + type** in `packages/db/src/schema/profile.ts`:

```typescript
export type ShowcaseItem =
  | { kind: "movie"; id: number }
  | { kind: "tv"; id: number }
  | { kind: "review"; id: string };

// inside profile table columns:
showcaseItems: jsonb("showcase_items")
  .$type<ShowcaseItem[]>()
  .notNull()
  .default([]),
```

- [ ] **Step 4: Run migration**

Run: `bun run db:migrate`  
Expected: `0028_profile_showcase_items` applied without error

- [ ] **Step 5: Commit** (only if human requests)

---

### Task 2: Product event kinds

**Files:**
- Modify: `apps/server/src/lib/product-event-kinds.ts`
- Modify: `apps/web/src/lib/product-event-kinds.ts` (if exists; else create mirror)

- [ ] **Step 1: Write failing test** — `apps/server/src/lib/product-event-kinds.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { isProductEventKind, PRODUCT_EVENT_KINDS } from "./product-event-kinds";

describe("letterboxd pillar kinds", () => {
  test("includes showcase and wrapped kinds", () => {
    for (const kind of [
      "showcase.edited",
      "post_log.celebrate",
      "viral_review.tapped",
      "journal.read",
      "wrapped.viewed",
      "wrapped.shared",
      "members.followed",
      "streaming_alert.sent",
    ]) {
      expect(PRODUCT_EVENT_KINDS).toContain(kind);
      expect(isProductEventKind(kind)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/server && bun test src/lib/product-event-kinds.test.ts`  
Expected: FAIL — kinds missing

- [ ] **Step 3: Extend `PRODUCT_EVENT_KINDS`**

```typescript
export const PRODUCT_EVENT_KINDS = [
  // ...existing...
  "showcase.edited",
  "post_log.celebrate",
  "viral_review.tapped",
  "journal.read",
  "wrapped.viewed",
  "wrapped.shared",
  "members.followed",
  "streaming_alert.sent",
] as const;

export const CLIENT_PRODUCT_EVENT_KINDS = [
  // ...existing...
  "viral_review.tapped",
  "journal.read",
  "wrapped.viewed",
  "wrapped.shared",
  "members.followed",
] as const;
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Mirror client kinds in web** (`apps/web/src/lib/product-event-kinds.ts`)

---

## Wave 1a — Profile Showcase Strip

### Task 3: Server showcase validation + legacy migration

**Files:**
- Create: `apps/server/src/lib/profile-showcase.ts`
- Create: `apps/server/src/lib/profile-showcase.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, test } from "bun:test";
import {
  migrateLegacyFavoriteMovies,
  parseShowcaseItems,
  validateShowcasePatch,
} from "./profile-showcase";

describe("parseShowcaseItems", () => {
  test("rejects more than 4 items", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      kind: "movie" as const,
      id: i + 1,
    }));
    expect(() => parseShowcaseItems(items)).toThrow(/max 4/i);
  });

  test("rejects duplicate movie ids", () => {
    expect(() =>
      parseShowcaseItems([
        { kind: "movie", id: 1 },
        { kind: "movie", id: 1 },
      ]),
    ).toThrow(/duplicate/i);
  });
});

describe("migrateLegacyFavoriteMovies", () => {
  test("maps favoriteMovieIds when showcase empty", () => {
    expect(
      migrateLegacyFavoriteMovies([], [550, 680]),
    ).toEqual([
      { kind: "movie", id: 550 },
      { kind: "movie", id: 680 },
    ]);
  });

  test("does not override existing showcase", () => {
    const existing = [{ kind: "tv" as const, id: 1399 }];
    expect(migrateLegacyFavoriteMovies(existing, [550])).toEqual(existing);
  });
});

describe("validateShowcasePatch", () => {
  test("accepts review uuid slot", () => {
    expect(
      validateShowcasePatch([
        { kind: "review", id: "rev_abc123" },
      ]),
    ).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/server && bun test src/lib/profile-showcase.test.ts`

- [ ] **Step 3: Implement `profile-showcase.ts`**

```typescript
import type { ShowcaseItem } from "@still/db/schema/profile";

const MAX_SHOWCASE = 4;

export function parseShowcaseItems(raw: unknown): ShowcaseItem[] {
  if (!Array.isArray(raw)) throw new Error("showcase must be an array");
  if (raw.length > MAX_SHOWCASE) throw new Error("showcase max 4 items");
  const seen = new Set<string>();
  const out: ShowcaseItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") throw new Error("invalid showcase item");
    const kind = (entry as { kind?: string }).kind;
    const id = (entry as { id?: unknown }).id;
    if (kind === "movie" || kind === "tv") {
      if (typeof id !== "number" || !Number.isFinite(id)) throw new Error("invalid listing id");
    } else if (kind === "review") {
      if (typeof id !== "string" || id.length < 4) throw new Error("invalid review id");
    } else {
      throw new Error("invalid showcase kind");
    }
    const key = `${kind}:${id}`;
    if (seen.has(key)) throw new Error("duplicate showcase item");
    seen.add(key);
    out.push({ kind, id } as ShowcaseItem);
  }
  return out;
}

export function migrateLegacyFavoriteMovies(
  showcaseItems: ShowcaseItem[],
  favoriteMovieIds: number[],
): ShowcaseItem[] {
  if (showcaseItems.length > 0) return showcaseItems;
  return favoriteMovieIds.slice(0, MAX_SHOWCASE).map((id) => ({
    kind: "movie" as const,
    id,
  }));
}

export function validateShowcasePatch(items: ShowcaseItem[]): ShowcaseItem[] {
  return parseShowcaseItems(items);
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Wire `PATCH /api/profiles/me/showcase`** in `apps/server/src/routes/profiles.ts`:
  - Auth required
  - Rate limit like `/me/pins` (`profile:showcase:${user.id}`, 30/min)
  - Validate ownership for `review` ids (published, owned)
  - Validate `movie`/`tv` ids exist in cache tables
  - `recordProductEvent(user.id, "showcase.edited", { count: items.length })`
  - On `GET /:handle`, call `migrateLegacyFavoriteMovies` when serializing; hydrate posters/titles in payload as `showcaseResolved: { items: [...] }`

---

### Task 4: Web showcase strip + edit sheet

**Files:**
- Create: `apps/web/src/lib/profile-showcase.ts`
- Create: `apps/web/src/components/profile/profile-showcase-strip.tsx`
- Create: `apps/web/src/components/profile/profile-showcase-edit-sheet.tsx`
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx`
- Modify: `apps/web/src/app/(app)/profile/[handle]/page.tsx`

- [ ] **Step 1: Write failing test for tile helper** — `apps/web/src/lib/profile-showcase.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { showcaseFilledCount } from "./profile-showcase";

test("showcaseFilledCount", () => {
  expect(showcaseFilledCount([])).toBe(0);
  expect(showcaseFilledCount([{ kind: "movie", id: 1 }])).toBe(1);
});
```

- [ ] **Step 2: Implement strip component**

Key UI rules from spec:
- Section `aria-label="Showcase"`, heading **Showcase**
- Horizontal scroll with edge fades (`useHorizontalScrollFades`)
- Tiles: `w-20 sm:w-24 aspect-2/3 rounded-2xl outline outline-1 outline-black/10 dark:outline-white/10`
- Owner empty slots: dashed `rounded-2xl` **Add** buttons (max 4 total slots visible for owner)
- `active:scale-[0.96]` on tiles; review tiles show 1-line headline below poster
- Hide entire section for visitors when zero filled items

- [ ] **Step 3: Edit sheet** — `DetailVaulSheet` pattern:
  - 4 slot rows; each row: kind toggle (Film · TV · Review) + search picker
  - Reuse `CatalogSearchDialogRoot` listing search or compact `StillPopoverSelect` pattern from review composer
  - Save → `api.api.profiles.me.showcase.patch({ items })` → `router.refresh()`

- [ ] **Step 4: Insert in `ProfilePatronHeader`** between `ProfileTasteSignature` and stats row:

```tsx
<ProfileShowcaseStrip
  handle={handle}
  isMe={isMe}
  items={showcaseResolved}
  className="mt-4"
/>
```

- [ ] **Step 5: Manual verify**

1. Owner profile with legacy `favoriteMovieIds` → films appear in Showcase  
2. Add TV + review slot → persists on refresh  
3. Visitor public profile → sees strip; private profile → hidden  
4. Fifth slot rejected by API

---

### Task 5: Review reader "Add to showcase"

**Files:**
- Modify: `apps/web/src/components/review/review-detail-sheet.tsx`

- [ ] **Step 1:** When `isOwner && showcaseFilledCount < 4`, show handle action **Add to showcase**
- [ ] **Step 2:** On tap, `PATCH` append `{ kind: "review", id: reviewId }` (or open edit sheet)
- [ ] **Step 3:** Toast confirmation; refresh profile payload
- [ ] **Step 4:** `recordProductEvent` via client POST if not already server-side
- [ ] **Step 5:** Manual verify from review reader

---

## Wave 1b — Post-log micro-moment

### Task 6: Celebration strip in Quick Log

**Files:**
- Create: `apps/web/src/components/log/quick-log-celebration-strip.tsx`
- Modify: `apps/web/src/components/log/quick-log-sheet.tsx`

- [ ] **Step 1: Add `transitions-dev` `:root` block** to `packages/ui/src/styles/globals.css` if not present (copy from `packages/db/.agents/skills/transitions-dev/SKILL.md`)

- [ ] **Step 2: Build strip component**

```tsx
"use client";

/** Inline post-log ritual — rating pop-in + review CTA (not a modal). */
export function QuickLogCelebrationStrip({
  ratingTenths,
  onWriteReview,
  onDismiss,
}: {
  ratingTenths: number | null;
  onWriteReview: () => void;
  onDismiss: () => void;
}) {
  // number pop-in on rating via t-digit classes
  // SegmentedPillToolbar track: "Write a review" pill
  // recordProductEvent("post_log.celebrate") on mount
}
```

- [ ] **Step 3: Wire in `quick-log-sheet.tsx`** — after successful **POST** (not PATCH edit):
  - Set local state `celebrationLogId`
  - Render strip below form footer
  - `onWriteReview` → close quick log + open review composer with inherited rating
  - `prefers-reduced-motion`: skip digit animation

- [ ] **Step 4: Manual verify** — log film with rating → strip appears → review CTA opens composer

- [ ] **Step 5: Run web typecheck** — `cd apps/web && bun run check-types`

---

### Task 7: Diary year/decade chips

**Files:**
- Modify diary lobby filter row component (locate via `grep diary.*filter` in `apps/web/src/components/diary/`)
- Modify diary query param parser if needed

- [ ] **Step 1:** Add `year` and `decade` query params to diary lobby URL builder
- [ ] **Step 2:** Render chips in filter row (`SegmentedPillToolbar` or chip links matching `/home` patterns)
- [ ] **Step 3:** Server/RSC diary fetch respects new filters
- [ ] **Step 4:** Empty state when filtered decade has no logs
- [ ] **Step 5:** Manual verify on `/diary`

---

## Wave 1c — Viral reviews

### Task 8: `GET /api/reviews/viral`

**Files:**
- Create: `apps/server/src/lib/viral-reviews-query.ts`
- Create: `apps/server/src/lib/viral-reviews-query.test.ts`
- Modify: `apps/server/src/routes/reviews.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, expect, test } from "bun:test";
import { isViralReviewCandidate } from "./viral-reviews-query";

describe("isViralReviewCandidate", () => {
  test("allows short body", () => {
    expect(isViralReviewCandidate({ body: "white boys in crop tops again", title: null })).toBe(true);
  });
  test("allows title-only", () => {
    expect(isViralReviewCandidate({ body: "", title: "Perfect" })).toBe(true);
  });
  test("rejects long body", () => {
    expect(isViralReviewCandidate({ body: "x".repeat(281), title: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Implement filter + query** using `reviewEngagementOrderSql()` and `withinCommunityPeriod`
- [ ] **Step 3: Add route** `GET /viral?period=week&limit=6`
- [ ] **Step 4: Tests pass** — `cd apps/server && bun test src/lib/viral-reviews-query.test.ts`
- [ ] **Step 5: Manual API check** — `curl` with session cookie returns ≤6 rows

---

### Task 9: `HomeViralReviewsRail`

**Files:**
- Create: `apps/web/src/components/home/home-viral-reviews-rail.tsx`
- Modify: `apps/web/src/lib/home-community-core-fetch.ts` (prefetch seed)
- Modify: Community lobby layout component

- [ ] **Step 1:** Rail UI — 6 compact `ReviewCard` variants with **like count** prominent (`tabular-nums`)
- [ ] **Step 2:** Subsection title **"Most liked reviews"** + period from community toolbar
- [ ] **Step 3:** Tap → `useReviewDetail().open()`; `recordProductEvent("viral_review.tapped")`
- [ ] **Step 4:** Mount on `browse=community` above or within reviews feed
- [ ] **Step 5:** Add **"Most liked"** sort chip to `home-community-*` toolbar (client URL state)

---

## Wave 2a — Journal MVP

### Task 10: `journal_post` schema + public routes

**Files:**
- Create: `packages/db/src/migrations/0029_journal_post.sql`
- Create: `packages/db/src/schema/journal.ts`
- Create: `apps/server/src/routes/journal.ts`
- Modify: `apps/server/src/index.ts` (register route)

- [ ] **Step 1: Migration**

```sql
CREATE TABLE IF NOT EXISTS "journal_post" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "dek" text,
  "body" text NOT NULL,
  "hero_image_url" text,
  "author_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'draft',
  "published_at" timestamp,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "journal_post_status_published_at_idx"
  ON "journal_post" ("status", "published_at" DESC);
```

- [ ] **Step 2: Elysia routes**
  - `GET /api/journal` — published list, paginated
  - `GET /api/journal/:slug` — published detail only (404 for draft)
  - `POST/PATCH/DELETE /api/journal/*` — staff-only (reuse staff permission guard)

- [ ] **Step 3: Web public pages** under `apps/web/src/app/journal/` (NOT inside `(app)`)
  - `generateMetadata` with `robots: { index: true }` when published
  - Add `/journal` to `isShareableAppPath` / sitemap

- [ ] **Step 4: OG route** `apps/web/src/app/og/journal/[slug]/route.tsx` — hero + title + Sense mark (mirror `og/taste` layout)

- [ ] **Step 5: Seed 4 articles** via staff panel or SQL seed script; verify incognito 200

---

### Task 11: Staff journal panel + home rail

**Files:**
- Create: `apps/web/src/components/staff/staff-journal-panel.tsx`
- Create: `apps/web/src/components/home/home-journal-rail.tsx`
- Modify: `apps/web/src/components/staff/staff-content-actions.tsx` or staff tabs

- [ ] **Step 1:** Staff form — title, slug, dek, hero URL, body textarea (Markdown), tags, status, publish button
- [ ] **Step 2:** `HomeJournalRail` — latest 3 published, horizontal scroll, link to `/journal/[slug]`
- [ ] **Step 3:** Add **Journal** nav item (desktop + mobile discover)
- [ ] **Step 4:** `recordProductEvent("journal.read")` on article page view
- [ ] **Step 5:** Manual verify staff publish → rail updates

---

## Wave 2b — Members directory

### Task 12: Members leaderboard API

**Files:**
- Create: `apps/server/src/lib/members-leaderboard-query.ts`
- Create: `apps/server/src/lib/members-leaderboard-query.test.ts`
- Create: `apps/server/src/routes/members.ts`

- [ ] **Step 1: Tests for sort dimensions**

```typescript
describe("membersLeaderboardSort", () => {
  test("popular counts diary logs in window", () => { /* fixture */ });
  test("excludes private profiles", () => { /* fixture */ });
});
```

- [ ] **Step 2: Implement query** — sorts: `popular` | `reviews` | `lists` | `likes`
  - Reuse `resolveLeaderboardWindow` from `leaderboard-period.ts`
  - Join `profile` + `user`; filter `profile.visibility = 'public'` (or `canViewProfile` helper)
  - Return paginated rows with `diaryMetalTier`, follow state for viewer

- [ ] **Step 3: `GET /api/members/leaderboard`**

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: curl verification**

---

### Task 13: `/members` page

**Files:**
- Create: `apps/web/src/app/(app)/members/page.tsx`
- Create: `apps/web/src/components/members/members-leaderboard.tsx`

- [ ] **Step 1:** Page shell with `HomeStickyChrome`; title **Members**
- [ ] **Step 2:** Sort toolbar (4 dimensions) + `HomeCommunityPeriodToolbar` on the right
- [ ] **Step 3:** Rows — `PatronPortraitWithMetalTier`, name, @handle, stat, Follow button
- [ ] **Step 4:** `useLobbyTransition` / prefetch on sort change; empty state centered
- [ ] **Step 5:** `recordProductEvent("members.followed")` on follow from row

---

## Wave 2c — Detail social proof counts

### Task 14: Watches + watchlist counts on detail

**Files:**
- Create: `apps/server/src/lib/listing-community-stats.ts`
- Modify: `apps/server/src/routes/movies.ts`, `apps/server/src/routes/tv.ts`
- Modify: `apps/web/src/components/movie/movie-detail-community-rating-hero.tsx`

- [ ] **Step 1: Server helper** — aggregate public diary logs count (distinct patrons) + watchlist rows count; return `null` when &lt;3 (privacy threshold)

- [ ] **Step 2: Extend `community` object** — `watchesCount`, `watchlistCount`

- [ ] **Step 3: UI** — compact meta line: `{watchesCount} watches · {watchlistCount} on watchlists` with `tabular-nums`

- [ ] **Step 4: TV parity** on `tv/[id]`

- [ ] **Step 5: Tests + manual verify on film with known logs

---

## Wave 3a — Year in Review / Wrapped

### Task 15: `computeYearInReview`

**Files:**
- Create: `apps/server/src/lib/year-in-review.ts`
- Create: `apps/server/src/lib/year-in-review.test.ts`

- [ ] **Step 1: Tests with fixture logs** — sparse year (&lt;5 logs → `eligible: false`), dense year (top genres, busiest month, top 5 titles)

- [ ] **Step 2: Implement compute** — UTC year window on `log.watchedAt`; genre/decade from cached `movie`/`tv` metadata; avg rating via `logRatingToDisplay` rules

- [ ] **Step 3: `GET /api/me/year/:year`** — auth-only; returns computed JSON

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Document response shape in spec appendix (inline comment in module)

---

### Task 16: Wrapped pages + OG

**Files:**
- Create: `apps/web/src/app/(app)/me/year/[year]/page.tsx`
- Create: `apps/web/src/app/og/year/[handle]/[year]/route.tsx`
- Create: `apps/web/src/components/achievements/year-in-review-card.tsx`

- [ ] **Step 1: Year page** — hero stats, top posters grid, share row (copy link + download OG preview)

- [ ] **Step 2: OG route** — Wrapped layout (1200×630): avatar, handle, year, 3 headline stats, 2–3 poster thumbs; private profile → redirect fetch to `/og/default`

- [ ] **Step 3: Achievements card** — `Your {year} in film` linking to year page

- [ ] **Step 4: Events** — `wrapped.viewed` on page mount, `wrapped.shared` on copy/download

- [ ] **Step 5: Manual share test — copy link previews correctly in iMessage/slack

---

## Wave 3b — Streaming availability alerts

### Task 17: Provider snapshot + diff job

**Files:**
- Create: `packages/db/src/migrations/0030_watchlist_streaming_snapshot.sql`
- Create: `apps/server/src/lib/watchlist-streaming-alerts.ts`
- Create: `apps/server/src/lib/watchlist-streaming-alerts.test.ts`

- [ ] **Step 1: Snapshot table** — `(user_id, movie_id|tv_id, region, providers_json, checked_at)`

- [ ] **Step 2: Diff function** — compare today's providers vs snapshot; emit newly available titles

- [ ] **Step 3: Notification insert** — kind `watchlist_now_streaming`, payload with `notificationPayloadHref` to detail

- [ ] **Step 4: Cron entry point** — `apps/server/src/jobs/` or Trigger.dev task (match existing job patterns); daily run

- [ ] **Step 5: Test fixture** — Netflix added → one notification; toggle off → none

---

### Task 18: Settings toggle + watchlist pill

**Files:**
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`
- Modify: `apps/server/src/lib/notification-kinds.ts` (or equivalent)
- Modify: watchlist tile component

- [ ] **Step 1:** Preference `preferences.watchlistStreamingAlerts` default **true**

- [ ] **Step 2:** Settings copy — **Notify when watchlisted titles stream near me**

- [ ] **Step 3:** Watchlist tile pill **Now on {service}** when providers include patron region services

- [ ] **Step 4:** Pro-only email via `send-email.ts` on new availability

- [ ] **Step 5:** Manual verify with dev fixture

---

## Wave 3c — Motion polish pass

### Task 19: Apply `transitions-dev` to new surfaces

**Files:**
- Modify: `profile-showcase-strip.tsx`, `quick-log-celebration-strip.tsx`, review like button, journal article page, year page share button

- [ ] **Step 1: Showcase row** — `t-avatar` group hover on poster strip (see `11-avatar-group-hover.md`)

- [ ] **Step 2: Post-log rating** — `t-digit` number pop-in (see `02-number-pop-in.md`)

- [ ] **Step 3: Review like** — `t-icon-swap` on heart toggle (see `09-icon-swap.md`)

- [ ] **Step 4: Journal hero** — `t-panel` reveal on article mount (see `07-panel-reveal.md`)

- [ ] **Step 5: Wrapped share** — `t-success-check` on copy (see `10-success-check.md`); all snippets include `prefers-reduced-motion` guards

---

## Wave 4 — Catalogue stat + list polish

### Task 20: Catalogue stat line

**Files:**
- Create: `apps/web/src/lib/catalogue-stats.ts`
- Modify: home movies/TV lobby headers

- [ ] **Step 1: Server or cached fetch** — total cached `movie` + `tv` row counts (daily revalidate)

- [ ] **Step 2: Display** — `{N} films · {M} shows in Sense` under lobby title

- [ ] **Step 3: Verify** — counts render on `/home?browse=movies` and `browse=tv`

---

### Task 21: List discovery polish (Pillars 4–5)

**Files:**
- Modify: Community lists subsection header
- Modify: list detail hero title classes
- Modify: list share handler

- [ ] **Step 1: Lists feed** — subsection shows total count: **{n} popular lists**

- [ ] **Step 2: List detail** — `text-balance font-semibold` on title at hero scale

- [ ] **Step 3: Share toast** — `Copied link · {listTitle}`

- [ ] **Step 4: Audit discovery copy** — grep for "Recommended for you"; replace with explicit source labels per spec

- [ ] **Step 5: Update `whats-new-releases.ts` + `product-changelog.ts`** when shipping bundle

---

## Spec coverage checklist (self-review)

| Spec section | Task(s) |
|--------------|---------|
| Wave 0 migration + events | 1–2 |
| Pillar 1 Showcase | 3–5 |
| Pillar 2 Post-log + diary chips | 6–7 |
| Pillar 3 Viral reviews | 8–9 |
| Pillar 4 List polish | 21 |
| Pillar 5 Discovery copy | 21 |
| Pillar 6 Detail counts | 14 |
| Pillar 7 Catalogue stat | 20 |
| Pillar 8 Journal | 10–11 |
| Pillar 9 Wrapped | 15–16 |
| Pillar 10 Motion | 19 |
| Pillar 11 Members | 12–13 |
| Pillar 12 Streaming alerts | 17–18 |

**Non-goals confirmed omitted:** histogram, patron journal posts, algorithmic feed replacement, showcase↔hearts sync.

---

## Suggested execution order (single executor)

1. Tasks 1–2 (Wave 0)  
2. Tasks 3–5 (Showcase — highest identity impact)  
3. Tasks 8–9 (Viral reviews — parallel-friendly)  
4. Tasks 6–7 (Post-log ritual)  
5. Tasks 12–13 (Members)  
6. Tasks 10–11 (Journal — longest pole)  
7. Task 14 (Detail counts)  
8. Tasks 15–16 (Wrapped)  
9. Tasks 17–18 (Streaming alerts)  
10. Tasks 19–21 (Polish + catalogue)

---

## Human verification milestones

| Milestone | Tasks | Sign-off |
|-----------|-------|----------|
| M0 Wave 0 | 1–2 | Migration + events in dev |
| M1 Identity showcase | 3–5 | Profile shows 4-slot Showcase |
| M2 Social virality | 8–9, 12–13 | Viral rail + Members page live |
| M3 Ritual | 6–7, 14 | Post-log strip + detail counts |
| M4 Platform | 10–11, 17–18 | Journal public + streaming alert fixture |
| M5 Wrapped | 15–16 | Share OG works |
| M6 Polish | 19–21 | Motion + changelog shipped |
