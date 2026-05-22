# Community Watch Leaderboards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Film ranks and TV ranks under `/home` Community with period filters, tier-card podium, global public-profile leaderboard APIs, and a Vaul watch-ledger drawer on count tap.

**Architecture:** Live SQL aggregates on `log` joined to `profile` (public only), split by `movie_id` vs `tv_id`. Web extends community feed types + URL builders; server exposes four Elysia routes under `/api/leaderboard`. UI reuses Achievements lobby surfaces, `SegmentedPillToolbar`, `PatronPortraitAvatar`, and `DetailVaulSheet`.

**Tech Stack:** Drizzle ORM (`packages/db`), Elysia (`apps/server`), Next.js App Router + `motion/react` (`apps/web`), Bun tests.

**Spec:** `docs/superpowers/specs/2026-05-22-community-watch-leaderboard-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/lib/leaderboard-period.ts` | Create | Period window math (`week`/`month`/`year`/`all` + `tz`) |
| `apps/server/src/lib/leaderboard-period.test.ts` | Create | Boundary unit tests |
| `apps/server/src/lib/leaderboard-query.ts` | Create | Shared aggregate + rank SQL helpers |
| `apps/server/src/routes/leaderboard.ts` | Create | Four GET endpoints |
| `apps/server/src/app.ts` | Modify | `.use(leaderboardRoute)` |
| `apps/web/src/lib/home-community-feed.ts` | Modify | `film-ranks`, `tv-ranks` feed ids |
| `apps/web/src/lib/home-community-feed.test.ts` | Create | Parse + feed id tests |
| `apps/web/src/lib/home-leaderboard-period.ts` | Create | Client period type + labels |
| `apps/web/src/lib/home-leaderboard-period.test.ts` | Create | Parse/build tests |
| `apps/web/src/lib/home-lobby-url.ts` | Modify | Serialize `period` for rank feeds |
| `apps/web/src/lib/home-lobby-persist.ts` | Modify | Persist `period` under `community` |
| `apps/web/src/components/home/home-catalog-sort-chips.tsx` | Modify | Center chips; migrate `framer-motion` → `motion/react` in this file |
| `apps/web/src/components/home/home-leaderboard-period-toolbar.tsx` | Create | URL-backed period pills |
| `apps/web/src/components/home/home-leaderboard-podium.tsx` | Create | Tier-card top 3 |
| `apps/web/src/components/home/home-leaderboard-row.tsx` | Create | Rank row + pressable count |
| `apps/web/src/components/home/home-community-leaderboard.tsx` | Create | Compose podium + list + footer |
| `apps/web/src/components/home/patron-watch-ledger-drawer.tsx` | Create | Zustand + Vaul sheet |
| `apps/web/src/components/home/patron-watch-ledger-panel.tsx` | Create | Scrollable log list in drawer |
| `apps/web/src/components/home/home-community-lobby.tsx` | Modify | Branch for rank feeds |
| `apps/web/src/app/(app)/home/page.tsx` | Modify | Fetch leaderboard when rank feed active |
| `apps/web/src/app/(app)/layout.tsx` or `app-shell` | Modify | Mount `PatronWatchLedgerDrawerRoot` globally |
| `apps/web/src/lib/still-api-fetch.ts` | Modify | Client fetch helpers |
| `.cursor/scratchpad.md` | Modify | Track milestone (Executor) |

---

## Phase 1 — Server period + leaderboard API

### Task 1: Period window helper

**Files:**
- Create: `apps/server/src/lib/leaderboard-period.ts`
- Create: `apps/server/src/lib/leaderboard-period.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/server/src/lib/leaderboard-period.test.ts
import { describe, expect, test } from "bun:test";
import { resolveLeaderboardWindow } from "./leaderboard-period";

describe("resolveLeaderboardWindow", () => {
  test("month boundaries in Europe/Rome", () => {
    const now = new Date("2026-05-15T12:00:00Z");
    const w = resolveLeaderboardWindow("month", "Europe/Rome", now);
    expect(w.start.toISOString()).toBe("2026-04-30T22:00:00.000Z"); // May 1 00:00 Rome
    expect(w.end > w.start).toBe(true);
  });

  test("all time has no finite start", () => {
    const w = resolveLeaderboardWindow("all", "UTC", new Date());
    expect(w.start.getTime()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/server && bun test src/lib/leaderboard-period.test.ts
```

- [ ] **Step 3: Implement**

```ts
// apps/server/src/lib/leaderboard-period.ts
export type LeaderboardPeriod = "week" | "month" | "year" | "all";

export function parseLeaderboardPeriod(raw: string | undefined): LeaderboardPeriod {
  const s = raw?.trim().toLowerCase() ?? "";
  if (s === "week" || s === "month" || s === "year" || s === "all") return s;
  return "month";
}

/** Half-open [start, end) in UTC Date objects for SQL. */
export function resolveLeaderboardWindow(
  period: LeaderboardPeriod,
  tz: string | undefined,
  now = new Date(),
): { start: Date; end: Date } {
  const zone = tz?.trim() || "UTC";
  // Use Intl / manual offset: for v1 accept IANA via Temporal if available,
  // else fall back to UTC. Implementation: compute local Y-M-D in zone,
  // convert start-of period to UTC instant, end = start of next period.
  // ...
}
```

Use `@js-temporal/polyfill` only if already in repo; otherwise implement with `Intl.DateTimeFormat` + offset math (document in file comment).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** (if user requested commits)

---

### Task 2: Leaderboard aggregate query

**Files:**
- Create: `apps/server/src/lib/leaderboard-query.ts`

- [ ] **Step 1: Implement `fetchLeaderboard`**

```ts
export type LeaderboardKind = "films" | "tv";

export async function fetchLeaderboard(opts: {
  kind: LeaderboardKind;
  start: Date;
  end: Date;
  viewerId: string | null;
  limit?: number;
}): Promise<{
  entries: Array<{ rank: number; userId: string; handle: string; displayName: string; count: number }>;
  viewer: { rank: number; count: number } | null;
}> {
  // Drizzle:
  // - from log inner join profile on user_id
  // - where profile.is_private = false
  // - and movie_id / tv_id filter by kind
  // - and watched_at >= start and watched_at < end
  // - if viewerId: left join block where (blocker, blocked) either direction → exclude
  // - groupBy log.userId, profile.handle, profile.displayName
  // - orderBy desc(count), asc(max(watched_at)), asc(handle)
  // - limit 50
  // Viewer rank: subquery or second pass counting users above viewer's count
}
```

- [ ] **Step 2: Implement `fetchLeaderboardLogs` for drawer**

Select `log` + `movie` or `tv` title/poster, order `desc(watched_at)`, same window filters, 404 if target profile `isPrivate`.

---

### Task 3: Elysia routes

**Files:**
- Create: `apps/server/src/routes/leaderboard.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add route module**

```ts
export const leaderboardRoute = new Elysia({ prefix: "/api/leaderboard", tags: ["leaderboard"] })
  .use(context)
  .get("/films", async ({ query, user, status }) => { /* ... */ })
  .get("/tv", async ({ query, user }) => { /* ... */ })
  .get("/films/:userId/logs", async ({ params, query, status }) => { /* 404 private */ })
  .get("/tv/:userId/logs", async ({ params, query, status }) => { /* ... */ });
```

Query schema: `period`, optional `tz` string.

- [ ] **Step 2: Register in `app.ts`**

```ts
import { leaderboardRoute } from "./routes/leaderboard";
// ...
.use(leaderboardRoute)
```

- [ ] **Step 3: Smoke test manually**

```bash
curl "http://localhost:3001/api/leaderboard/films?period=month&tz=Europe/Rome"
```

Expected: JSON with `entries`, `window`, `viewer` (null if unsigned).

---

## Phase 2 — Web URL + community feed wiring

### Task 4: Extend community feed types

**Files:**
- Modify: `apps/web/src/lib/home-community-feed.ts`
- Create: `apps/web/src/lib/home-community-feed.test.ts`

- [ ] **Step 1: Add feeds + helpers**

```ts
export type HomeCommunityFeed =
  | "lists"
  | "reviews"
  | "activity"
  | "film-ranks"
  | "tv-ranks";

export function isHomeLeaderboardFeed(
  feed: HomeCommunityFeed,
): feed is "film-ranks" | "tv-ranks" {
  return feed === "film-ranks" || feed === "tv-ranks";
}
```

Update `parseHomeCommunityFeed`:

```ts
if (s === "film-ranks" || s === "film-rank" || s === "films") return "film-ranks";
if (s === "tv-ranks" || s === "tv-rank") return "tv-ranks";
```

Append two entries to `HOME_COMMUNITY_FEEDS`.

- [ ] **Step 2: Tests**

```bash
cd apps/web && bun test src/lib/home-community-feed.test.ts
```

---

### Task 5: Period param + lobby URL

**Files:**
- Create: `apps/web/src/lib/home-leaderboard-period.ts`
- Create: `apps/web/src/lib/home-leaderboard-period.test.ts`
- Modify: `apps/web/src/lib/home-lobby-url.ts`
- Modify: `apps/web/src/lib/home-lobby-persist.ts`

- [ ] **Step 1: Period parser + constants**

```ts
export const HOME_LEADERBOARD_PERIODS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
] as const;

export type HomeLeaderboardPeriod = (typeof HOME_LEADERBOARD_PERIODS)[number]["id"];

export function parseHomeLeaderboardPeriod(
  raw: string | null | undefined,
  feed: HomeCommunityFeed,
): HomeLeaderboardPeriod {
  if (!isHomeLeaderboardFeed(feed)) return "month";
  // parse week|month|year|all, default month
}
```

- [ ] **Step 2: Extend `buildHomeLobbyHref`**

Add optional `period?: HomeLeaderboardPeriod` — when `browse === "community"` and feed is rank feed, serialize `period` unless default `month`.

- [ ] **Step 3: Persist `community: { feed, period? }`**

Update `HomeLobbyPersisted.community` and read/write in `persistHomeLobbyFromSearchParams`.

- [ ] **Step 4: Run tests**

```bash
cd apps/web && bun test src/lib/home-leaderboard-period.test.ts
```

---

### Task 6: Center community chips + motion import fix

**Files:**
- Modify: `apps/web/src/components/home/home-catalog-sort-chips.tsx`

- [ ] **Step 1: Center toolbar**

```tsx
<div
  className="mx-auto flex max-w-full flex-wrap justify-center gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
  role="toolbar"
  ...
>
```

- [ ] **Step 2: Replace `framer-motion` with `motion/react`**

```ts
import { motion, useReducedMotion } from "motion/react";
```

Verify `layoutId="home-catalog-sort-pill"` still animates.

---

## Phase 3 — Leaderboard UI components

### Task 7: Period toolbar component

**Files:**
- Create: `apps/web/src/components/home/home-leaderboard-period-toolbar.tsx`

- [ ] **Step 1: Client component**

Props: `period`, `sort` (`film-ranks` | `tv-ranks`). Uses `useRouter` + `buildHomeLobbyHref` on `SegmentedPillToolbar` change. Pass `Intl.DateTimeFormat().resolvedOptions().timeZone` to fetch layer via searchParams or client fetch query (store in component state for API calls).

---

### Task 8: Podium + row

**Files:**
- Create: `apps/web/src/components/home/home-leaderboard-podium.tsx`
- Create: `apps/web/src/components/home/home-leaderboard-row.tsx`

- [ ] **Step 1: Podium**

Order slots `[entries[1], entries[0], entries[2]]` for 2nd-1st-3rd. `motion.div` stagger children `delay: index * 0.1`. Center tile: `-translate-y-2.5` + `bg-background` with subtle accent mix class.

- [ ] **Step 2: Row**

`PatronPortraitAvatar`, `@handle`, pressable count:

```tsx
<DetailMotionPressable
  className="tabular-nums font-semibold text-foreground"
  onClick={() => openPatronWatchLedger({ userId, handle, displayName, kind, period })}
>
  {count}
</DetailMotionPressable>
```

`isViewer` → `bg-muted/20` on row wrapper.

---

### Task 9: Watch ledger drawer

**Files:**
- Create: `apps/web/src/components/home/patron-watch-ledger-drawer.tsx`
- Create: `apps/web/src/components/home/patron-watch-ledger-panel.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx` (or root layout) — mount drawer root

- [ ] **Step 1: Zustand store** (mirror `person-filmography-drawer.tsx`)

```ts
export type PatronWatchLedgerSeed = {
  userId: string;
  handle: string;
  displayName: string;
  kind: "films" | "tv";
  period: HomeLeaderboardPeriod;
};
```

- [ ] **Step 2: Panel fetches** `GET /api/leaderboard/{kind}/{userId}/logs?period=&tz=` on open; skeleton while loading; poster rows with links.

- [ ] **Step 3: Mount `<PatronWatchLedgerDrawerRoot />` next to `<PersonFilmographyDrawerRoot />`**

---

### Task 10: Community lobby integration

**Files:**
- Create: `apps/web/src/components/home/home-community-leaderboard.tsx`
- Modify: `apps/web/src/components/home/home-community-lobby.tsx`
- Modify: `apps/web/src/app/(app)/home/page.tsx`
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Server fetch on home page**

When `parseHomeCommunityFeed(sort)` is `film-ranks` or `tv-ranks`:

```ts
const period = parseHomeLeaderboardPeriod(searchParams.period, feed);
const tz = "UTC"; // client will refetch with local tz OR pass cookie/header later
const leaderboard = await serverApi().api.leaderboard.films.get({ query: { period, tz } });
```

Prefer generating Eden treaty types after route exists.

- [ ] **Step 2: `HomeCommunityLeaderboard`**

Props: `kind`, `period`, `initialData`, `viewerUserId`. Renders period toolbar, podium, rows 4+, viewer footer.

- [ ] **Step 3: Wire in `HomeCommunityLobby`**

```tsx
if (feed === "film-ranks" || feed === "tv-ranks") {
  return <HomeCommunityLeaderboard ... />;
}
```

Empty state via `HomeCommunityEmpty` when `entries.length === 0`.

- [ ] **Step 4: Optional client refetch with local `tz`**

`useEffect` on mount: refetch with `Intl...timeZone` if different from server default — keeps SSR working, fixes boundary for patron.

---

## Phase 4 — Verification

### Task 11: Build + manual QA

- [ ] **Step 1: Typecheck web**

```bash
cd apps/web && bun run build
```

If `RouteImpl` / Link errors: delete `apps/web/.next` and rebuild.

- [ ] **Step 2: Run unit tests**

```bash
cd apps/server && bun test src/lib/leaderboard-period.test.ts
cd apps/web && bun test src/lib/home-community-feed.test.ts src/lib/home-leaderboard-period.test.ts
```

- [ ] **Step 3: Manual checklist**

| Check | URL |
|-------|-----|
| Film board | `/home?browse=community&sort=film-ranks&period=month` |
| TV board | `/home?browse=community&sort=tv-ranks&period=week` |
| Chips centered | Visual |
| Count → drawer | Tap #4 count |
| Private profile excluded | Seed private user with logs — absent |
| Period persistence | Switch to Year, navigate away, return |

- [ ] **Step 4: Update `.cursor/scratchpad.md` Project Status Board**

- [ ] **Step 5: `graphify update .`** (if graphify available)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Film + TV separate boards | 3, 4, 10 |
| Tier-card podium | 8, 10 |
| Week/month/year/all | 1, 5, 7 |
| Public profile only | 2, 3 |
| Every log counts | 2 (count `*`) |
| Five centered chips | 4, 6 |
| Drawer on count | 9, 10 |
| Block exclusion | 2 |
| tabular-nums + motion polish | 8 |
| Persist period | 5 |

## Out of scope (do not implement in this plan)

- Rollup/cache tables
- Per-log privacy
- Drawer period picker
- Badges for winning
