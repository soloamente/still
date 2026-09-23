# Watchlist hero + platform morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Human **go** between tasks.

**Goal:** Rebuild `/watchlist` as one scroll — Tonight hero (Pick another), Continue rail, three sort chips + filters popover, platform logo row with morph-to-composite-pill AND streaming filter, then the saves grid.

**Architecture:** Keep existing tonight scorer, alerts, and `order=tonight` for hero prefetch only. Main grid uses `?order=latest_added|earliest_added|title_az` plus `?providers=8,350` (TMDb ids, AND flatrate in chosen region). New `GET /api/watchlist/providers` feeds the logo row. Client morph uses `motion/react` `layoutId` with reduced-motion instant path. Layout owns chrome (hero, continue, filters, platform row); page Suspense streams grid only.

**Tech Stack:** Bun + Elysia + Drizzle (Neon), Next.js App Router, `motion/react`, Biome, `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-23-watchlist-hero-platforms-design.md`

## Global constraints

- Never `.select()` whole `movie`/`tv` or full `tmdb_json` — reuse `WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION` / `flatrateProvidersForRegion` (`apps/server/src/lib/watchlist-streaming-alerts.ts`).
- Chosen watch region only for AND filter and provider row; no US fallback for filter UI (`readCatalogWatchRegionPrefOrNull`).
- Import motion from `motion/react`. Exhaustive `switch` + `never`. No inline imports.
- Server tests with env: `bun test --env-file=.env` from `apps/server`.
- Register new product kinds on server + `CLIENT_PRODUCT_EVENT_KINDS` where client-fired.
- Legacy URLs: `?order=tonight|continue` → `/watchlist`; `?order=available` → `/watchlist` (optional `?filters=1` to open popover once).

---

### Task 1: Provider AND filter (pure + route)

**Files:**
- Create: `apps/server/src/lib/watchlist-provider-filter.ts`
- Test: `apps/server/src/lib/watchlist-provider-filter.test.ts`
- Modify: `apps/server/src/routes/watchlist.ts`
- Modify: `apps/server/src/lib/watchlist-query-args.ts` (if query parsing lives there)

**Step 1: Failing tests**

```ts
// watchlist-provider-filter.test.ts
import { describe, expect, test } from "bun:test";
import {
	parseWatchlistProviderIds,
	titleFlatrateIncludesAllProviders,
} from "./watchlist-provider-filter";

describe("parseWatchlistProviderIds", () => {
	test("parses comma list, dedupes, sorts asc", () => {
		expect(parseWatchlistProviderIds("350,8,8")).toEqual([8, 350]);
	});
	test("empty → []", () => {
		expect(parseWatchlistProviderIds(null)).toEqual([]);
	});
});

describe("titleFlatrateIncludesAllProviders", () => {
	const json = {
		results: {
			US: {
				flatrate: [
					{ provider_id: 8, provider_name: "Netflix" },
					{ provider_id: 350, provider_name: "Apple TV" },
				],
			},
		},
	};
	test("AND: both ids present → true", () => {
		expect(titleFlatrateIncludesAllProviders(json, "US", [8, 350])).toBe(true);
	});
	test("missing one → false", () => {
		expect(titleFlatrateIncludesAllProviders(json, "US", [8, 999])).toBe(false);
	});
});
```

**Step 2:** Run `bun test apps/server/src/lib/watchlist-provider-filter.test.ts` — expect FAIL.

**Step 3:** Implement parser + AND check using `flatrateProvidersForRegion`.

**Step 4:** In `GET /api/watchlist`, when `providers` query non-empty and region chosen, filter rows **before** paging (for `latest_added` / `earliest_added` / `title_az` only — not when `order=tonight` used internally). Pass `providers` through query args schema.

**Step 5:** Run watchlist route tests + new unit tests — PASS.

**Step 6:** Commit `feat(watchlist): AND-filter grid by TMDb provider ids`

---

### Task 2: Provider catalogue for logo row

**Files:**
- Create: `apps/server/src/lib/watchlist-provider-catalogue.ts`
- Test: `apps/server/src/lib/watchlist-provider-catalogue.test.ts`
- Modify: `apps/server/src/routes/watchlist.ts` — add `GET /providers` (or `/watchlist/providers` nested route)

**Step 1:** Test aggregates `{ providerId, providerName, logoPath, titleCount }[]` from mock rows (dedupe, sort by count desc).

**Step 2:** Implement scan over watchlist rows (cap e.g. 500 recent) with narrow provider projection; 60s in-memory cache per user+region.

**Step 3:** Route returns `{ providers: [...], region: string | null }`; empty region → `{ providers: [], needsRegion: true }`.

**Step 4:** Commit `feat(watchlist): providers catalogue endpoint for platform row`

---

### Task 3: Web URL — providers param + legacy redirects

**Files:**
- Create: `apps/web/src/lib/watchlist-provider-filter.ts`
- Test: `apps/web/src/lib/watchlist-provider-filter.test.ts`
- Modify: `apps/web/src/lib/watchlist-lobby-order.ts` — trim `WatchlistLobbyOrder` to three sorts; `parseWatchlistProviderIds`; `buildWatchlistLobbyHref({ order, providers })`
- Modify: `apps/web/src/app/(app)/watchlist/page.tsx` or `proxy`/middleware if redirects live in page — prefer `watchlist/page.tsx` server redirect for legacy `order`

**Step 1:** Tests for parse/build href `?providers=8,350&order=latest_added`.

**Step 2:** Remove `tonight|available|continue` from web order type; map legacy searchParams to redirect in page or layout server component.

**Step 3:** Update `fetchMyWatchlist` / `fetchMyWatchlistServer` to pass `providers` query.

**Step 4:** Commit `refactor(watchlist): three sort modes and providers query param`

---

### Task 4: Tonight hero (RSC + client)

**Files:**
- Create: `apps/web/src/components/watchlist/watchlist-tonight-hero.tsx`
- Create: `apps/web/src/lib/fetch-watchlist-tonight-hero-server.ts`
- Modify: `apps/web/src/app/(app)/watchlist/layout.tsx` — mount hero above shell grid slot
- Reference: `apps/web/src/components/home/home-taste-matched-hero.tsx`, `home-taste-hero-layout.ts`

**Step 1:** Server fetch `order=tonight&limit=12`; map to hero pool seeds (poster, logo, reason, trailer enrichment if existing helper).

**Step 2:** Client hero: local index state, **Pick another** cycles pool; primary actions (detail link, Quick log, watchlist) — reuse detail motion + catalogue tiles patterns.

**Step 3:** Empty watchlist: compact empty hero (no rotation).

**Step 4:** `useTrackImpressionOnce` → `watchlist.hero_viewed`; actions → `watchlist.hero_action`.

**Step 5:** Manual: signed-in `/watchlist` shows hero above continue/filters.

**Step 6:** Commit `feat(watchlist): tonight hero with pick another`

---

### Task 5: Continue watching band

**Files:**
- Modify: `apps/web/src/app/(app)/watchlist/layout.tsx` or new `watchlist-continue-rsc.tsx`
- Reuse: `HomeContinueWatchingRail`, `fetchTvWatchMeServerResult`

**Step 1:** Fetch `tv-watch/me` in layout RSC (parallel with hero).

**Step 2:** Render section title **Or continue watching**; `items.length === 0` → render nothing.

**Step 3:** Remove `order=continue` branch from `watchlist/page.tsx`.

**Step 4:** Commit `feat(watchlist): continue rail under hero`

---

### Task 6: Filter row — three chips + filters popover

**Files:**
- Modify: `apps/web/src/components/watchlist/watchlist-catalog-order-chips.tsx` — three options only
- Create: `apps/web/src/components/watchlist/watchlist-catalog-filters-popover.tsx` — region via `WatchlistRegionAction` / `CatalogWatchRegionPrompt`, streaming copy, alerts hint
- Modify: `apps/web/src/components/watchlist/watchlist-patron-lobby-shell.tsx` — filter row layout: leading chips, trailing `[pill slot][filters]`
- Delete or gut: `watchlist-mode-intro-line.tsx`, `watchlist-mode-intro.ts` (+ tests) if obsolete

**Step 1:** Match `HomeLobbyFilterRow` / `HomeCatalogFiltersPopover` spacing (filters icon in chip track on mobile if needed per AGENTS.md lobby patterns).

**Step 2:** Optional `?filters=1` opens popover once (legacy `available` redirect).

**Step 3:** Commit `feat(watchlist): sort chips and filters popover`

---

### Task 7: Platform row + composite pill (static, no morph yet)

**Files:**
- Create: `apps/web/src/components/watchlist/watchlist-platform-row.tsx`
- Create: `apps/web/src/components/watchlist/watchlist-provider-filter-pill.tsx`
- Create: `apps/web/src/lib/fetch-watchlist-providers-server.ts`
- Modify: `watchlist-patron-lobby-shell.tsx` — row under filter row

**Step 1:** Fetch providers in layout; hide row when `needsRegion` or empty providers.

**Step 2:** Row: horizontal scroll, large rounded cards, TMDb logo (`/t/p/w92` or existing provider logo helper).

**Step 3:** Selection state synced to `?providers=` via `useWatchlistLobbyParams` extension (`selectProvider`, `removeProvider`, `clearProviders`).

**Step 4:** Pill UI: stacked circles + joined names; tap opens manage popover (Remove / Clear all) — **no morph animation yet**.

**Step 5:** Cards for selected ids hidden from row.

**Step 6:** Commit `feat(watchlist): platform row and composite provider pill`

---

### Task 8: Morph motion (card → pill)

**Files:**
- Modify: `watchlist-platform-row.tsx`, `watchlist-provider-filter-pill.tsx`
- Reference: `motion/react` `LayoutGroup`, `layoutId={`watchlist-provider-${id}`}`

**Step 1:** Shared `layoutId` per provider between card and pill stack segment.

**Step 2:** `useReducedMotion()` → skip layout animation; pill appears in dock slot instantly.

**Step 3:** Filter row anchor ref for pill slot; ensure no `overflow-hidden` on ancestors clips flying element (see AGENTS.md scroll fades).

**Step 4:** Commit `feat(watchlist): morph platform cards into filter pill`

---

### Task 9: Grid integration + cleanup

**Files:**
- Modify: `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx` — drop tonight/available/continue branches; grid always save sort; pass `providers` to fetch
- Modify: `apps/web/src/lib/watchlist-lobby-order.ts` — `watchlistRowToPopularSeed` only save sorts (already mode-aware; simplify)
- Modify: `apps/server/src/lib/product-event-kinds.ts`, `apps/web/src/lib/product-event-kinds.ts` — add hero + provider events
- Modify: `docs/superpowers/specs/2026-09-23-watchlist-hero-platforms-design.md` — **As built**
- Modify: `docs/superpowers/specs/2026-09-23-watchlist-decision-engine-design.md` — pointer to superseding IA

**Step 1:** `watchlist.mode_viewed` includes `providers_count`; remove impressions tied to removed chips.

**Step 2:** Run `bun test` watchlist-related server/web tests; web `tsc` on touched paths.

**Step 3:** Browser QA checklist: hero pick another; continue hidden/visible; select Netflix → pill docks; add Apple TV+ → stacked pill; grid AND; popover remove; clear all restores card; legacy `?order=tonight` redirect.

**Step 4:** Commit `docs(watchlist): hero-platforms as built and wire grid providers`

---

## Verification checklist (human)

- [ ] `/watchlist` — hero, continue (if any), filters, platform row, grid on one page
- [ ] Pick another rotates without URL change
- [ ] Two providers → only titles on **both** services
- [ ] No region → row hidden + region prompt in popover
- [ ] Morph + reduced motion
- [ ] Alerts / radial toolkit unchanged on grid tiles

## Execution handoff

Plan saved. Prefer **subagent-driven execution** (one task per **go**) on `feat/watchlist-decision-engine` or a fresh worktree branch.
