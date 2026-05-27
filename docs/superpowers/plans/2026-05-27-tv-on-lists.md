# TV on Lists — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons add TV shows to personal lists everywhere films work, with correct lobby covers and split picker meta lines (`8 films · 4 shows · Private`, empty `0 titles · Private`).

**Architecture:** Extend existing movie-only paths: DB columns for split counts + TV cover ids; `refreshListAggregates` becomes the single write-time reconciler; lists API accepts XOR `movieId`/`tvId` like watchlist; web `AddToListMedia` unifies hero + radial pickers.

**Tech Stack:** Drizzle migrations (`packages/db`), Elysia lists routes (`apps/server`), Next.js client components (`apps/web`), Vitest, `bun test` / `bun run build`.

**Spec:** `docs/superpowers/specs/2026-05-27-tv-on-lists-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema/list.ts` | `coverTvIds`, `movieItemsCount`, `tvItemsCount` columns |
| `packages/db/src/migrations/0008_list_tv_items.sql` | Migration SQL |
| `apps/server/src/lib/favorites-list-sync.ts` | `refreshListAggregates` — counts + covers + TV |
| `apps/server/src/lib/list-cover-posters.ts` | Ordered poster paths (movies + TV) |
| `apps/server/src/lib/list-display-cover.ts` | Optional slot-order helper |
| `apps/server/src/routes/lists.ts` | POST/DELETE/me TV support, `ensureTvCached` |
| `apps/web/src/lib/list-board-row.ts` | `containsTitle`, split counts |
| `apps/web/src/lib/list-meta-line.ts` | `formatListMetaLine` (testable) |
| `apps/web/src/lib/list-meta-line.test.ts` | Meta line unit tests |
| `apps/web/src/lib/still-api-fetch.ts` | `fetchListsMe({ movieId \| tvId })` |
| `apps/web/src/components/list/add-to-list-control.tsx` | `AddToListMedia` |
| `apps/web/src/components/list/add-to-list-picker.tsx` | Use `formatListMetaLine` |
| `apps/web/src/components/catalogue/use-add-to-list-radial.tsx` | `AddToListMedia` |
| `apps/web/src/components/catalogue/catalogue-poster-tile.tsx` | Pass `listingKind` into radial hook |
| `apps/web/src/components/tv/tv-detail-primary-actions.tsx` | Wire `AddToListControl` |
| `apps/web/src/components/movie/movie-detail-primary-actions.tsx` | New `AddToListControl` props |
| `apps/web/src/lib/catalogue-radial-items.ts` | TV add-to-list slots |
| `apps/web/src/lib/catalogue-radial-items.test.ts` | Updated expectations |
| `AGENTS.md` | Remove “TV tiles omit Add to list” caveat |

---

### Task 1: Database migration

**Files:**
- Modify: `packages/db/src/schema/list.ts`
- Create: `packages/db/src/migrations/0008_list_tv_covers_and_counts.sql`

- [ ] **Step 1: Add columns to `list` table**

```ts
coverTvIds: jsonb("cover_tv_ids").$type<number[]>().default([]).notNull(),
movieItemsCount: integer("movie_items_count").default(0).notNull(),
tvItemsCount: integer("tv_items_count").default(0).notNull(),
```

- [ ] **Step 2: Write SQL migration** matching Drizzle snapshot (follow `0007_system_favorites_list.sql` style).

- [ ] **Step 3: Apply migration locally**

```bash
cd packages/db && bun run db:migrate
```

Expected: migration applies without error.

---

### Task 2: `refreshListAggregates` (server core)

**Files:**
- Modify: `apps/server/src/lib/favorites-list-sync.ts`
- Modify: `apps/server/src/routes/lists.ts` (replace inline count/cover SQL with shared helper calls)

- [ ] **Step 1: Rewrite `refreshListAggregates(listId)`**

Logic:

1. Count `movieItemsCount` / `tvItemsCount` via `count(*) filter (where movie_id is not null)` etc.
2. Set `itemsCount = movieItemsCount + tvItemsCount`.
3. Fetch up to 4 recent `list_item` rows (`orderBy desc addedAt`) with `movieId` and `tvId`.
4. Set `coverMovieIds` / `coverTvIds` from those rows (ids only, order preserved per kind arrays OR store slot order — see Task 3).
5. `update list set ... where id = listId`.

- [ ] **Step 2: Call `refreshListAggregates`** from POST item, DELETE movie item, DELETE tv item (new route), and keep favorites sync path.

- [ ] **Step 3: Remove duplicate inline SQL** in `lists.ts` that only aggregates `movie_id` for covers/counts.

---

### Task 3: Cover poster hydration (ordered strip)

**Files:**
- Modify: `apps/server/src/lib/list-cover-posters.ts`
- Optionally modify: `apps/server/src/lib/list-display-cover.ts`

- [ ] **Step 1: Batch-load recent items** for all list rows passed to `withCoverPosterPaths`:

```ts
// Pseudocode: for listIds[], select list_item ordered by added_at desc,
// take first 4 per listId, join movie + tv poster_path
```

- [ ] **Step 2: Build `coverPosterPaths: (string | null)[]`** in **item order** (not `coverMovieIds` order alone).

- [ ] **Step 3: Keep `listDisplayCoverMovieIds`** for pinned `coverMovieId` only when no custom image — document that strip uses item-order paths.

- [ ] **Step 4: Smoke** — list with 2 TV + 2 film items returns 4 poster paths on `GET /api/lists/me`.

---

### Task 4: Lists API — write + membership

**Files:**
- Modify: `apps/server/src/routes/lists.ts`
- Import: `ensureTvCached` from existing TV cache helper (same as `watchlist.ts`)

- [ ] **Step 1: Extend `AddListItemBody`**

```ts
type AddListItemBody = {
  movieId?: number;
  tvId?: number;
  position?: number;
  note?: string;
};
```

- [ ] **Step 2: POST `/:id/items`**

- Validate exactly one of `movieId` / `tvId`.
- If `tvId`: `await ensureTvCached(tvId)`.
- Insert `{ movieId: body.movieId ?? null, tvId: body.tvId ?? null, ... }`.
- `onConflictDoNothing()`; then `refreshListAggregates(params.id)`.
- Elysia body: optional `movieId`, optional `tvId` (both optional in schema, validated in handler).

- [ ] **Step 3: GET `/me`**

- Accept `tvId` query param (mutually exclusive with `movieId`).
- Membership query: `eq(listItem.tvId, tvId)` when tv.
- Return `containsTitle: boolean` (and `containsMovie` alias = same value for one release).

- [ ] **Step 4: DELETE `/:id/items/tv/:tvId`**

Mirror movie delete; call `refreshListAggregates`.

- [ ] **Step 5: Manual API check** (curl or REST client) — POST tv item, GET list detail shows `tv` join.

---

### Task 5: `listMetaLine` + `ListBoardRow` (TDD)

**Files:**
- Create: `apps/web/src/lib/list-meta-line.ts`
- Create: `apps/web/src/lib/list-meta-line.test.ts`
- Modify: `apps/web/src/lib/list-board-row.ts`
- Modify: `apps/web/src/components/list/add-to-list-picker.tsx`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, test } from "vitest";
import { formatListMetaLine } from "./list-meta-line";

const priv = { isPublic: false };

describe("formatListMetaLine", () => {
  test("empty", () => {
    expect(
      formatListMetaLine({ movieItemsCount: 0, tvItemsCount: 0, ...priv }),
    ).toBe("0 titles · Private");
  });
  test("films only plural", () => {
    expect(
      formatListMetaLine({ movieItemsCount: 12, tvItemsCount: 0, ...priv }),
    ).toBe("12 films · Private");
  });
  test("one film", () => {
    expect(
      formatListMetaLine({ movieItemsCount: 1, tvItemsCount: 0, ...priv }),
    ).toBe("1 film · Private");
  });
  test("shows only", () => {
    expect(
      formatListMetaLine({ movieItemsCount: 0, tvItemsCount: 4, ...priv }),
    ).toBe("4 shows · Private");
  });
  test("mixed", () => {
    expect(
      formatListMetaLine({ movieItemsCount: 8, tvItemsCount: 4, ...priv }),
    ).toBe("8 films · 4 shows · Private");
  });
});
```

- [ ] **Step 2: Run** `cd apps/web && bun test src/lib/list-meta-line.test.ts` — FAIL.

- [ ] **Step 3: Implement `formatListMetaLine`**

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Update `toListBoardRow`** — map `movieItemsCount`, `tvItemsCount`, `containsTitle`; default counts to `0`.

- [ ] **Step 6: Picker** — replace inline `listMetaLine` with `formatListMetaLine(list)`.

---

### Task 6: `fetchListsMe` + API client types

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Change signature**

```ts
export async function fetchListsMe(
  media?: { listingKind: "movie" | "tv"; tmdbId: number },
  init?: Pick<RequestInit, "signal">,
) {
  const url = new URL("/api/lists/me", stillApiOrigin());
  if (media?.listingKind === "movie") {
    url.searchParams.set("movieId", String(media.tmdbId));
  } else if (media?.listingKind === "tv") {
    url.searchParams.set("tvId", String(media.tmdbId));
  }
  // ...
}
```

- [ ] **Step 2: Update all call sites** (`add-to-list-control`, `use-add-to-list-radial`).

---

### Task 7: Shared `AddToListControl` / radial hook

**Files:**
- Modify: `apps/web/src/components/list/add-to-list-control.tsx`
- Modify: `apps/web/src/components/catalogue/use-add-to-list-radial.tsx`
- Modify: `apps/web/src/components/movie/movie-detail-primary-actions.tsx`

- [ ] **Step 1: Introduce props**

```ts
export type AddToListMedia = {
  listingKind: "movie" | "tv";
  tmdbId: number;
  title: string;
};

type AddToListControlProps = {
  media: AddToListMedia;
  disabled?: boolean;
  layout?: boolean;
};
```

- [ ] **Step 2: `loadLists`** — `fetchListsMe(media)`.

- [ ] **Step 3: `addToList`** — POST `{ movieId }` or `{ tvId }`; check `containsTitle`; optimistic bump `movieItemsCount` or `tvItemsCount` + `itemsCount`; toast **Film** vs **Show**.

- [ ] **Step 4: Movie hero** — `<AddToListControl media={{ listingKind: "movie", tmdbId: movieId, title }} />`.

- [ ] **Step 5: `useAddToListRadial(media)`** — same mutations; export `openPicker` unchanged.

---

### Task 8: TV detail hero

**Files:**
- Modify: `apps/web/src/components/tv/tv-detail-primary-actions.tsx`

- [ ] **Step 1: Remove** `handleAddToList` toast.

- [ ] **Step 2: Import and render** `AddToListControl` with `listingKind: "tv"` (match movie hero layout / `LayoutGroup` if present).

- [ ] **Step 3: Manual** — `/tv/[id]` → Add to list → pick list → item appears on list detail.

---

### Task 9: Catalogue radial parity

**Files:**
- Modify: `apps/web/src/lib/catalogue-radial-items.ts`
- Modify: `apps/web/src/lib/catalogue-radial-items.test.ts`
- Modify: `apps/web/src/components/catalogue/catalogue-poster-tile.tsx`

- [ ] **Step 1: Remove `isMovie &&` guards** for `add-to-list` on home, diary, watchlist.

- [ ] **Step 2: Update tests** — TV home signed-in includes `add-to-list`; watchlist TV includes `add-to-list`.

- [ ] **Step 3: `catalogue-poster-tile`** — `useAddToListRadial({ listingKind, tmdbId, title })`.

- [ ] **Step 4: Run** `cd apps/web && bun test src/lib/catalogue-radial-items.test.ts src/lib/list-meta-line.test.ts`

---

### Task 10: Backfill + verify build

**Files:**
- Create (optional): `apps/server/src/scripts/refresh-list-aggregates.ts` one-off, OR document SQL

- [ ] **Step 1: One-off refresh** — loop all `list.id` and call `refreshListAggregates` (fixes Favorites covers + counts for existing TV rows).

```bash
# Example: bun run apps/server/src/scripts/refresh-list-aggregates.ts
```

- [ ] **Step 2: Typecheck / build**

```bash
cd apps/web && bun run build
```

Expected: no TS errors (delete `.next` if stale `RouteImpl` issues per AGENTS.md).

- [ ] **Step 3: Update `AGENTS.md`** — catalogue lobbies bullet: TV tiles include **Add to list**.

---

### Task 11: Manual QA (human)

- [ ] TV detail → add to new + existing list; checkmark when already on list.
- [ ] `/home` TV poster RMB → Add to list.
- [ ] `/watchlist` TV → Add to list.
- [ ] `/diary` TV group → Add to list.
- [ ] Mixed list picker meta: `N films · M shows · Private`.
- [ ] Empty list picker meta: `0 titles · Private`.
- [ ] `/lists` lobby card shows TV posters for TV-only list.
- [ ] Heart TV → Favorites list still syncs; picker does not offer Favorites.

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| POST XOR movie/tv | 4 |
| GET /me tvId + containsTitle | 4 |
| DELETE tv | 4 |
| Split counts on list | 1, 2 |
| Cover TV + order | 2, 3 |
| AddToListMedia UI | 7–9 |
| TV hero | 8 |
| Radial parity | 9 |
| listMetaLine rules incl. `0 titles` | 5 |
| Favorites unchanged in picker | 7 (filter `systemKind`) |
| Manual acceptance | 11 |

No placeholders remaining.

---

## Executor handoff

Human approved spec **2026-05-27**. Execute **one task at a time**; report after each task for verification (`ok` to continue) per project scratchpad workflow.
