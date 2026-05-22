# TV Watching Progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Trakt-style TV progress (`tv_watch` + episode/season tracking) and Letterboxd-style scoped diary logs (`show` / `season` / `episode`), with in-app new-episode notifications and a continue-watching rail.

**Architecture:** Hybrid model — `tv_watch` owns lifecycle status and progress; `log` rows remain optional diary moments with `log_scope` + season/episode numbers. TMDb season/episode lists are cached server-side for pickers and validation. Notifications reuse generic `notification` rows with kind `tv.new_episode`.

**Tech Stack:** Drizzle ORM (`packages/db`), Elysia (`apps/server`), Next.js App Router + `motion/react` (`apps/web`), TMDb TV API, Bun tests.

**Spec:** `docs/superpowers/specs/2026-05-20-tv-watching-progress-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema/tv-watch.ts` | Create | `tv_watch`, `tv_watch_episode` tables + relations |
| `packages/db/src/schema/activity.ts` | Modify | `log_scope`, `season_number`, `episode_number` on `log` |
| `packages/db/src/schema/index.ts` | Modify | Export tv-watch schema |
| `packages/db/src/migrations/0006_tv_watch.sql` | Create | Generated migration |
| `apps/server/src/lib/tv-progress-defaults.ts` | Create | Heuristics for default `progress_mode` |
| `apps/server/src/lib/tv-season-cache.ts` | Create | Fetch/cache TMDb seasons + episodes per `tv_id` |
| `apps/server/src/routes/tv-watch.ts` | Create | CRUD + progress endpoints |
| `apps/server/src/routes/tv.ts` | Modify | `GET /:id/seasons`, `GET /:id/season/:n` |
| `apps/server/src/routes/logs.ts` | Modify | Accept/validate scope fields on create/patch |
| `apps/server/src/jobs/tv-new-episode-sync.ts` | Create | Compare air dates → insert notifications |
| `apps/server/src/index.ts` | Modify | Register `tvWatchRoute` |
| `apps/web/src/lib/tv-watch-types.ts` | Create | Shared types + status labels |
| `apps/web/src/lib/still-api-fetch.ts` | Modify | Client fetch helpers for tv-watch + seasons |
| `apps/web/src/lib/tv-watch-defaults.ts` | Create | Mirror server heuristics for UI defaults |
| `apps/web/src/components/tv/use-tv-watch.ts` | Create | SWR/query hook for show page |
| `apps/web/src/components/tv/tv-detail-primary-actions.tsx` | Modify | Start watching, status, mark next |
| `apps/web/src/components/tv/tv-detail-progress-panel.tsx` | Create | Season vs episode UI |
| `apps/web/src/components/log/quick-log-sheet.tsx` | Modify | TV scope picker + season/episode selects |
| `apps/web/src/components/diary/diary-log-card.tsx` | Modify | Scope chips `S2E5` / `Season 1` |
| `apps/web/src/components/home/home-continue-watching-rail.tsx` | Create | Rail for active `tv_watch` rows |
| `apps/web/src/app/(app)/home/page.tsx` | Modify | Mount continue rail |
| `apps/web/src/components/notifications/notification-item.tsx` | Modify | Render `tv.new_episode` |
| `apps/web/src/lib/tv-watch-validation.test.ts` | Create | Scope validation unit tests |
| `apps/server/src/lib/tv-watch-validation.ts` | Create | Shared validation (importable from tests via duplicate or `@still/db` types) |
| `.cursor/scratchpad.md` | Modify | Track W.1–W.4 milestones |

---

## Phase W.1 — Schema + API core

### Task 1: Drizzle schema for `tv_watch`

**Files:**
- Create: `packages/db/src/schema/tv-watch.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Define tables**

```ts
// packages/db/src/schema/tv-watch.ts
export type TvWatchStatus =
  | "watching"
  | "paused"
  | "abandoned"
  | "finished"
  | "rewatching";

export type TvProgressMode = "season" | "episode";

export const tvWatch = pgTable(
  "tv_watch",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    tvId: integer("tv_id").notNull().references(() => tv.tmdbId, { onDelete: "restrict" }),
    status: text("status").$type<TvWatchStatus>().notNull().default("watching"),
    progressMode: text("progress_mode").$type<TvProgressMode>().notNull().default("season"),
    lastSeason: smallint("last_season"),
    lastEpisode: smallint("last_episode"),
    notifyNewEpisodes: boolean("notify_new_episodes").default(true).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    statusChangedAt: timestamp("status_changed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex("tv_watch_user_tv_uk").on(t.userId, t.tvId),
    index("tv_watch_user_status_idx").on(t.userId, t.status),
  ],
);

export const tvWatchEpisode = pgTable(
  "tv_watch_episode",
  {
    tvWatchId: text("tv_watch_id").notNull().references(() => tvWatch.id, { onDelete: "cascade" }),
    seasonNumber: smallint("season_number").notNull(),
    episodeNumber: smallint("episode_number").notNull(),
    watchedAt: timestamp("watched_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tv_watch_episode_uk").on(t.tvWatchId, t.seasonNumber, t.episodeNumber),
  ],
);
```

- [ ] **Step 2: Export from `packages/db/src/schema/index.ts`**

- [ ] **Step 3: Generate migration**

Run from repo root:

```bash
cd packages/db && bun run db:generate
```

Expected: new `0006_*.sql` with `tv_watch`, `tv_watch_episode`.

- [ ] **Step 4: Apply locally**

```bash
cd packages/db && bun run db:migrate
```

---

### Task 2: Extend `log` for scoped TV diary

**Files:**
- Modify: `packages/db/src/schema/activity.ts`
- Modify: `apps/server/src/routes/logs.ts`

- [ ] **Step 1: Add columns**

```ts
logScope: text("log_scope").$type<"show" | "season" | "episode">().default("show"),
seasonNumber: smallint("season_number"),
episodeNumber: smallint("episode_number"),
```

Add check: when `tv_id` IS NULL, scope columns must be default/null; when `tv_id` set, `episode` requires both numbers, `season` requires `season_number`.

- [ ] **Step 2: Regenerate migration** (same `db:generate` / `db:migrate`)

- [ ] **Step 3: Extend Elysia body + insert**

```ts
// apps/server/src/routes/logs.ts — logCreateFields
logScope: t.Optional(t.Union([
  t.Literal("show"),
  t.Literal("season"),
  t.Literal("episode"),
])),
seasonNumber: t.Optional(t.Integer({ minimum: 1 })),
episodeNumber: t.Optional(t.Integer({ minimum: 1 })),
```

Validate in handler when `tvId` present; default `logScope` to `"show"` when omitted (backward compatible).

- [ ] **Step 4: Write failing test**

Create `apps/web/src/lib/tv-log-scope.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { validateTvLogScope } from "./tv-log-scope";

describe("validateTvLogScope", () => {
  it("requires season and episode for episode scope", () => {
    expect(
      validateTvLogScope({ logScope: "episode", seasonNumber: 1 }),
    ).toEqual({ ok: false });
  });
  it("allows show scope without numbers", () => {
    expect(validateTvLogScope({ logScope: "show" })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 5: Implement `apps/web/src/lib/tv-log-scope.ts`** (mirror in server import or duplicate minimal fn in `apps/server/src/lib/tv-log-scope.ts`)

- [ ] **Step 6: Run tests**

```bash
cd apps/web && bun test src/lib/tv-log-scope.test.ts
```

Expected: PASS

---

### Task 3: TMDb season/episode cache routes

**Files:**
- Create: `apps/server/src/lib/tv-season-cache.ts`
- Modify: `apps/server/src/lib/tmdb.ts` (add `tvSeason`, `tvSeasonDetail` if missing)
- Modify: `apps/server/src/routes/tv.ts`

- [ ] **Step 1: Add TMDb client methods**

```ts
tvSeasons(tvId: number, language?: string)
tvSeasonDetail(tvId: number, seasonNumber: number, language?: string)
```

- [ ] **Step 2: Cache helper** — store compact JSON on `tv.tmdbJson` subkey or new `tv_season_cache` table (YAGNI: embed under `tv.tmdbJson._seasons` with `lastSyncedAt` TTL 24h)

- [ ] **Step 3: Routes**

```
GET /api/tv/:id/seasons
GET /api/tv/:id/season/:seasonNumber
```

Use `getTmdbLanguageForUser` from `tmdb-poster-language.ts`.

- [ ] **Step 4: Manual smoke**

```bash
curl -s "http://localhost:3001/api/tv/1399/seasons" -H "Cookie: ..."
```

Expected: JSON seasons array for Game of Thrones (or chosen id).

---

### Task 4: `tv-watch` API routes

**Files:**
- Create: `apps/server/src/routes/tv-watch.ts`
- Create: `apps/server/src/lib/tv-progress-defaults.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Progress mode heuristics**

```ts
export function defaultProgressModeForTv(detail: {
  genreIds: number[];
  numberOfSeasons: number | null;
  inProduction: boolean | null;
}): TvProgressMode {
  if (detail.genreIds.includes(16)) return "episode";
  if (detail.inProduction && (detail.numberOfSeasons ?? 0) >= 3) return "episode";
  return "season";
}
```

- [ ] **Step 2: Route sketch**

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/tv-watch/me` | `?status=watching,rewatching` optional |
| GET | `/api/tv-watch/me/by-tv/:tvId` | Single row + watched episodes |
| POST | `/api/tv-watch` | `{ tvId, progressMode? }` — upsert, status `watching` |
| PATCH | `/api/tv-watch/:id` | status, progressMode, notifyNewEpisodes |
| POST | `/api/tv-watch/:id/episodes` | `{ seasonNumber, episodeNumber }` mark watched |
| DELETE | `/api/tv-watch/:id/episodes` | unmark (optional v1) |

Compute `lastSeason` / `lastEpisode` as max watched; expose `nextEpisode` in response DTO.

- [ ] **Step 3: Register route** in server bootstrap

- [ ] **Step 4: Rate limits** — mirror logs (`hit` per user)

**W.1 done when:** migration applied, CRUD works via curl, logs accept scope fields, season list returns.

---

## Phase W.2 — TV detail UX

### Task 5: Client types + fetch helpers

**Files:**
- Create: `apps/web/src/lib/tv-watch-types.ts`
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Create: `apps/web/src/components/tv/use-tv-watch.ts`

- [ ] **Step 1: Types** matching API DTO (`TvWatchRow`, `TvWatchWithProgress`)

- [ ] **Step 2: Fetch functions** `fetchTvWatchByTv`, `startTvWatch`, `patchTvWatch`, `markTvEpisodeWatched`

- [ ] **Step 3: Hook** — load on TV detail mount; optimistic episode checkoff

---

### Task 6: Hero actions — Start watching + status

**Files:**
- Modify: `apps/web/src/components/tv/tv-detail-primary-actions.tsx`
- Modify: `apps/web/src/components/tv/use-tv-detail-user-state.ts`

- [ ] **Step 1: When no `tv_watch`**, show **Start watching** pill (alongside watchlist)

- [ ] **Step 2: When active**, replace/add status dropdown: Watching · Paused · Abandoned · Finished · Rewatching

- [ ] **Step 3: Continue line** under title area: `Next: S02E04` from hook `nextEpisode`

- [ ] **Step 4: Primary CTA in episode mode** — **Mark next episode** (calls mark API, no diary unless user taps Log)

- [ ] **Step 5: Press motion** — reuse `DETAIL_MOTION_PRESSABLE_CLASS` / `useDetailActionMotion`

**Manual test:** Open `/tv/[id]`, start watching, mark episode, refresh — progress persists.

---

### Task 7: Progress panel component

**Files:**
- Create: `apps/web/src/components/tv/tv-detail-progress-panel.tsx`
- Modify: TV detail page shell (find `apps/web/src/app/(app)/tv/[id]/page.tsx` or shared movie-detail layout)

- [ ] **Step 1: Mode toggle** (season | episode) → PATCH `progressMode`

- [ ] **Step 2: Episode mode** — accordion per season, checkbox rows, optimistic toggle

- [ ] **Step 3: Season mode** — season cards + **Mark season complete** → optional toast linking to Quick Log with `season` scope

- [ ] **Step 4: Loading skeletons** — fixed row height, no layout shift

- [ ] **Step 5: `prefers-reduced-motion`** — disable layout animations on checklist

**Manual test:** Toggle modes; complete season; verify API rows in DB.

---

## Phase W.3 — Scoped Quick Log + diary display

### Task 8: Quick Log TV scope UI

**Files:**
- Modify: `apps/web/src/components/log/quick-log-sheet.tsx`

- [ ] **Step 1: When `tvId` set**, show segmented scope: Episode · Season · Show

- [ ] **Step 2: Fetch seasons** on scope change; populate season + episode `<select>` or combobox

- [ ] **Step 3: Submit** includes `logScope`, `seasonNumber`, `episodeNumber`

- [ ] **Step 4: Edit flow** — hydrate scope from existing log row

**Manual test:** Log S1E3 with rating; diary shows chip.

---

### Task 9: Diary cards + list API shape

**Files:**
- Modify diary card component(s) under `apps/web/src/components/diary/`
- Modify: `apps/server/src/routes/logs.ts` GET list serializer if needed

- [ ] **Step 1: Chip formatter**

```ts
export function formatTvLogScopeLabel(scope: string, s?: number | null, e?: number | null) {
  if (scope === "episode" && s && e) return `S${s}E${e}`;
  if (scope === "season" && s) return `Season ${s}`;
  return null; // whole show — no chip
}
```

- [ ] **Step 2: Render chip** next to title on TV diary rows

- [ ] **Step 3: Ensure GET /api/logs** returns new fields

**Manual test:** `/diary` with mixed movie + scoped TV logs.

---

## Phase W.4 — Notifications + continue rail

### Task 10: New-episode sync job

**Files:**
- Create: `apps/server/src/jobs/tv-new-episode-sync.ts`
- Modify: server cron entry or Trigger.dev task (match existing notification jobs pattern in repo)

- [ ] **Step 1: Query** `tv_watch` where `status in ('watching','rewatching')` and `notify_new_episodes = true`

- [ ] **Step 2: For each**, fetch latest season/episode air date from TMDb cache

- [ ] **Step 3: Insert notification** if episode id > last notified (dedup key in payload: `tvId`, `season`, `episode`)

```ts
kind: "tv.new_episode",
title: `New episode · ${showTitle}`,
payload: { tvId, seasonNumber, episodeNumber, showTitle },
```

- [ ] **Step 4: Schedule** daily or hourly — document env flag `TV_EPISODE_SYNC_ENABLED`

---

### Task 11: Notification renderer + bell

**Files:**
- Modify: `apps/web/src/components/notifications/` (locate item renderer)

- [ ] **Step 1: Handle `tv.new_episode`** — link to `/tv/[id]` with hash or query `?progress=1`

- [ ] **Step 2: Mark read** on navigate

---

### Task 12: Continue watching rail on `/home`

**Files:**
- Create: `apps/web/src/components/home/home-continue-watching-rail.tsx`
- Modify: `apps/web/src/app/(app)/home/page.tsx`

- [ ] **Step 1: Fetch** `GET /api/tv-watch/me?status=watching,rewatching` (limit 12)

- [ ] **Step 2: Horizontal poster rail** — title + `Next: S02E04` caption; match `HomeFriendActivityRail` spacing tokens

- [ ] **Step 3: Hide** when empty (no dead space)

- [ ] **Step 4: Exclude** `paused` / `abandoned`

**Manual test:** Two active watches appear on home; pause one — drops off rail.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `tv_watch` table | Task 1 |
| Episode progress store | Task 1 (`tv_watch_episode`) |
| Scoped `log` columns | Task 2 |
| TMDb season cache | Task 3 |
| tv-watch API | Task 4 |
| TV hero status + mark next | Task 6 |
| Progress panel both modes | Task 7 |
| Quick Log scopes | Task 8 |
| Diary chips | Task 9 |
| In-app notifications | Tasks 10–11 |
| Continue rail | Task 12 |
| Watchlist ≠ watching | Task 6 (separate CTAs) |
| No separate anime surface | N/A (product rule only) |

---

## Executor workflow (repo convention)

- Complete **one phase** (W.1 → W.4) per Executor cycle; human **`ok`** before next phase.
- Update `.cursor/scratchpad.md` Project Status Board after each phase.
- Do **not** commit unless user asks.

---

## Verification commands

```bash
cd packages/db && bun run db:migrate
cd apps/web && bun test src/lib/tv-log-scope.test.ts
cd apps/web && bun run build
cd apps/server && bun run build
```

---

## Plan complete

After human review of spec + plan, choose execution mode:

1. **Subagent-Driven** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in-session with checkpoints per phase
