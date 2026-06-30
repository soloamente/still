# Month Recap Dialog — Design

**Date:** 2026-06-30  
**Status:** Approved  
**Apps:** `apps/web`, `apps/server`

## Context

Sense already celebrates community activity on **Community** leaderboards (film/TV
ranks and Members sorts) with podium UI. Patrons who return at the start of a new
month should see a **one-time carousel** — same interaction model as **What's New**
— announcing last month's global winners across three categories:

1. **Most films watched** (diary logs with `movieId`)
2. **Most TV watched** (diary logs with `tvId`)
3. **Most reviews published** (public reviews in the window)

This is a lightweight community moment, not a personal Wrapped recap.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Trigger | First signed-in `(app)` visit in a **new calendar month** | Celebrates the month that just ended |
| Month window | **Patron device timezone** (`Intl` IANA zone sent as `tz`) | Matches existing leaderboard `tz` query pattern |
| Audience | **All signed-in patrons** | Global community celebration; same winners for everyone |
| Categories (v1) | Films · TV · Reviews (3 sorts) | User-selected mixed set; mirrors Community ranks |
| Empty categories | **Skip slide** when zero qualifying patrons | No sparse “empty podium” slides |
| All empty | **No dialog** | Nothing to celebrate |
| Modal order | **What's New first**, then month recap | Avoid stacking; recap opens after What's New dismiss |
| Data | **Dedicated recap API** (Option 1) | One fetch, shared window, top-3 only |
| Persistence | `localStorage` per patron + celebrated month key | No migration; parity with `whats-new-seen.ts` |
| Podium interactivity | Profile links only (v1) | No ledger drawer — keep recap fast |
| Private profiles | **Excluded** | Same rules as public leaderboards (`isPrivate = false`) |
| Blocked users | **Excluded for viewer** | Same block filter as leaderboard routes |

## Experience

### Eligibility (client)

1. Patron is signed in inside `(app)` / `AppShell`.
2. Compute **celebrated month key** `YYYY-MM` = the calendar month immediately
   before “now” in the device timezone (e.g. first visit in July 2026 → `2026-06`).
3. If `localStorage` already has that key marked seen for this `userId`, stop.
4. If “now” is still inside the celebrated month (should not happen with step 2),
   stop — recap only after month rollover.
5. Fetch recap payload; if every category array is empty, stop (mark nothing).
6. Otherwise open the dialog once and mark seen on dismiss.

### Open timing

Mirror `WhatsNewDialogRoot`:

- ~2.5s defer after mount so home shell paints.
- Poll until watch-region first-run prompt is inactive (same max wait).
- If What's New is eligible (`shouldShowWhatsNewRelease`), **wait** until the
  patron dismisses it (poll `readWhatsNewSeenReleaseId` matches active release id,
  or no active release).
- Then fetch + open recap.

### Carousel UX

Reuse What's New chrome:

- Portal to `document.body`, `APP_MODAL_OVERLAY_CLASS`, `bg-card`,
  `rounded-[2rem]`, `max-w-lg sm:max-w-xl`.
- Ghost **X**, dot stepper, **Next** / **Got it**, `ArrowLeft` / `ArrowRight`
  keyboard nav, `Escape` dismiss.
- `AnimatePresence` slide cross-fade; `prefers-reduced-motion` safe.
- Error boundary: render failure marks seen and unmounts (non-fatal).

### Slide content

Dynamic 1–3 slides (no separate intro slide in v1):

| Slide | Title | Stat label | Data |
|---|---|---|---|
| Films | Most films watched | `N films` | Top 3 film diary log counts |
| TV | Most TV watched | `N shows` | Top 3 TV diary log counts |
| Reviews | Most reviews published | `N reviews` | Top 3 published review counts |

Each slide:

- Month pill kicker (e.g. `June 2026`) — `rounded-full bg-background` on
  `bg-card`, same as What's New release pill.
- `text-balance` category title.
- Compact **podium row** (2nd · 1st · 3rd) adapted from
  `home-leaderboard-podium.tsx` / `members-leaderboard-podium.tsx`:
  rank wash surfaces, `PatronPortraitWithMetalTier`, display name (semibold),
  `@handle` link, count (not tappable in v1).
- First slide only: optional subtitle line `Community highlights` under the pill.

### Dismissal

Mark seen: close **X**, **Got it**, backdrop click, or `Escape`.

Storage key pattern:

```
still:month-recap-seen:v1:{userId}:{YYYY-MM}
```

Value: `"1"` (presence is enough).

## API

### `GET /api/community/month-recap`

**Auth:** session required (signed-in patrons only).

**Query**

| Param | Required | Description |
|---|---|---|
| `tz` | optional | IANA timezone; defaults to `UTC` if invalid/missing |

**Behavior**

1. Normalize `tz` via `normalizeLeaderboardTimeZone`.
2. Resolve **previous calendar month** half-open window `[start, end)` in that zone
   using new helper `resolvePreviousCalendarMonthWindow(tz, now)`.
3. Derive `monthKey` (`YYYY-MM`) from the celebrated month start in that zone.
4. For each category, query **top 3** with existing leaderboard rules:
   - **Films:** `fetchLeaderboard` logic with `kind: "films"`, custom window,
     `limit: 3`.
   - **TV:** same with `kind: "tv"`.
   - **Reviews:** `fetchMembersLeaderboard` / `fetchReviewRows` path with
     `sort: "reviews"`, custom window, `limit: 3`.
5. Omit viewer-specific rank metadata (not needed for recap).
6. Apply viewer block list when `viewerId` present.

**Response**

```ts
type MonthRecapCategory = "films" | "tv" | "reviews";

type MonthRecapEntry = {
  rank: number; // 1–3
  userId: string;
  handle: string;
  displayName: string;
  image: string | null;
  avatarIsAnimated: boolean;
  diaryMetalTier: DiaryMetalTier | null;
  count: number;
};

type MonthRecapPayload = {
  monthKey: string; // "2026-06"
  monthLabel: string; // "June 2026"
  tz: string;
  window: { start: string; end: string };
  categories: {
    id: MonthRecapCategory;
    title: string;
    entries: MonthRecapEntry[];
  }[];
};
```

Only categories with `entries.length > 0` are included in `categories`.

**Errors**

- `401` unsigned
- `200` with empty `categories: []` when no qualifying activity

### Server helpers

**`resolvePreviousCalendarMonthWindow(tz, now)`** in `leaderboard-period.ts`:

- Read zoned parts of `now` in `tz`.
- If current zoned month is M, celebrated month is M−1 (year rollover safe).
- Return half-open `[startOfMonth, startOfNextMonth)` in UTC instants — same
  semantics as `resolveLeaderboardWindow("month", …)` but offset back one month.

**`fetchMonthRecap({ tz, viewerId, now })`** in `month-recap-query.ts`:

- Refactor minimally: allow `fetchLeaderboard` / film+tv aggregation and
  `fetchSortRows(..., "reviews", ...)` to accept an explicit `{ start, end }`
  override instead of only `period` + `now`, **or** add thin wrappers that pass
  `now` anchored inside the celebrated month — prefer explicit window override to
  avoid off-by-one bugs.
- Unit-test window helper across DST and year boundaries.

## Web components

| File | Role |
|---|---|
| `lib/month-recap-seen.ts` | localStorage read/mark/should-show |
| `lib/month-recap-month-key.ts` | Client celebrated `YYYY-MM` + label from device TZ |
| `lib/month-recap-types.ts` | Shared payload types (or import from api-client later) |
| `lib/fetch-month-recap-client.ts` | Browser `GET` via `stillApiOrigin()` + cookies |
| `components/app/month-recap-podium.tsx` | Compact podium row (read-only counts) |
| `components/app/month-recap-dialog.tsx` | Carousel modal |
| `components/app/month-recap-dialog-root.tsx` | Eligibility, What's New gate, fetch, open |
| `components/app/app-shell.tsx` | Mount `MonthRecapDialogRoot` next to `WhatsNewDialogRoot` |

**Isolation from in-flight work:** all new files; only `app-shell.tsx` gains one
sibling import/mount — no overlap with person-detail refactor.

### Optional analytics (v1 nice-to-have)

`product_event` `month_recap.viewed` with `{ monthKey, slideCount }` on open.

## Edge cases

| Case | Behavior |
|---|---|
| Patron joins mid-month | Still sees **last month's** global winners on first new-month visit |
| Low-activity month | Skip empty categories; hide dialog if all empty |
| <3 patrons in category | Show 1 or 2 podium slots only (no filler placeholders) |
| Ties | Same tie-break as leaderboards (earlier activity, then handle) |
| What's New + recap same visit | What's New → dismiss → recap |
| Recap fetch fails | Log error; do not mark seen; retry next visit |
| `localStorage` blocked | May reappear; non-fatal (What's New parity) |
| TZ change between visits | Could change celebrated key; acceptable v1 |
| Private winner | Cannot appear (public profiles only) |

## Out of scope (v1)

- Personal stats / “your month”
- Lists, likes, or film-vs-TV combined “titles” slide
- Ledger drawer on count tap
- Server-side seen state / cross-device sync
- Settings “replay last recap”
- Public/unsigned viewing
- Precomputed snapshot tables or cron jobs

## Test plan

### Server

1. `resolvePreviousCalendarMonthWindow` — Jan rollover, DST spring/fall, invalid tz → UTC.
2. `fetchMonthRecap` — returns top 3 per category; empty arrays omitted; private users excluded.
3. Blocked patrons never appear for the viewer.

### Web

1. First July visit (mock clock) → dialog shows June label + slides.
2. Dismiss → refresh → no dialog for same `monthKey`.
3. Mock API all-empty → no dialog, storage untouched.
4. What's New eligible → recap opens only after What's New seen.
5. Reduced motion → no slide translate.
6. `month-recap-seen` unit tests mirror `whats-new-seen.test.ts`.

## Implementation note

After approval, invoke **writing-plans** for a phased plan (server window helper +
API → web dialog → app-shell mount → tests).
