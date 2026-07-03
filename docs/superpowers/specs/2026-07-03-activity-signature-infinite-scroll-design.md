# Activity signature infinite scroll — design

**Status:** Approved (2026-07-03)  
**Scope:** Profile diary rhythm heatmap (`ProfileActivitySignature`) — streak pill popover and any embedded surface  
**Replaces:** Fixed 52-week-only window from ST.2; supersedes the deferred `?year=` chip approach in Tier 2 spec

## Problem

The diary rhythm heatmap renders a **fixed 52-week** UTC grid and auto-scrolls to the most recent column. Patrons cannot scroll further into the past — not because scroll is broken, but because **older history was never loaded or rendered**. Visiting profiles with multi-year diaries only show ~one year.

## Goals

1. **Continuous horizontal rail** — one GitHub-style grid; drag/swipe left to see older weeks.
2. **Open on “now”** — first paint anchors the right edge on the latest activity (unchanged default).
3. **Paginated prepend** — load older weeks on demand; do not fetch full diary history up front.
4. **Parity** — own profile, visitor profile (public), streak popover, and any embedded variant share the same component behavior.
5. **Performance** — bounded SQL per page; preserve scroll position when prepending columns.

## Non-goals

- Year tab picker or calendar year boundaries
- Per-episode TV granularity (still one cell per UTC day)
- Patron timezone shift for grid boundaries (stay UTC v1; matches existing ST.2)
- Vertical scroll inside the heatmap
- Changing intensity scale or color tokens

## API

Extend `GET /api/profiles/:handle/activity-signature` (same privacy gate as today).

| Query param | Default | Max | Meaning |
|-------------|---------|-----|---------|
| `weeks` | `52` | `52` | Number of week **columns** in this chunk |
| `before` | today + 1 day (exclusive end) | — | UTC date key `YYYY-MM-DD`; chunk covers days **strictly before** this date |

**Semantics**

- `before` is exclusive: the grid’s last in-range day is `addUtcDays(before, -1)`.
- When `before` is omitted, server uses **tomorrow UTC** so “today” is included (equivalent to current behavior).
- Each response is self-contained for its window.

**Response** (additive fields on existing payload):

```ts
{
  weeks: ActivitySignatureWeek[];
  totalDaysActive: number;  // chunk-scoped
  totalLogs: number;        // chunk-scoped
  rangeStart: string;       // UTC YYYY-MM-DD — first day in chunk grid
  rangeEnd: string;         // UTC YYYY-MM-DD — last in-range day in chunk
  hasOlder: boolean;        // true when patron has any log before rangeStart
}
```

**`hasOlder` query:** `EXISTS` log row for `userId` with `watchedAt < rangeStart::date` and `removedAt IS NULL`. Cheap index-friendly check; no full scan.

**SQL window:** `watchedAt >= rangeStart AND watchedAt < before` (UTC), same visibility rules as profile filmography where applicable (public logs only is **not** required — heatmap uses all non-removed logs like today).

## Server implementation

Refactor `buildActivitySignature` in `apps/server/src/lib/activity-signature.ts`:

- Extract `buildActivitySignatureChunk({ watchedAtValues, beforeExclusive, weeks, now? })`.
- Keep `buildActivitySignature(watchedAt, now)` as sugar: `weeks = 52`, `beforeExclusive = tomorrow UTC`.
- Grid anchoring unchanged: final week column contains `rangeEnd`; columns count = `weeks`.
- Days outside `[rangeStart, rangeEnd]` render level 0 (padding cells at chunk edges).

**Route** (`apps/server/src/routes/profiles.ts`):

- Parse and validate `weeks` (1–52) and `before` (optional ISO date).
- Compute `rangeEnd = addUtcDays(before, -1)`, `rangeStart` from `weeks` and Monday anchoring.
- Fetch logs in window; call chunk builder; compute `hasOlder`.

## Client architecture

### Hook: `useProfileActivitySignatureInfinite`

New hook (or extend `useProfileActivitySignature`) in `apps/web/src/lib/`:

**State**

- `weeks: ActivitySignatureWeek[]` — merged, deduped by `weekStart`
- `rangeStart`, `rangeEnd`, `hasOlder`
- `loadingInitial`, `loadingOlder`, `error`
- Chunk totals for subtitle: sum `totalDaysActive` / `totalLogs` across loaded chunks OR show chunk-scoped copy (see UI)

**Initial load**

- `GET …/activity-signature?weeks=52` (no `before`)
- On success: merge weeks, set `hasOlder`
- Scroll container: `scrollLeft = scrollWidth - clientWidth` once (anchor right)

**Older pages**

- Trigger when `scrollLeft < threshold` (e.g. 80px) and `hasOlder && !loadingOlder`
- Request: `?weeks=26&before={rangeStart}` (next chunk ends day before current `rangeStart`)
- **Prepend** new weeks; **preserve scroll position**:

```ts
const prevScrollWidth = el.scrollWidth;
// prepend DOM / state
requestAnimationFrame(() => {
  el.scrollLeft += el.scrollWidth - prevScrollWidth;
});
```

- Deduplicate: if `weekStart` already present, skip column
- Set `hasOlder` from latest response; update `rangeStart`

**Debounce:** coalesce rapid scroll events (one in-flight older fetch at a time).

### Component: `ProfileActivitySignature`

File: `apps/web/src/components/profile/profile-activity-signature.tsx`

- Replace single-fetch hook with infinite hook
- Keep weekday label column pinned; week columns in `overflow-x-auto` scrollport
- **Edge fades:** `useHorizontalScrollFades(scrollRef)` — left fade when `showStartFade` (more history hint); right fade when not at end; fades to `transparent` per Sense tokens
- **Loading older:** 2–3 skeleton week columns prepended on the left while fetch runs (no layout jump)
- **End of history:** when `!hasOlder && scrollLeft === 0`, optional muted label: “Start of diary” (sr-only or 10px caption)
- **Subtitle copy:** embedded variant — “{active} active days · {logs} logs” scoped to **loaded** range; append “· scroll for earlier” when `hasOlder`
- **aria-label:** `Diary activity — scroll horizontally for earlier weeks`

### Popover (streak pill)

`ProfileStreakStatCell` popover unchanged structurally; heatmap mounts on open. Ensure:

- Popover content does not trap horizontal wheel — `data-lenis-prevent-wheel` on scrollport if needed (match search dialog pattern)
- Touch drag scroll works on mobile (`overflow-x-auto`, no `pointer-events-none` on grid)
- Popover width stays `min(100vw - 2rem, 28rem)`; internal horizontal scroll is required

## Motion & feel (`make-interfaces-feel-better`, `transitions-dev`)

| Concern | Treatment |
|---------|-----------|
| Cell enter animation | Keep stagger on **initial chunk only**; prepended columns render without spring stagger (avoid 26×7 motion burst) |
| `prefers-reduced-motion` | No cell scale animation on prepend; existing guard retained |
| Scroll affordance | Horizontal edge fades (not notification-badge / modal) |
| Press / tooltip | Unchanged; tooltip portal repositions on scroll |
| Tabular counts | `tabular-nums` on subtitle stats |
| No `transition: all` | Fades use opacity-only transitions |

No new `t-*` transition kit required — native scroll + edge scrims.

## Error handling

| Case | Behavior |
|------|----------|
| Initial fetch 404 | Hide heatmap (private / missing profile) — unchanged |
| Initial fetch 5xx | Inline muted “Couldn’t load diary rhythm” + retry link |
| Older page fetch fails | Toast or inline chip “Couldn’t load earlier weeks” — keep loaded columns; allow retry on next left scroll |
| Empty diary | `totalLogs <= 0` → return null — unchanged |
| Duplicate prepend | Dedupe by `weekStart`; no-op if empty page |

## Testing

**Server** (`activity-signature.test.ts`):

- Chunk with `before` and `weeks=26` returns 26 columns
- `rangeStart` / `rangeEnd` match grid edges
- Logs before window excluded; padding cells level 0

**Web** (`activity-signature.test.ts` or new `use-profile-activity-signature-infinite.test.ts`):

- Merge/dedupe week arrays
- `prependScrollPreserve` helper math

**Manual QA**

- Own profile streak popover: opens on recent weeks; scroll left loads 2025/2024; no jump on prepend
- Visitor `/profile/{handle}`: same behavior
- Mobile touch scroll in popover
- Patron with < 52 weeks history: scroll stops; no infinite spinners
- `prefers-reduced-motion`: no stagger on first paint optional per existing behavior

## Success criteria

- [ ] Default open shows latest ~52 weeks anchored right
- [ ] Scrolling left loads at least one older chunk (26 weeks) with stable scroll position
- [ ] `hasOlder: false` at true diary start — no further fetches
- [ ] Public visitor sees same scroll behavior on public profiles
- [ ] Private profiles remain 404 for visitors
- [ ] Server tests pass; no regression on existing 52-week default response shape

## Files (expected touch)

| Area | Files |
|------|-------|
| Server lib | `apps/server/src/lib/activity-signature.ts`, `.test.ts` |
| Server route | `apps/server/src/routes/profiles.ts` |
| Web lib | `apps/web/src/lib/activity-signature.ts`, `use-profile-activity-signature.ts` (or new infinite hook) |
| Web UI | `apps/web/src/components/profile/profile-activity-signature.tsx` |
| Docs | this spec + implementation plan |
