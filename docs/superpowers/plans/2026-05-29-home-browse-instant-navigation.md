# Home Browse Instant Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task, run verification, update `.cursor/scratchpad.md` **HB.*** board, and ask the human for **`ok`** before the next task (Executor workflow).

**Goal:** Make `/home` **Movies · TV Shows · Community** browse tabs feel instant (pill &lt;100ms, no full-page freeze) and shorten Community’s critical path by deferring leaderboard fetches.

**Architecture:** Lift `LobbyNavigationProvider` to wrap sticky chrome + catalogue; add `HomeBrowseSurfaceProvider` for optimistic browse pill + `router.replace` in `useTransition`; `HomeLobbyBodyGate` shows the correct skeleton while RSC pending; Community RSC fetches core feeds only, leaderboards fill on the client after mount.

**Tech Stack:** Next.js 16 App Router, React 19 `useTransition`, existing `useLobbyTransition`, `buildHomeLobbyHref`, `fetchCommunityLeaderboard`.

**Spec:** `docs/superpowers/specs/2026-05-29-home-browse-instant-navigation-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/use-lobby-transition.ts` | Existing — `navigate` + `isPending` |
| `apps/web/src/components/lobby/lobby-navigation-provider.tsx` | Existing — hoist to home root |
| `apps/web/src/components/home/home-browse-surface-context.tsx` | **New** — optimistic `activeBrowse`, `selectBrowseSurface` |
| `apps/web/src/components/home/home-lobby-navigation-root.tsx` | **New** — `LobbyNavigationProvider` + `HomeBrowseSurfaceProvider` |
| `apps/web/src/components/home/home-lobby-body-gate.tsx` | **New** — skeleton vs children by pending/url browse |
| `apps/web/src/components/home/community-lobby-skeleton.tsx` | **New** — Community feed placeholder |
| `apps/web/src/lib/home-community-core-fetch.ts` | **New** — server: lists + reviews + feed (no leaderboards) |
| `apps/web/src/lib/fetch-home-leaderboards-client.ts` | **New** — client: 4 periods × films + tv |
| `apps/web/src/components/home/home-community-rsc-payload.tsx` | **New** — async RSC child: core fetch → providers |
| `apps/web/src/components/home/home-sticky-chrome.tsx` | Browse pill from context; prefetch Community |
| `apps/web/src/app/(app)/home/page.tsx` | Wire root + body gate + split community fetch |
| `apps/web/src/components/home/home-tmdb-lobby-chrome.tsx` | Remove nested `LobbyNavigationProvider` |
| `apps/web/src/components/home/home-community-patron-shell.tsx` | Remove nested provider |
| `apps/web/src/components/home/home-community-lobby-params-context.tsx` | Merge deferred leaderboards into state |
| `apps/web/src/lib/home-browse-surface-context.test.ts` | **New** — href + active browse helpers |
| `apps/web/src/lib/home-lobby-url.test.ts` | Extend if needed for browse href smoke |

---

## Wave A — Browse pill + body gate

### Task 1: `HomeBrowseSurfaceProvider`

**Files:**
- Create: `apps/web/src/components/home/home-browse-surface-context.tsx`
- Create: `apps/web/src/lib/home-browse-surface-nav.ts` (pure href builder for tests)
- Test: `apps/web/src/lib/home-browse-surface-nav.test.ts`

- [ ] **Step 1: Pure helper `buildBrowseSurfaceNavigateHref`**

```ts
// home-browse-surface-nav.ts
import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import { DEFAULT_HOME_COMMUNITY_FEED } from "@/lib/home-community-feed";
import { DEFAULT_HOME_LEADERBOARD_PERIOD } from "@/lib/home-leaderboard-period";
import {
  buildHomeHrefFromPersisted,
  emptyHomeLobbyPersisted,
  readHomeLobbyPersisted,
  type HomeLobbyPersisted,
} from "@/lib/home-lobby-persist";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

export function buildBrowseSurfaceNavigateHref(
  next: HomeBrowseSurface,
  input: {
    isHomeLobby: boolean;
    currentParams: URLSearchParams;
    persisted?: HomeLobbyPersisted | null;
  },
): string {
  const persisted = input.persisted ?? readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted();
  if (!input.isHomeLobby) {
    return buildHomeHrefFromPersisted(persisted, next);
  }
  if (next === "community") {
    const feed = persisted.community?.feed ?? DEFAULT_HOME_COMMUNITY_FEED;
    return buildHomeLobbyHref({
      browse: "community",
      sort: feed,
      period: persisted.community?.period ?? DEFAULT_HOME_LEADERBOARD_PERIOD,
    });
  }
  const currentBrowse = input.currentParams.get("browse");
  if (currentBrowse === "community") {
    return buildHomeHrefFromPersisted(persisted, next);
  }
  const params = new URLSearchParams(input.currentParams.toString());
  if (next === "movies") params.delete("browse");
  else params.set("browse", next);
  const qs = params.toString();
  return qs ? `/home?${qs}` : "/home";
}
```

- [ ] **Step 2: Failing tests**

```ts
// home-browse-surface-nav.test.ts
import { describe, expect, test } from "bun:test";
import { buildBrowseSurfaceNavigateHref } from "./home-browse-surface-nav";

describe("buildBrowseSurfaceNavigateHref", () => {
  test("movies from tv keeps sort params", () => {
    const href = buildBrowseSurfaceNavigateHref("movies", {
      isHomeLobby: true,
      currentParams: new URLSearchParams("browse=tv&sort=popular"),
      persisted: emptyHomeLobbyPersisted(),
    });
    expect(href).toBe("/home?sort=popular");
  });
  test("community uses persisted feed", () => {
    const href = buildBrowseSurfaceNavigateHref("community", {
      isHomeLobby: true,
      currentParams: new URLSearchParams("sort=popular"),
      persisted: {
        ...emptyHomeLobbyPersisted(),
        community: { feed: "reviews", period: "month" },
      },
    });
    expect(href).toContain("browse=community");
    expect(href).toContain("sort=reviews");
    expect(href).toContain("period=month");
  });
});
```

Run: `cd apps/web && bun test src/lib/home-browse-surface-nav.test.ts`  
Expected: FAIL until helper exists.

- [ ] **Step 3: Client provider**

```tsx
// home-browse-surface-context.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import { parseHomeBrowseSurface, type HomeBrowseSurface } from "@/lib/home-browse-surface";
import { buildBrowseSurfaceNavigateHref } from "@/lib/home-browse-surface-nav";

interface Value {
  activeBrowse: HomeBrowseSurface;
  urlBrowse: HomeBrowseSurface;
  selectBrowseSurface: (next: HomeBrowseSurface) => void;
  prefetchBrowseSurface: (next: HomeBrowseSurface) => void;
}

const Ctx = createContext<Value | null>(null);

export function HomeBrowseSurfaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useLobbyNavigation();
  const isHomeLobby = pathname === "/home" || pathname.startsWith("/home/");
  const urlBrowse = parseHomeBrowseSurface(searchParams.get("browse"));
  const [pending, setPending] = useState<HomeBrowseSurface | null>(null);

  useEffect(() => {
    if (pending != null && pending === urlBrowse) setPending(null);
  }, [pending, urlBrowse]);

  const activeBrowse = pending ?? urlBrowse;

  const selectBrowseSurface = useCallback(
    (next: HomeBrowseSurface) => {
      if (!isHomeLobby) {
        navigate(buildBrowseSurfaceNavigateHref(next, {
          isHomeLobby: false,
          currentParams: new URLSearchParams(searchParams.toString()),
        }));
        return;
      }
      if (next === activeBrowse && pending == null) return;
      setPending(next);
      navigate(
        buildBrowseSurfaceNavigateHref(next, {
          isHomeLobby: true,
          currentParams: new URLSearchParams(searchParams.toString()),
        }),
      );
    },
    [activeBrowse, isHomeLobby, navigate, pending, searchParams],
  );

  const prefetchBrowseSurface = useCallback(
    (next: HomeBrowseSurface) => {
      // implemented in Task 5 with router.prefetch
      void next;
    },
    [],
  );

  const value = useMemo(
    () => ({ activeBrowse, urlBrowse, selectBrowseSurface, prefetchBrowseSurface }),
    [activeBrowse, urlBrowse, selectBrowseSurface, prefetchBrowseSurface],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHomeBrowseSurface(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHomeBrowseSurface requires HomeBrowseSurfaceProvider");
  return v;
}
```

- [ ] **Step 4: Run tests + build**

Run: `cd apps/web && bun test src/lib/home-browse-surface-nav.test.ts && bun run build`  
Expected: PASS, build exit 0.

**Success:** Provider compiles; href tests pass.

---

### Task 2: `HomeLobbyNavigationRoot`

**Files:**
- Create: `apps/web/src/components/home/home-lobby-navigation-root.tsx`
- Modify: `apps/web/src/app/(app)/home/page.tsx`

- [ ] **Step 1: Root wrapper**

```tsx
// home-lobby-navigation-root.tsx
"use client";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { HomeBrowseSurfaceProvider } from "@/components/home/home-browse-surface-context";

export function HomeLobbyNavigationRoot({ children }: { children: React.ReactNode }) {
  return (
    <LobbyNavigationProvider>
      <HomeBrowseSurfaceProvider>{children}</HomeBrowseSurfaceProvider>
    </LobbyNavigationProvider>
  );
}
```

- [ ] **Step 2: Wrap page return** — replace outer `div` children chrome + section:

```tsx
// page.tsx (inside return)
<HomeLobbyNavigationRoot>
  <HomeLobbySessionRestore />
  <Suspense fallback={<LobbyStickyChromeFallback />}>
    <HomeStickyChrome user={stickyUser} />
  </Suspense>
  <section className={...}>
    {/* body gate in Task 3 */}
  </section>
</HomeLobbyNavigationRoot>
```

- [ ] **Step 3: Remove duplicate providers**

In `home-tmdb-lobby-chrome.tsx`, delete `LobbyNavigationProvider` wrapper (keep `HomeTmdbLobbyParamsProvider` only).

In `home-community-patron-shell.tsx`, delete `LobbyNavigationProvider` from `HomeCommunityPatronProviders`.

- [ ] **Step 4: Build**

Run: `cd apps/web && bun run build`  
Expected: exit 0.

**Success:** Single navigation context for entire home tree.

---

### Task 3: `HomeLobbyBodyGate` + `CommunityLobbySkeleton`

**Files:**
- Create: `apps/web/src/components/home/home-lobby-body-gate.tsx`
- Create: `apps/web/src/components/home/community-lobby-skeleton.tsx`

- [ ] **Step 1: Skeleton** — chip row fallbacks + 4–6 shimmer feed rows (`ShimmerBone`), `aria-busy`, `role="status"` sr-only “Loading community…”.

- [ ] **Step 2: Body gate**

```tsx
"use client";

import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import { CommunityLobbySkeleton } from "@/components/home/community-lobby-skeleton";
import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";
import { HomeTmdbCatalogueGrid } from "@/components/home/home-tmdb-lobby-chrome";

export function HomeLobbyBodyGate({
  urlBrowse,
  community,
  tmdb,
}: {
  urlBrowse: "movies" | "tv" | "community";
  community: React.ReactNode;
  tmdb: React.ReactNode;
}) {
  const { activeBrowse, urlBrowse: urlFromCtx } = useHomeBrowseSurface();
  const { isPending } = useLobbyNavigation();
  const showCommunity =
    activeBrowse === "community" && (isPending || urlFromCtx !== "community" || urlBrowse === "community");
  const showTmdb =
    activeBrowse !== "community" && (isPending || urlFromCtx === "community" || urlBrowse !== "community");

  if (activeBrowse === "community" && (isPending || urlBrowse !== "community")) {
    return (
      <>
        <CommunityLobbySkeleton />
        {urlBrowse === "community" ? null : community}
      </>
    );
  }
  if (activeBrowse !== "community" && (isPending || urlBrowse === "community")) {
    return <HomeTmdbCatalogueGrid>{tmdb}</HomeTmdbCatalogueGrid>;
  }
  return urlBrowse === "community" ? <>{community}</> : <>{tmdb}</>;
}
```

Refine gate logic during implementation so only one visible body shows (avoid double mount). Prefer:

| Condition | Render |
|-----------|--------|
| `activeBrowse === "community"` && `urlBrowse !== "community"` | `CommunityLobbySkeleton` only |
| `activeBrowse !== "community"` && `urlBrowse === "community"` | `HomeTmdbCatalogueGrid` + dim OR tmdb skeleton |
| aligned | `community` or `tmdb` branch from RSC |

- [ ] **Step 3: Wire `page.tsx`**

```tsx
<HomeLobbyBodyGate
  urlBrowse={browse}
  community={/* existing community branch */}
  tmdb={/* existing HomeTmdbLobbyChrome branch */}
/>
```

- [ ] **Step 4: Build**

**Success:** Tapping browse shows skeleton for target surface while pending.

---

### Task 4: Migrate `HomeStickyChrome` browse tabs

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-chrome.tsx`

- [ ] **Step 1:** Replace `pushBrowseSurface` / local `browseSurface` with `useHomeBrowseSurface()` — `activeBrowse` for pill `aria-pressed` + `layoutId`; `onClick={() => selectBrowseSurface("movies")}` etc.

- [ ] **Step 2:** Keep `mergePersistFromHomeUrl` effect keyed on **`urlBrowse`** from context (not optimistic), so localStorage matches settled URL.

- [ ] **Step 3:** Non-home lobby (`/diary`): `selectBrowseSurface` already uses `navigate` → `buildHomeHrefFromPersisted` via helper when `!isHomeLobby` — verify `router.push` is NOT used (use `navigate` only if same pathname; for `/diary` pathname differs, hook should use `router.push` inside helper — extend `buildBrowseSurfaceNavigateHref` caller to use `router.push` when `!isHomeLobby`):

```tsx
// In selectBrowseSurface when !isHomeLobby:
import { useRouter } from "next/navigation";
router.push(href); // cross-route — not replace
```

- [ ] **Step 4: Manual smoke** — dev server: tap TV → pill moves before grid updates.

**Success:** Symptom **A** fixed for browse pill.

---

### Task 5: Community prefetch on hover + idle

**Files:**
- Modify: `apps/web/src/components/home/home-browse-surface-context.tsx`
- Modify: `apps/web/src/components/home/home-sticky-chrome.tsx`

- [ ] **Step 1: `prefetchBrowseSurface`**

```tsx
const router = useRouter();
const prefetchBrowseSurface = useCallback(
  (next: HomeBrowseSurface) => {
    if (!isHomeLobby) return;
    const href = buildBrowseSurfaceNavigateHref(next, {
      isHomeLobby: true,
      currentParams: new URLSearchParams(searchParams.toString()),
    });
    router.prefetch(href);
  },
  [isHomeLobby, router, searchParams],
);
```

- [ ] **Step 2: Community button** — `onPointerEnter={() => prefetchBrowseSurface("community")}`.

- [ ] **Step 3: Idle prefetch** — in provider, `useEffect` when `urlBrowse` is movies|tv:

```tsx
useEffect(() => {
  if (!isHomeLobby || urlBrowse === "community") return;
  const id = requestIdleCallback(() => prefetchBrowseSurface("community"), { timeout: 4000 });
  return () => cancelIdleCallback(id);
}, [isHomeLobby, urlBrowse, prefetchBrowseSurface]);
```

**Success:** Second Community tap measurably faster (Network tab shows prefetched RSC).

---

### Task 6: Wave A QA gate

- [ ] **Step 1:** `cd apps/web && bun run build`
- [ ] **Step 2:** Manual checklist (spec § Manual QA items 1, 3, 5)
- [ ] **Step 3:** Update scratchpad **HB.3** → done; ask human **`ok`**

---

## Wave B — Community core + deferred leaderboards

### Task 7: `fetchHomeCommunityCore` (server)

**Files:**
- Create: `apps/web/src/lib/home-community-core-fetch.ts`
- Modify: `apps/web/src/app/(app)/home/page.tsx` (temporary — moved to RSC child in Task 8)

- [ ] **Step 1: Extract core fetch** from `page.tsx` lines ~258–370 — export:

```ts
export async function fetchHomeCommunityCore(input: {
  api: ServerApi; // type from serverApi()
  session: Session | null;
}): Promise<{
  listSeedsAll: ListLobbySeed[];
  reviewsAll: CommunityReviewRow[];
  activityItemsAll: HomeCommunityActivityItem[];
}>
```

No `fetchHomeLeaderboardsByPeriod` in this module.

- [ ] **Step 2: Unit smoke** — optional test that module imports do not reference leaderboard paths.

**Success:** Core fetch isolated and reusable.

---

### Task 8: `HomeCommunityRscPayload` + Suspense

**Files:**
- Create: `apps/web/src/components/home/home-community-rsc-payload.tsx`
- Modify: `apps/web/src/app/(app)/home/page.tsx`

- [ ] **Step 1: Async server component**

```tsx
// home-community-rsc-payload.tsx
import { fetchHomeCommunityCore } from "@/lib/home-community-core-fetch";
import { HomeCommunityPatronProviders } from "@/components/home/home-community-patron-shell";
// ... pass through props: monochromePeersOnHover, signedIn, viewerUserId, children slot

export async function HomeCommunityRscPayload({ ... }) {
  const bundled = await fetchHomeCommunityCore(...);
  return (
    <HomeCommunityPatronProviders
      bundled={{
        ...bundled,
        filmLeaderboardsByPeriod: {},
        tvLeaderboardsByPeriod: {},
      }}
    >
      {children}
    </HomeCommunityPatronProviders>
  );
}
```

- [ ] **Step 2: `page.tsx`** — when `browse === "community"`, remove inline fetch block; render:

```tsx
<Suspense fallback={<CommunityLobbySkeleton />}>
  <HomeCommunityRscPayload ...>
    <HomeCommunityPatronBody ... />
  </HomeCommunityRscPayload>
</Suspense>
```

Pass chip toolbars inside payload children as today.

- [ ] **Step 3: Build** — ensure `cookies()` / `serverApi()` called in payload or passed from page per Next cache rules.

**Success:** Community navigation no longer awaits 8 leaderboard calls in page.tsx top-level await.

---

### Task 9: Client leaderboard background fill

**Files:**
- Create: `apps/web/src/lib/fetch-home-leaderboards-client.ts`
- Modify: `apps/web/src/components/home/home-community-lobby-params-context.tsx`

- [ ] **Step 1: Client fetch all periods**

```ts
const PERIODS = ["week", "month", "year", "all"] as const;

export async function fetchHomeLeaderboardsByPeriodClient(
  kind: "films" | "tv",
  signal?: AbortSignal,
): Promise<Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>>> {
  const out = {};
  await Promise.all(
    PERIODS.map(async (period) => {
      out[period] = await fetchCommunityLeaderboard(kind, period, "UTC", { signal });
    }),
  );
  return out;
}
```

- [ ] **Step 2: Provider effect**

On mount when both `filmLeaderboardsByPeriod` and `tvLeaderboardsByPeriod` are empty objects:

```tsx
useEffect(() => {
  const ac = new AbortController();
  void (async () => {
    const [film, tv] = await Promise.all([
      fetchHomeLeaderboardsByPeriodClient("films", ac.signal),
      fetchHomeLeaderboardsByPeriodClient("tv", ac.signal),
    ]);
    if (!ac.signal.aborted) setLeaderboards({ film, tv });
  })();
  return () => ac.abort();
}, []);
```

Merge into `leaderboard` useMemo via state overlay on bundled maps.

- [ ] **Step 3: Ranks UI** — when `feed` is `film-ranks`|`tv-ranks` and `leaderboard == null`, render ranks skeleton (reuse `CommunityLobbySkeleton` ranks section or `HomeCommunityEmpty` variant “Loading ranks…”).

**Success:** Lists tab paints without leaderboard data; ranks populate after background fetch.

---

### Task 10: Error surfaces + `router.refresh`

**Files:**
- Modify: `apps/web/src/components/home/home-community-rsc-payload.tsx`
- Modify: `apps/web/src/components/home/home-community-lobby-params-context.tsx`

- [ ] **Step 1:** Core fetch failure → `error.tsx` boundary or inline try/catch with retry button calling `router.refresh()`.

- [ ] **Step 2:** Leaderboard fetch failure → ranks tab empty state with retry (re-run effect).

**Success:** Lists/Reviews/Activity stay usable if ranks fail.

---

### Task 11: Wave B QA + closure

- [ ] **Step 1:** `cd apps/web && bun test src/lib/home-browse-surface-nav.test.ts` (and any new tests)
- [ ] **Step 2:** `bun run build`
- [ ] **Step 3:** Manual QA full checklist (spec § Manual QA 1–6)
- [ ] **Step 4:** `graphify update .` if graphify available
- [ ] **Step 5:** Scratchpad **HB.4** done; Planner marks feature complete after human **`ok`**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Optimistic browse pill | 1, 4 |
| `router.replace` + transition | 1, 2 |
| Single `LobbyNavigationProvider` | 2 |
| `HomeLobbyBodyGate` | 3 |
| Community core-only RSC | 7, 8 |
| Deferred leaderboards | 9 |
| Prefetch hover + idle | 5 |
| Cross-route diary → community | 1, 4 |
| Error handling | 10 |
| Tests + build gate | 1, 6, 11 |

No TBD placeholders. Waves match spec rollout A/B.

---

## Human verification (full)

1. `/home` → **Community**: pill immediate; skeleton → **Lists** without waiting for ranks.
2. **Film ranks** before fill: skeleton → podium.
3. **Movies ↔ TV**: pill immediate; grid dim pulse.
4. Hover **Community**, then tap: faster than cold.
5. Browser **Back**: pill + body match URL.
6. `/diary` → **Community**: lands on persisted community URL.

Reply **`ok`** per wave or **`go`** to start Executor on **Task 1**.
