# Taste Rail — “Not Interested” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons permanently dismiss taste-matched films via a radial **Not interested** wedge and instantly swap in the next server-scored replacement.

**Architecture:** New `taste_dismissed_movie` table feeds exclusions in `buildTasteMatchedDiscovery`. `POST /api/taste/dismiss` persists + returns `replacement`. Taste rails use `surface="taste-rail"` on `CataloguePosterTile`; `HomeTasteMatchedRail` owns optimistic dismiss state and motion.

**Tech Stack:** Drizzle migration, Elysia route, Eden `api.api.taste.dismiss`, Bun tests, `motion/react`, existing `RadialToolkit` / `catalogue-radial-items.ts`.

**Spec:** `docs/superpowers/specs/2026-06-06-taste-rail-not-interested-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema/taste-dismissed-movie.ts` | Drizzle table |
| `packages/db/src/migrations/0020_taste_dismissed_movie.sql` | SQL migration |
| `packages/db/src/schema/index.ts` | Re-export |
| `apps/server/src/lib/taste-dismissed-movie.ts` | Fetch ids, insert dismiss, pick replacement |
| `apps/server/src/lib/taste-matched-discovery.ts` | Exclude dismissed ids |
| `apps/server/src/lib/taste-dismissed-movie.test.ts` | Unit tests |
| `apps/server/src/routes/taste.ts` | `POST /dismiss` |
| `apps/web/src/lib/catalogue-radial-items.ts` | `"taste-rail"` surface + `not-interested` slot |
| `apps/web/src/lib/catalogue-radial-items.test.ts` | Spec order tests |
| `apps/web/src/components/catalogue/catalogue-poster-tile.tsx` | Handler + icon wiring |
| `apps/web/src/components/home/home-taste-matched-rail.tsx` | Dismiss state + motion |

---

### Task 1: Database schema + migration

**Files:**
- Create: `packages/db/src/schema/taste-dismissed-movie.ts`
- Create: `packages/db/src/migrations/0020_taste_dismissed_movie.sql`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/migrations/meta/_journal.json` (add `0020` entry)

- [ ] **Step 1: Add schema**

```ts
// packages/db/src/schema/taste-dismissed-movie.ts
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Patron-blocked taste-rail suggestions (forever, until Settings UI ships). */
export const tasteDismissedMovie = pgTable(
  "taste_dismissed_movie",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    movieTmdbId: integer("movie_tmdb_id").notNull(),
    dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("taste_dismissed_movie_user_movie_uk").on(
      table.userId,
      table.movieTmdbId,
    ),
    index("taste_dismissed_movie_user_idx").on(table.userId),
  ],
);
```

- [ ] **Step 2: SQL migration** (mirror other migrations)

```sql
CREATE TABLE IF NOT EXISTS "taste_dismissed_movie" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "movie_tmdb_id" integer NOT NULL,
  "dismissed_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "taste_dismissed_movie_user_movie_uk"
  ON "taste_dismissed_movie" ("user_id", "movie_tmdb_id");
CREATE INDEX IF NOT EXISTS "taste_dismissed_movie_user_idx"
  ON "taste_dismissed_movie" ("user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "taste_dismissed_movie" ADD CONSTRAINT "taste_dismissed_movie_user_id_user_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 3:** Export from `packages/db/src/schema/index.ts`.
- [ ] **Step 4:** Run migration in dev (`cd packages/db && bun run db:migrate` or project-standard migrate command).

**Success:** Table exists; `tasteDismissedMovie` importable from `@still/db`.

---

### Task 2: Server helpers — exclusions + dismiss (TDD)

**Files:**
- Create: `apps/server/src/lib/taste-dismissed-movie.ts`
- Modify: `apps/server/src/lib/taste-matched-discovery.ts`
- Create: `apps/server/src/lib/taste-dismissed-movie.test.ts`

- [ ] **Step 1: Write failing tests** for pure helpers (mock-free where possible):

```ts
// taste-dismissed-movie.test.ts — test pickNextTasteMatchCandidate
import { describe, expect, test } from "bun:test";
import { pickNextTasteMatchCandidate } from "./taste-dismissed-movie";

describe("pickNextTasteMatchCandidate", () => {
  test("returns highest-scored row not in exclude sets", () => {
    const profile = /* minimal TasteProfile fixture */;
    const candidates = [
      { tmdbId: 1, score: 10, row: { tmdbId: 1, title: "A", posterPath: null, year: 2020 } },
      { tmdbId: 2, score: 20, row: { tmdbId: 2, title: "B", posterPath: null, year: 2021 } },
    ];
    const next = pickNextTasteMatchCandidate(candidates, {
      excludeTmdbIds: new Set([2]),
    });
    expect(next?.tmdbId).toBe(1);
  });

  test("returns null when all candidates excluded", () => {
    const next = pickNextTasteMatchCandidate(candidates, {
      excludeTmdbIds: new Set([1, 2]),
    });
    expect(next).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `cd apps/server && bun test src/lib/taste-dismissed-movie.test.ts` — expect FAIL.

- [ ] **Step 3: Implement** `apps/server/src/lib/taste-dismissed-movie.ts`:

```ts
export async function fetchDismissedMovieTmdbIds(userId: string): Promise<number[]> { /* db select */ }

export async function dismissTasteMovie(args: {
  userId: string;
  movieTmdbId: number;
  excludeTmdbIds?: number[];
}): Promise<{ dismissedTmdbId: number; replacement: TasteMatchMovie | null }> {
  // upsert dismiss row (ignore conflict)
  // score candidates via shared taste profile builder
  // return replacement via pickNextTasteMatchCandidate
}
```

Refactor `buildTasteMatchedDiscovery` to call `fetchDismissedMovieTmdbIds` and merge with `loggedIds` in `notInArray`.

- [ ] **Step 4: Run tests** — PASS.

**Success:** Dismissed ids excluded from discovery; replacement picker tested.

---

### Task 3: `POST /api/taste/dismiss` route

**Files:**
- Modify: `apps/server/src/routes/taste.ts`

- [ ] **Step 1: Add route**

```ts
.post(
  "/dismiss",
  async ({ user, body, status }) => {
    if (!user) return status(401, "Sign in");
    if (!hit(`taste:dismiss:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
      return status(429, "Slow down");
    }
    if (!Number.isInteger(body.movieTmdbId) || body.movieTmdbId <= 0) {
      return status(400, "Invalid movie id");
    }
    return dismissTasteMovie({
      userId: user.id,
      movieTmdbId: body.movieTmdbId,
      excludeTmdbIds: body.excludeTmdbIds,
    });
  },
  {
    body: t.Object({
      movieTmdbId: t.Number(),
      excludeTmdbIds: t.Optional(t.Array(t.Number())),
    }),
  },
)
```

- [ ] **Step 2:** Optional `product_event` insert kind `taste.dismissed`.
- [ ] **Step 3:** Manual curl / Eden smoke: signed-in POST returns `replacement`.

**Success:** Route registered; 401/429/400 behave correctly.

---

### Task 4: Radial spec — `taste-rail` surface (TDD)

**Files:**
- Modify: `apps/web/src/lib/catalogue-radial-items.ts`
- Modify: `apps/web/src/lib/catalogue-radial-items.test.ts`

- [ ] **Step 1: Write failing test**

```ts
test("taste-rail adds Not interested after add-to-list", () => {
  const specs = buildCatalogueRadialItemSpecs({
    surface: "taste-rail",
    listingKind: "movie",
    signedIn: true,
  });
  expect(specIds(specs)).toEqual([
    "open",
    "copy",
    "quick-log",
    "watchlist",
    "add-to-list",
    "not-interested",
  ]);
  expect(specs.find((s) => s.id === "not-interested")?.variant).toBe("destructive");
});

test("home surface does not include not-interested", () => {
  const specs = buildCatalogueRadialItemSpecs({
    surface: "home",
    listingKind: "movie",
    signedIn: true,
  });
  expect(specIds(specs)).not.toContain("not-interested");
});
```

- [ ] **Step 2: Run** `cd apps/web && bun test src/lib/catalogue-radial-items.test.ts` — FAIL.

- [ ] **Step 3: Implement**

```ts
export type CatalogueRadialSurface = "home" | "diary" | "watchlist" | "taste-rail";

// In buildCatalogueRadialItemSpecs:
const isTasteRail = surface === "taste-rail";
const catalogueSurface = isTasteRail ? "home" : surface;
// ... build home slots using catalogueSurface for home/watchlist branches ...

if (isTasteRail) {
  specs.push({
    id: "not-interested",
    label: "Not interested",
    shortcut: "N",
    variant: "destructive",
  });
}
```

Add `"not-interested"` to `SLOT_ORDER` after `"add-to-list"`.

- [ ] **Step 4: Run tests** — PASS.

**Success:** Taste rail spec includes slot; home does not.

---

### Task 5: `CataloguePosterTile` wiring

**Files:**
- Modify: `apps/web/src/components/catalogue/catalogue-poster-tile.tsx`

- [ ] **Step 1: Extend props**

```ts
onNotInterested?: (tmdbId: number) => void | Promise<void>;
```

- [ ] **Step 2: Handler map**

```ts
"not-interested": () => {
  if (!onNotInterested) return;
  onOpenChange(false);
  void onNotInterested(tmdbId);
},
```

- [ ] **Step 3: Icon** — reuse `IconTrashXmarkFill` or add thumb-down Nucleo icon; destructive variant already styled by `RadialToolkit`.

- [ ] **Step 4:** Gate `not-interested` behind `signedIn && onNotInterested` (spec already taste-rail only).

**Success:** RMB on taste-rail tile shows **Not interested**; release calls parent.

---

### Task 6: `HomeTasteMatchedRail` dismiss flow

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-rail.tsx`

- [ ] **Step 1: Stateful movies list**

```ts
const [movies, setMovies] = useState<TasteMatchMovie[]>(
  () => (initial && !initial.coldStart ? initial.movies : []),
);
```

- [ ] **Step 2: `handleNotInterested`**

```ts
const handleNotInterested = useCallback(async (tmdbId: number) => {
  const index = movies.findIndex((m) => m.tmdbId === tmdbId);
  if (index < 0) return;
  const snapshot = movies;
  setMovies((prev) => prev.filter((m) => m.tmdbId !== tmdbId));
  try {
    const res = await api.api.taste.dismiss.post({
      movieTmdbId: tmdbId,
      excludeTmdbIds: snapshot.map((m) => m.tmdbId),
    });
    if (res.error || !res.data) throw new Error("dismiss failed");
    const { replacement } = res.data;
    setMovies((prev) => {
      const next = [...prev];
      if (replacement && !next.some((m) => m.tmdbId === replacement.tmdbId)) {
        next.splice(Math.min(index, next.length), 0, replacement);
      }
      return next;
    });
  } catch {
    setMovies(snapshot);
    toast.error("Couldn't update suggestions");
  }
}, [movies]);
```

- [ ] **Step 3: Wire tile**

```tsx
<CataloguePosterTile
  surface="taste-rail"
  onNotInterested={handleNotInterested}
  /* existing props */
/>
```

- [ ] **Step 4: Motion** — wrap cells in `motion.div` with `AnimatePresence` + `layout`; `opacity` exit/enter 150ms; `useReducedMotion` → instant.

- [ ] **Step 5: Hide rail** when `movies.length < TASTE_MATCH_MIN_RESULTS` (import constant from shared lib or duplicate `6` with comment).

**Success:** Dismiss swaps tile; refresh excludes dismissed title.

---

### Task 7: Verification

- [ ] **Step 1:** `cd apps/server && bun test src/lib/taste-dismissed-movie.test.ts src/lib/taste-matched-discovery.test.ts`
- [ ] **Step 2:** `cd apps/web && bun test src/lib/catalogue-radial-items.test.ts`
- [ ] **Step 3:** `cd apps/web && bun run check-types`
- [ ] **Step 4:** Manual — `/home?browse=movies&sort=latest` taste rail dismiss + refresh
- [ ] **Step 5:** Confirm main catalogue radial has **no** Not interested
- [ ] **Step 6:** `graphify update .`

**Success:** Tests green; manual flow matches spec.

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| `taste_dismissed_movie` table | Task 1 |
| Exclude dismissed in discovery | Task 2 |
| `POST /api/taste/dismiss` + replacement | Task 2–3 |
| `surface="taste-rail"` only | Task 4–6 |
| Radial **Not interested** wedge | Task 4–5 |
| Instant optimistic swap | Task 6 |
| Error restore + toast | Task 6 |
| Hide rail &lt; 6 titles | Task 6 |
| No Settings UI | — (deferred) |
| Future rails pattern documented | Spec only |
