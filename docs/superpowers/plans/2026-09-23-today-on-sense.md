# Today on Sense — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a signed-in Home **Today on Sense** module (taste-hero pick + Your week + From your circle), with instant watch + optional category ratings in the watch-log flow, and a minimal reciprocal **Recommend back** loop.

**Architecture:** `TodayOnSense` shell at the top of `/home` (under sticky chrome, before browse body) with three independent Suspense streams. Reuse taste-hero **presentation** and for-you scoring; shell owns pick **complete** / **Pick another**. New DB for `title_recommendation` + `log.category_ratings` + nullable `watch_venue`. Mutation APIs for recommend / category patch; RSC reads via server libs (no blocking `GET /api/today`).

**Tech stack:** Drizzle/Neon, Elysia, Bun test, Next.js App Router RSC/Suspense, Vaul sheets, existing `product_event` + notification registries, `HomeTasteMatchedHero` presentation.

**Spec:** `docs/superpowers/specs/2026-09-23-today-on-sense-design.md`

## Global constraints

- Slice 1 only — no streaming-alert row, multi-item social feed, streak challenges, nav IA, or paywall on Today.
- Movies-first Today Pick (reuse for-you); TV continue-watching stays on `browse=tv`.
- Never fabricate friend activity; circle empty → invite copy.
- After watched/watchlist: **no auto-swap**; explicit **Pick another**. After **Not interested**: may advance immediately.
- Instant Home watched: date = today; **`watchVenue` null** (not default `streaming`); respect profile default visibility.
- Category ratings only in watch-log UI (Home How was it? + Quick Log) — not title hero, not Today RSC payload.
- Detail: quiet **Today’s pick** cue only; no special Recommend CTA on detail.
- Next migration after `0044_person_favorite_alerts_enabled` is **`0045_*`** — must register in `packages/db/src/migrations/meta/_journal.json`.
- New notification kinds → both `apps/server/src/lib/notification-delivery.ts` and `apps/web/src/lib/notification-preferences.ts`.
- New product events → both `apps/server` and `apps/web` `product-event-kinds.ts`; client-fireable kinds also in `CLIENT_PRODUCT_EVENT_KINDS`.
- Verify with scoped `bunx biome check <files>` (no `--write` on whole repo). Prefer `bun test` paths under `apps/server` / `apps/web`.

---

## File map

| File | Responsibility |
| --- | --- |
| `packages/db/src/schema/activity.ts` | Nullable `watchVenue`; `categoryRatings` jsonb on `log` |
| `packages/db/src/schema/title-recommendation.ts` | `title_recommendation` table |
| `packages/db/src/migrations/0045_today_on_sense.sql` | Migration + journal |
| `apps/server/src/lib/log-category-ratings.ts` | Keys, tenths validation, suggested overall |
| `apps/server/src/lib/today-week-pulse.ts` | Patron-TZ week counts + day marks |
| `apps/server/src/lib/today-circle-activity.ts` | One visible followee watched/review row |
| `apps/server/src/lib/title-recommendation.ts` | Suggest / send / open / accept / answer |
| `apps/server/src/routes/logs.ts` | Category patch; allow null venue; instant create path |
| `apps/server/src/routes/recommendations.ts` | Recommend CRUD + suggestions |
| `apps/server/src/server/app.ts` | Mount recommendations route |
| `apps/web/src/components/home/today-on-sense.tsx` | Shell + pick completion state |
| `apps/web/src/components/home/today-week-card.tsx` | Week compact card |
| `apps/web/src/components/home/today-circle-card.tsx` | Circle / invite card |
| `apps/web/src/components/home/today-pick-how-was-it.tsx` | Post-watch inline rating |
| `apps/web/src/components/log/log-category-ratings-panel.tsx` | Shared category UI |
| `apps/web/src/components/recommend/recommend-back-sheet.tsx` | Vaul recommend flow |
| `apps/web/src/lib/today-pick-continuity.ts` | Session/query flag for detail cue |
| `apps/web/src/app/(app)/home/page.tsx` | Mount Today above browse body |
| `apps/web/.../movie` detail hero | Today’s pick label when continuity flag set |
| Product event + notification registries | New kinds |

---

### Task 1: Pure helpers — category ratings + week pulse window (TDD)

**Files:**
- Create: `apps/server/src/lib/log-category-ratings.ts`
- Create: `apps/server/src/lib/log-category-ratings.test.ts`
- Create: `apps/server/src/lib/today-week-pulse.ts` (pure date helpers only in this task)
- Create: `apps/server/src/lib/today-week-pulse.test.ts`

**Interfaces:**

```ts
export const LOG_CATEGORY_KEYS = [
  "plot",
  "characters",
  "writing",
  "acting",
  "visuals",
  "sound",
  "enjoyment",
] as const;
export type LogCategoryKey = (typeof LOG_CATEGORY_KEYS)[number];

/** Tenths 0–100; omit skipped keys. */
export type LogCategoryRatings = Partial<Record<LogCategoryKey, number>>;

export function parseLogCategoryRatings(raw: unknown): LogCategoryRatings;
export function suggestedOverallFromCategories(
  ratings: LogCategoryRatings,
): number | null; // display 0–10, mean of present keys only; null if none

export function startOfPatronWeek(now: Date, timeZone: string): Date;
export function patronWeekDayMarks(
  watchedAtIsoList: readonly string[],
  timeZone: string,
  now?: Date,
): boolean[]; // length 7 Sun→Sat or Mon→Sun — pick one and lock in tests (prefer locale weekStart if available; else Monday-start ISO)
```

- [ ] **Step 1: Write failing tests** — skip keys absent; zeros not invented; suggestion ignores skipped; empty → null; week window boundaries in `America/New_York` vs `UTC`.
- [ ] **Step 2:** `cd apps/server && bun test src/lib/log-category-ratings.test.ts src/lib/today-week-pulse.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** pure helpers only (no DB).
- [ ] **Step 4:** Same test command — expect PASS.
- [ ] **Step 5: Commit** `feat(today): category rating and week-window helpers`

---

### Task 2: Migration `0045` — category ratings, nullable venue, title_recommendation

**Files:**
- Create: `packages/db/src/schema/title-recommendation.ts`
- Create: `packages/db/src/migrations/0045_today_on_sense.sql`
- Modify: `packages/db/src/schema/activity.ts` — `categoryRatings` jsonb nullable; `watchVenue` drop `.notNull()` / allow null (legacy default still `streaming` for new Quick Log unless Today path passes null)
- Modify: `packages/db/src/schema/index.ts` — export recommendation schema
- Modify: `packages/db/src/migrations/meta/_journal.json` — tag `0045_today_on_sense`, next idx

**Schema sketch:**

```ts
// log.category_ratings jsonb | null  — Partial<Record<LogCategoryKey, number>> tenths
// log.watch_venue text nullable      — null = unset (surfaces in both diary venue slices like legacy)

// title_recommendation:
//   id text PK
//   sender_user_id, recipient_user_id text FK user
//   movie_id int null, tv_id int null  — xor check
//   reason_code text null
//   note text null (max ~280)
//   sensitive_scrub boolean not null default false
//   created_at, opened_at, accepted_at, answered_at timestamps null
//   answer_recommendation_id text null FK self (optional)
```

- [ ] **Step 1:** Add Drizzle tables/columns + SQL + journal + exports.
- [ ] **Step 2:** `cd packages/db && bun run db:migrate` — expect `0045` applies.
- [ ] **Step 3: Commit** `feat(db): today on sense schema (categories, null venue, recommendations)`

---

### Task 3: Log API — null venue, category patch, instant Home create semantics

**Files:**
- Modify: `apps/server/src/routes/logs.ts`
- Create: `apps/server/src/lib/log-category-ratings-route.test.ts` (or extend existing logs tests if present)
- Mirror any web types that assume venue always set

**Behavior locks:**
- `POST /api/logs`: allow `watchVenue: null` (or omit with body flag `venueUnset: true` — prefer explicit `watchVenue: null` in JSON). Today Home uses null; Quick Log keeps defaulting to `streaming` when omitted (preserve AGENTS default for normal compose).
- `PATCH /api/logs/:id`: accept `{ rating?, categoryRatings?, watchVenue? }` — merge category map (replace provided keys; support clearing a key with `null` if needed).
- Instant create may omit `rating`; set `rewatch: true` when caller sends it or server detects prior log for same title (document which — prefer **client sends `rewatch`** after a prior-log check to avoid double query races).

- [ ] **Step 1: Write failing tests** for category merge + suggested overall helper already covered; route-level tests if the repo has logs route tests — otherwise pure merge helper `mergeCategoryRatings(prev, patch)`.
- [ ] **Step 2: Implement** route changes + `mergeCategoryRatings` in `log-category-ratings.ts`.
- [ ] **Step 3:** Run targeted tests — PASS.
- [ ] **Step 4: Commit** `feat(logs): category ratings patch and nullable watch venue`

---

### Task 4: Week pulse server lib + RSC card

**Files:**
- Extend: `apps/server/src/lib/today-week-pulse.ts` — `fetchTodayWeekPulse(userId, timeZone)`
- Create: `apps/web/src/lib/fetch-today-week-pulse-server.ts` (cookie-forwarded server call or direct if web can import server lib — **prefer Eden/`serverApi` thin route** only if RSC cannot import `@still/db` safely; this monorepo usually uses `serverApi` for home — add `GET /api/today/week?tz=` thin read)
- Create: `apps/server/src/routes/today.ts` — `GET /week`, `GET /circle` (reads only)
- Create: `apps/web/src/components/home/today-week-card.tsx` (+ skeleton)
- Create: `apps/web/src/components/home/today-week-card-rsc.tsx`

**Payload:**

```ts
type TodayWeekPulse = {
  titlesLogged: number;
  titlesRated: number;
  dayMarks: boolean[]; // 7
  empty: boolean;
};
```

Copy: `"{n} titles logged · {m} rated"` / empty “Your week starts with one log.”  
CTA: empty → Log a title (open Quick Log or `/diary`); else → `/diary`.

- [ ] **Step 1: TDD** count queries against fixtures or pure aggregation from log rows.
- [ ] **Step 2: Implement** lib + `GET /api/today/week`.
- [ ] **Step 3: RSC card** with Suspense skeleton + error quiet retry.
- [ ] **Step 4: Commit** `feat(today): your week pulse card`

---

### Task 5: Circle activity server lib + RSC card

**Files:**
- Create: `apps/server/src/lib/today-circle-activity.ts` (+ test)
- Extend: `apps/server/src/routes/today.ts` — `GET /circle`
- Create: `apps/web/src/components/home/today-circle-card.tsx` (+ skeleton, invite empty)
- Create: `apps/web/src/components/home/today-circle-card-rsc.tsx`

**Selection rules:**
- Most recent **public** (or viewer-visible) diary log from a user the viewer follows, with optional linked review excerpt (first ~120 chars) when visibility allows.
- Apply adult/sensitive filters using existing adult prefs + content visibility helpers (`contentVisibilityWhere`, `movieNotAdultSql` patterns from feed/logs).
- If none → `{ kind: "invite" }`.

**Payload:**

```ts
type TodayCirclePayload =
  | {
      kind: "activity";
      actor: { userId: string; handle: string; displayName: string };
      title: { mediaKind: "movie" | "tv"; tmdbId: number; name: string; posterPath: string | null };
      ratingDisplay: number | null;
      excerpt: string | null;
      logId: string;
    }
  | { kind: "invite" };
```

Primary CTA on activity: **Recommend back** (wire stub button until Task 8–9). Invite → existing Invite & earn entry.

- [ ] **Step 1: TDD** privacy filter: private log excluded; adult hidden when viewer pref off.
- [ ] **Step 2: Implement** lib + route + card UI (button can no-op with TODO comment only if Task 8 lands same PR wave — prefer disabled until sheet exists, or ship sheet in Task 8 before enabling).
- [ ] **Step 3: Commit** `feat(today): from your circle card`

---

### Task 6: TodayOnSense shell + pick completion (no auto-swap)

**Files:**
- Create: `apps/web/src/components/home/today-on-sense.tsx`
- Create: `apps/web/src/components/home/today-on-sense-rsc.tsx` (parallel Suspense children)
- Create: `apps/web/src/lib/today-pick-state.ts` (+ test) — pure state transitions
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx` — accept props: `completionMode: "legacy-autoswap" | "today-shell"`; when `today-shell`, after watchlist/watched call `onPickComplete` instead of removing/swapping; **Not interested** still advances
- Modify: `apps/web/src/app/(app)/home/page.tsx` — for signed-in patrons, render `TodayOnSense` at top of `HomeLobbyCatalogueSection` (or immediately inside it **above** `HomeLobbyBodyGate`); remove duplicate taste hero from movies-only branch (Today owns the pick)

**State machine (pure):**

```ts
type TodayPickPhase = "active" | "just_logged" | "complete";

function reduceTodayPick(
  phase: TodayPickPhase,
  event:
    | { type: "logged"; logId: string }
    | { type: "undo" }
    | { type: "watchlisted" }
    | { type: "pick_another" }
    | { type: "not_interested_advanced" },
): TodayPickPhase;
```

- [ ] **Step 1: TDD** `reduceTodayPick` transitions.
- [ ] **Step 2: Shell UI** — heading “Today on Sense”; Pick slot; week + circle Suspense siblings.
- [ ] **Step 3: Wire hero** completionMode; **Pick another** refetches for-you / advances queue.
- [ ] **Step 4: Mount** on `/home` signed-in; ensure Community/TV still show Today above their lobbies.
- [ ] **Step 5: Commit** `feat(today): TodayOnSense shell with shell-owned pick completion`

---

### Task 7: Instant watched + How was it? + Undo on Home

**Files:**
- Create: `apps/web/src/components/home/today-pick-how-was-it.tsx`
- Modify: today shell / hero actions — **Watched** posts log immediately (null venue, today date, visibility default); prior log → `rewatch: true`
- Wire **Undo** → `DELETE /api/logs/:id`
- On success: phase `just_logged` → show confirmation + How was it?; update week card via callback/`router.refresh` or local week bump
- Dispatch existing `taste-title-consumed` / complete events so catalogue stays consistent **without** auto-swapping the hero until Pick another

- [ ] **Step 1: Implement** instant create + undo + confirmation chrome.
- [ ] **Step 2: How was it?** overall slider Save/Skip; mount `LogCategoryRatingsPanel` collapsed (Task 8 can flesh panel).
- [ ] **Step 3: Manual QA checklist** in commit body — venue null in DB; undo removes log; Pick another required.
- [ ] **Step 4: Commit** `feat(today): instant watched with undo and how-was-it`

---

### Task 8: Shared category ratings panel + Quick Log parity

**Files:**
- Create: `apps/web/src/components/log/log-category-ratings-panel.tsx`
- Create: `apps/web/src/lib/log-category-ratings.ts` (client mirror of keys + suggestion display helper — or import from shared package if one exists; otherwise duplicate thin constants with server as source of truth)
- Modify: `apps/web/src/components/log/quick-log-sheet.tsx` / celebration strip — after create, show overall then collapsed **Rate by category · Optional**
- PATCH categories + optional overall; track `rating.category_*` client events

- [ ] **Step 1: TDD** client suggestion helper if separate.
- [ ] **Step 2: Panel UI** — one category at a time, Skip, Done, progress N/7, suggestion apply.
- [ ] **Step 3: Wire** Home How was it? + Quick Log.
- [ ] **Step 4: Commit** `feat(log): optional category ratings in watch-log flow`

---

### Task 9: Title recommendation API + notification

**Files:**
- Create: `apps/server/src/lib/title-recommendation.ts` (+ test)
- Create: `apps/server/src/routes/recommendations.ts`
- Modify: `apps/server/src/server/app.ts`
- Modify: notification registries — kind `title_recommendation` (or `recommendation_received`)
- Modify: `apps/web/src/lib/notification-href.ts` — deep link to title (+ optional `?recommend=` id for open tracking)
- Product events: `recommendation.sent` (server), client: `opened` / `accepted` / `answered` as appropriate

**Endpoints:**
- `GET /api/recommendations/suggest?recipientUserId=` → three titles (highly rated unwatched-by-recipient-if-visible, + list picks when available) + flags `alreadyWatchedVisible`
- `POST /api/recommendations` → create row + `deliverNotification` (scrub preview if sensitive)
- `POST /api/recommendations/:id/open`
- `POST /api/recommendations/:id/accept` → watchlist add + `accepted_at`
- `POST /api/recommendations/:id/answer` → links answer send

Reason codes enum: `same_mood` | `you_would_love` | `hidden_gem` | `watch_together` | `because_you_liked`

- [ ] **Step 1: TDD** suggestion filter (no private list leak; already-watched only when visible).
- [ ] **Step 2: Implement** routes + notify copy “{sender} thinks you’d like {title}”.
- [ ] **Step 3: Commit** `feat(recommend): title recommendation API and inbox kind`

---

### Task 10: Recommend back sheet + circle wiring + recipient actions

**Files:**
- Create: `apps/web/src/components/recommend/recommend-back-sheet.tsx`
- Modify: `today-circle-card.tsx` — open sheet with recipient preselected
- Modify: notifications list/dropdown — actions **Add to watchlist** / **Recommend something back** for this kind
- Sensitive confirm dialog before send when title adult/sensitive

Flow: pick (3 + search) → confirm (optional reason/note) → Send → card “Recommendation sent”.

- [ ] **Step 1: Sheet UI** matching Vaul detail patterns (`DetailVaulSheet` or app modal layer).
- [ ] **Step 2: Wire** circle + notification actions.
- [ ] **Step 3: Commit** `feat(recommend): recommend-back sheet and notification actions`

---

### Task 11: Detail continuity cue + Back restore

**Files:**
- Create: `apps/web/src/lib/today-pick-continuity.ts` — `still:today-pick:v1` sessionStorage `{ tmdbId, reason, mediaKind }` set when navigating from Today pick; clear on Pick another
- Modify: movie (and TV if linked) detail hero — if continuity matches id, show **Today’s pick** + reason line
- Confirm existing lobby scroll restore / `useMovieDetailReturn` still returns to `/home` without forcing scroll-top when appropriate (follow existing detail return patterns; do not invent a new scroll system)

Logging from detail must dispatch the same pick-complete signal (CustomEvent) so Home shows complete without auto-rotate.

- [ ] **Step 1: Continuity helpers + tests**.
- [ ] **Step 2: Detail cue UI** (small, non-competing).
- [ ] **Step 3: Cross-surface complete event**.
- [ ] **Step 4: Commit** `feat(today): detail continuity cue and pick-complete sync`

---

### Task 12: Instrumentation + home events + QA pass

**Files:**
- Modify: `apps/server/src/lib/product-event-kinds.ts` + web mirror — add:
  - `today.viewed`, `today.pick.viewed`, `today.pick.action`, `today.week.viewed`, `today.week.action`, `today.circle.viewed`, `today.circle.action`
  - `rating.category_saved`, `rating.category_skipped`, `rating.suggestion_applied`
  - `recommendation.sent`, `recommendation.opened`, `recommendation.accepted`, `recommendation.answered`
- Fire from shell/cards/sheet/APIs as specified in the design doc
- Add any missing unit tests from design Testing section

- [ ] **Step 1: Registry updates** (server + web + CLIENT list for browser-fired).
- [ ] **Step 2: Wire track calls** (Impression once per mount via ref).
- [ ] **Step 3: Run** server + web targeted tests; biome on touched files.
- [ ] **Step 4: Commit** `feat(today): product events for today and recommendations`

---

## Spec coverage checklist

| Spec requirement | Task(s) |
| --- | --- |
| Today shell placement above browse | 6 |
| Pick = taste hero presentation; shell completion | 6–7 |
| Your week card | 4 |
| From your circle + invite empty | 5 |
| Instant watch, undo, null venue | 2–3, 7 |
| Category ratings in watch-log | 1–3, 8 |
| Recommend back sheet + notify | 9–10 |
| Detail Today’s pick cue | 11 |
| Parallel Suspense; no blocking today aggregate | 4–6 |
| Privacy / no fake activity | 5, 9 |
| Instrumentation | 12 |
| Deferred: watchlist engine, feeds, nav, monetization | — out of plan |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-23-today-on-sense.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
