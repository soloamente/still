# Favorite people + release/streaming alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons Favorite cast/crew once, surface that taste on profile + search, and inbox them when a favorited person’s new credit releases or streams in their region — with role-aware copy.

**Architecture:** New `person_favorite` + `person_favorite_credit_seen` tables; CRUD on `/api/people/:id/favorite`; profile count + paginated drawer list; search annotates `isFavorited` and sorts favorites first; two notification kinds gated by Settings prefs; nightly jobs mirror watchlist streaming alerts (baseline on first favorite, release window + streaming flatrate diffs).

**Tech stack:** Drizzle/Neon, Elysia, Bun test, Next.js App Router, DetailVaulSheet, existing `NOTIFICATION_KIND_REGISTRY` + local jobs scheduler.

**Spec:** `docs/superpowers/specs/2026-09-21-favorite-people-alerts-design.md`

## Global constraints

- One Favorite per person (no role picker). Separate from diary/title Favorites (`log.liked` / system Favorites list).
- Star mark (not heart) — avoid colliding with diary Favorite heart.
- Public profiles only for count + drawer; show **0** for owner parity.
- On first Favorite, **baseline** current credits into `person_favorite_credit_seen` **without** notifying.
- Release window: upcoming **30 days** or past **7 days** (UTC); outside window → mark seen, no notify.
- Jobs are best-effort; never block interactive APIs. Local runs only with `RUN_LOCAL_JOBS` / `dev:jobs`.
- Next migration after `0042_person_search_traffic` is **`0043_*`** — must register in `packages/db/src/migrations/meta/_journal.json`.
- Notification kinds must be added to **both** server `notification-delivery.ts` and web `notification-preferences.ts`.

---

## File map

| File | Responsibility |
| --- | --- |
| `packages/db/src/schema/person-favorite.ts` | `person_favorite` + `person_favorite_credit_seen` |
| `packages/db/src/migrations/0043_person_favorite.sql` | Tables + uniques |
| `apps/server/src/lib/person-favorite-role.ts` | Normalize `role_key` + human `roleLabel` from cast/crew |
| `apps/server/src/lib/person-favorite-release-window.ts` | Include/exclude release dates |
| `apps/server/src/lib/people-search-rank.ts` | Extend with favorites-first band |
| `apps/server/src/lib/person-favorite.ts` | Upsert/delete/list/count + baseline credits |
| `apps/server/src/routes/people.ts` | Favorite CRUD; search/popular `isFavorited` |
| `apps/server/src/routes/profiles.ts` | `personFavoritesCount` + `GET .../person-favorites` |
| `apps/server/src/lib/person-favorite-release-alerts.ts` | Release scan job |
| `apps/server/src/lib/person-favorite-streaming-alerts.ts` | Streaming scan job |
| `apps/server/src/jobs/run-local-scheduler.ts` | Schedule both jobs |
| `apps/web/src/components/people/person-detail-favorite-button.tsx` | Hero Favorite pill |
| `apps/web/src/components/profile/profile-person-favorites-drawer.tsx` | Vaul drawer (follows pattern) |
| `apps/web/src/components/home/search-dialog-people-rail.tsx` (+ cast-crew rows) | Star + favorited sort already from API |
| `apps/server` + `apps/web` notification/product-event registries | New kinds + events |

---

### Task 1: Schema + migration `0043`

**Files:**
- Create: `packages/db/src/schema/person-favorite.ts`
- Create: `packages/db/src/migrations/0043_person_favorite.sql`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/migrations/meta/_journal.json` (tag `0043_person_favorite`, idx 43)

**Schema sketch:**

```ts
// person_favorite: userId, tmdbPersonId, name, profileUrl, knownForDepartment?, createdAt
// unique (userId, tmdbPersonId)

// person_favorite_credit_seen: userId, tmdbPersonId, mediaKind ('movie'|'tv'), tmdbId, roleKey, seenAt
// unique (userId, tmdbPersonId, mediaKind, tmdbId, roleKey)
```

- [ ] **Step 1:** Add Drizzle tables + SQL migration + journal entry + `export * from "./person-favorite"`.
- [ ] **Step 2:** Run `cd packages/db && bun run db:migrate` (or monorepo migrate script). Expected: applies `0043` cleanly.
- [ ] **Step 3:** Smoke — tables exist (optional `psql` / Drizzle introspect). No product UI yet.

---

### Task 2: Pure helpers (TDD) — role, release window, favorites-first rank

**Files:**
- Create: `apps/server/src/lib/person-favorite-role.ts`
- Create: `apps/server/src/lib/person-favorite-role.test.ts`
- Create: `apps/server/src/lib/person-favorite-release-window.ts`
- Create: `apps/server/src/lib/person-favorite-release-window.test.ts`
- Modify: `apps/server/src/lib/people-search-rank.ts`
- Modify: `apps/server/src/lib/people-search-rank.test.ts`

**Interfaces:**

```ts
export type PersonCreditRoleInput =
  | { kind: "cast"; character?: string | null }
  | { kind: "crew"; job?: string | null };

/** Stable fingerprint for seen-store (e.g. "cast:paul atreides" / "crew:director"). */
export function personFavoriteRoleKey(input: PersonCreditRoleInput): string;

/** Inbox / pill copy verb phrase: "stars in" | "directed" | "wrote" | "worked on". */
export function personFavoriteRoleLabel(input: PersonCreditRoleInput): string;

export function isPersonFavoriteReleaseInNotifyWindow(
  releaseDateIso: string | null | undefined,
  now?: Date,
): boolean; // upcoming ≤30d OR past ≤7d UTC calendar days

export function rankPeopleFavoritesFirst<T extends { id: number }>(
  rows: readonly T[],
  favoritedIds: ReadonlySet<number>,
  thenRank: (rows: readonly T[]) => T[],
): T[];
```

- [ ] **Step 1: Write failing tests** for role key/label (Director → directed / crew:director; cast → stars in; empty → worked on), release window include/exclude, and favorites sorted above traffic order.
- [ ] **Step 2:** `cd apps/server && bun test src/lib/person-favorite-role.test.ts src/lib/person-favorite-release-window.test.ts src/lib/people-search-rank.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** helpers; extend `rankPeopleBySearchTraffic` usage via `rankPeopleFavoritesFirst` (do not break existing traffic tests).
- [ ] **Step 4:** Same test command — expect PASS.

---

### Task 3: Favorite CRUD + credit baseline (TDD lib, then routes)

**Files:**
- Create: `apps/server/src/lib/person-favorite.ts`
- Create: `apps/server/src/lib/person-favorite.test.ts` (pure baseline/diff helpers; mock DB only if existing patterns allow — prefer pure extract for baseline plan)
- Modify: `apps/server/src/routes/people.ts`
- Modify: `apps/server/src/lib/product-event-kinds.ts` (+ web mirror)
- Modify: `apps/server/src/lib/tmdb.ts` if combined_credits fetch helper missing

**API:**

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/people/:id/favorite` | Auth; upsert snapshot from TMDb person; baseline all current combined credits into seen; `person_favorite.add` |
| `DELETE` | `/api/people/:id/favorite` | Auth; delete favorite + seen rows for that person; `person_favorite.remove` |
| `GET` | `/api/people/:id/favorite` | Auth; `{ favorited: boolean }` |

Baseline helper (pure): given credit list → rows for insert; **never** calls `deliverNotification`.

- [ ] **Step 1:** Tests for baseline mapping (no notify flags) + role_key uniqueness per credit.
- [ ] **Step 2:** Implement lib + wire routes under `peopleRoute` **before** `/:id` if needed (static paths like `/search` — favorite is under `/:id/favorite`, fine after `/:id` GET or as nested handlers).
- [ ] **Step 3:** Manual curl / Eden smoke with session cookie.
- [ ] **Step 4:** Record product events on add/remove.

---

### Task 4: Person detail Favorite CTA

**Files:**
- Create: `apps/web/src/components/people/person-detail-favorite-button.tsx`
- Modify: `apps/web/src/components/people/person-detail-hero.tsx` (or shell) — mount signed-in only
- Modify: `apps/web/src/lib/still-api-fetch.ts` if helpers needed

**Behavior:** Optimistic toggle Favorite / Favorited; hydrate via `GET .../favorite`; failure → toast. Nucleo **star** (filled when on). Match quiet detail action chrome (`DETAIL_CANVAS_ON_CARD_HOVER_CLASS` / existing hero action row if any).

- [ ] **Step 1:** Wire button; signed-out hides pill.
- [ ] **Step 2:** Manual QA on `/people/[id]` — toggle persists across refresh.

---

### Task 5: Profile count + list API

**Files:**
- Modify: `apps/server/src/routes/profiles.ts` — add `personFavoritesCount` beside `filmographyCounts`; add `GET /api/profiles/:handle/person-favorites?cursor=`
- Create: small lib helper for count/list if profiles.ts is already huge

**Access:** Same public-profile gate as other public chrome; private → 404 or empty per existing profile list patterns. Paginate (~24).

- [ ] **Step 1:** Unit/route test if profiles have a test harness; else focused lib test for count query shape.
- [ ] **Step 2:** Implement + verify JSON includes `personFavoritesCount` on profile GET.

---

### Task 6: Profile Favorites pill + drawer UI

**Files:**
- Create: `apps/web/src/components/profile/profile-person-favorites-drawer.tsx` (Zustand open store + `DetailVaulSheet`, mirror `profile-follows-drawer.tsx`)
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx` — Favorites `ProfileStatCell` with `onClick`
- Modify: profile lobby shell types for count

**Behavior:** Show count including **0**. Owner rows can unfavorite (DELETE + refresh). Visitor browse-only. Empty copy per spec.

- [ ] **Step 1:** Implement drawer + pill.
- [ ] **Step 2:** Manual QA — public profile, open drawer, owner unfavorite.

---

### Task 7: Search star + favorites-first

**Files:**
- Modify: `apps/server/src/routes/people.ts` — `/search` + `/popular`: load viewer favorite ids; set `isFavorited`; `rankPeopleFavoritesFirst` then traffic rank
- Modify: `apps/server/src/lib/people-search-row.ts` — pass through `isFavorited?: boolean`
- Modify: `apps/web` people rail / cast-crew result rows — star when `isFavorited`

- [ ] **Step 1:** Extend `people-search-rank.test.ts` coverage already done in Task 2; add route-level mapping test if cheap.
- [ ] **Step 2:** Wire API + UI stars.
- [ ] **Step 3:** Manual — ⌘K People: favorited person shows star and leads results when queried.

---

### Task 8: Notification kinds + Settings + inbox wiring

**Files:**
- Modify: `apps/server/src/lib/notification-delivery.ts` — add `person_favorite_release`, `person_favorite_now_streaming` (`defaultEnabled: true`)
- Modify: `apps/web/src/lib/notification-preferences.ts` — mirror labels/descriptions under watching group
- Modify: Settings notifications panel (auto if driven by registry)
- Modify: `apps/web/src/lib/notification-href.ts` — deep link from payload `mediaKind` + `tmdbId`
- Modify: notifications list/dropdown icons/copy if kind-specific UI needed
- Modify: product-event kinds — `person_favorite_alert.sent`

**Payload shape:** `{ personId, personName, mediaKind, tmdbId, title, roleLabel, providerName?, releaseDate? }`

- [ ] **Step 1:** Tests for href builder + prefs merge includes new kinds with defaults true.
- [ ] **Step 2:** Implement registries + href.
- [ ] **Step 3:** Confirm Settings shows two toggles.

---

### Task 9: Release scan job (TDD)

**Files:**
- Create: `apps/server/src/lib/person-favorite-release-alerts.ts`
- Create: `apps/server/src/lib/person-favorite-release-alerts.test.ts`
- Modify: `apps/server/src/jobs/run-local-scheduler.ts` — e.g. `"person-favorite-release"`

**Pure core:** given favorite + credits + seen set + now → `{ notify[], markSeenSilent[] }` using release window + role label.

**Job loop:** batch favorites → TMDb combined credits (rate-limit) → apply core → `deliverNotification` when pref on → insert seen → `person_favorite_alert.sent`.

- [ ] **Step 1: Failing tests** — in window notifies; outside marks silent; already seen skips; pref off skips insert but still marks seen (lock: mark seen to avoid storm when pref later enabled — **document in test**; if notifying later is desired, mark seen only after notify — **spec says mark seen without notify outside window**; for pref-off in-window: mark seen without notify to match watchlist caution — confirm in implementation comment).
- [ ] **Step 2:** Implement + schedule.
- [ ] **Step 3:** `bun test` PASS. Optional dry-run with `RUN_LOCAL_JOBS`.

---

### Task 10: Streaming scan job (TDD)

**Files:**
- Create: `apps/server/src/lib/person-favorite-streaming-alerts.ts`
- Create: `apps/server/src/lib/person-favorite-streaming-alerts.test.ts`
- Reuse: `watchlist-streaming-alerts.ts` provider diff helpers where possible (extract shared `diffFlatrateProviders` if needed — prefer reuse over copy)
- Modify: scheduler — `"person-favorite-streaming"`

**Scope v1:** For credits already released (or newly past release) that are in seen store, resolve flatrate for patron `catalogTmdbWatchRegion`; diff vs snapshot (new table **or** reuse `watchlist_streaming_snapshot` keyed by user+title+region — prefer **reuse snapshot table** when title also on watchlist; else insert snapshot rows the same way so one title doesn’t double-notify from both systems — dedupe: if `watchlist_now_streaming` already fired for same user+title+provider, skip person alert **or** allow both with different copy — **lock: allow both** distinct kinds; still dedupe person kind per user+title+provider).

- [ ] **Step 1: Failing tests** for provider diff → notify payload with roleLabel + providerName.
- [ ] **Step 2:** Implement + schedule.
- [ ] **Step 3:** Tests PASS.

---

### Task 11: Verification + polish

**Automated:**
- [ ] `cd apps/server && bun test src/lib/person-favorite*.test.ts src/lib/people-search-rank.test.ts`
- [ ] `cd apps/web && bun test` for any new web unit tests added
- [ ] Biome clean on touched files

**Manual QA checklist:**
- [ ] Favorite on person page; refresh stays Favorited
- [ ] Profile shows Favorites count; drawer lists people; owner can remove
- [ ] Private profile: visitors don’t see Favorites chrome
- [ ] Search / popular people: star + favorites sort first
- [ ] Settings: two toggles default on
- [ ] Seed seen + force release job on a fixture credit in window → inbox row + deep link
- [ ] Streaming job: new flatrate → `person_favorite_now_streaming` copy names role + provider
- [ ] Unfavorite stops future alerts; baseline on re-favorite does not spam old credits

---

## Execution notes

- Prefer **one task per subagent**; human **go** between tasks.
- Never `.select` whole `movie`/`tv` rows for jobs — project columns needed only.
- TMDb rate limits: batch by distinct `tmdb_person_id`, cache person credits briefly in-process per job run.
- After code changes in a session, run `graphify update .` if graphify is available.
