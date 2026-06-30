# Month Recap Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show signed-in patrons a one-time per month carousel on their first visit in a new calendar month, celebrating last month's global top-3 winners for films watched, TV watched, and reviews published — after What's New when both apply.

**Architecture:** Server resolves the **previous calendar month** window in the patron's `tz`, reuses leaderboard aggregation with `limit: 3`, exposes `GET /api/community/month-recap`. Web mirrors `WhatsNewDialog` carousel + localStorage seen state; `MonthRecapDialogRoot` gates on watch-region prompt and What's New dismissal before fetch/open.

**Tech Stack:** Elysia, Drizzle/Neon, Next.js client components, `motion/react`, Bun tests.

**Spec:** [`docs/superpowers/specs/2026-06-30-month-recap-dialog-design.md`](../specs/2026-06-30-month-recap-dialog-design.md)

**Isolation:** New files only + one mount line in `app-shell.tsx` — do not touch person-detail WIP.

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/leaderboard-period.ts` | `resolvePreviousCalendarMonthWindow`, `celebratedMonthKeyFromWindow` |
| `apps/server/src/lib/leaderboard-period.test.ts` | Window + month-key tests (Jan rollover, Rome TZ) |
| `apps/server/src/lib/leaderboard-query.ts` | Optional `window` override on `fetchLeaderboard` |
| `apps/server/src/lib/members-leaderboard-query.ts` | Optional `window` override on `fetchMembersLeaderboard` |
| `apps/server/src/lib/month-recap-query.ts` | `fetchMonthRecap` composes films/tv/reviews top 3 |
| `apps/server/src/lib/month-recap-query.test.ts` | Pure mapping + empty-category omission (mock rows) |
| `apps/server/src/routes/month-recap.ts` | `GET /api/community/month-recap` (auth required) |
| `apps/server/src/server/app.ts` | `.use(monthRecapRoute)` |
| `apps/web/src/lib/month-recap-types.ts` | Payload + slide types |
| `apps/web/src/lib/month-recap-month-key.ts` | Client celebrated `YYYY-MM` + label |
| `apps/web/src/lib/month-recap-month-key.test.ts` | Month key from mocked `Date` + TZ |
| `apps/web/src/lib/month-recap-seen.ts` | localStorage seen helpers |
| `apps/web/src/lib/month-recap-seen.test.ts` | Mirrors `whats-new-seen.test.ts` |
| `apps/web/src/lib/fetch-month-recap-client.ts` | Browser fetch with `tz` query |
| `apps/web/src/components/app/month-recap-podium.tsx` | Compact read-only podium row |
| `apps/web/src/components/app/month-recap-dialog.tsx` | Carousel modal |
| `apps/web/src/components/app/month-recap-dialog-root.tsx` | Eligibility, What's New gate, open timing |
| `apps/web/src/components/app/app-shell.tsx` | Mount `MonthRecapDialogRoot` |

---

### Task 1: Previous calendar month window (server)

**Files:**
- Modify: `apps/server/src/lib/leaderboard-period.ts`
- Test: `apps/server/src/lib/leaderboard-period.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `leaderboard-period.test.ts`:

```ts
import {
  resolvePreviousCalendarMonthWindow,
  celebratedMonthKeyFromWindow,
} from "./leaderboard-period";

describe("resolvePreviousCalendarMonthWindow", () => {
  test("July visit in Europe/Rome celebrates June", () => {
    const now = new Date("2026-07-02T10:00:00Z");
    const w = resolvePreviousCalendarMonthWindow("Europe/Rome", now);
    expect(w.start.toISOString()).toBe("2026-05-31T22:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(celebratedMonthKeyFromWindow(w.start, "Europe/Rome")).toBe("2026-06");
  });

  test("January celebrates prior December", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const w = resolvePreviousCalendarMonthWindow("UTC", now);
    expect(w.start.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(celebratedMonthKeyFromWindow(w.start, "UTC")).toBe("2025-12");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/server && bun test src/lib/leaderboard-period.test.ts`

- [ ] **Step 3: Implement helpers**

In `leaderboard-period.ts`:

- `resolvePreviousCalendarMonthWindow(tz, now)` — zoned parts of `now`, subtract one month from `(year, month)`, build half-open month window via existing `wallTimeToUtc` helpers.
- `celebratedMonthKeyFromWindow(start, tz)` — format `YYYY-MM` from zoned start.
- `celebratedMonthLabel(monthKey)` — `June 2026` via `Intl` (export for server + web reuse pattern).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/leaderboard-period.ts apps/server/src/lib/leaderboard-period.test.ts
git commit -m "feat(server): add previous calendar month window helper"
```

---

### Task 2: Leaderboard window override (server)

**Files:**
- Modify: `apps/server/src/lib/leaderboard-query.ts`
- Modify: `apps/server/src/lib/members-leaderboard-query.ts`

- [ ] **Step 1: Extend `fetchLeaderboard` opts**

Add optional `window?: { start: Date; end: Date }`. When set, skip `resolveLeaderboardWindow` and use provided bounds. Add optional `limit?: number` (default 50).

- [ ] **Step 2: Extend `fetchMembersLeaderboard` opts**

Same `window` override; keep existing pagination when `window` unset.

- [ ] **Step 3: Smoke existing tests**

Run: `cd apps/server && bun test src/lib/leaderboard-period.test.ts src/lib/members-leaderboard-query.test.ts`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(server): allow explicit window on leaderboard fetches"
```

---

### Task 3: `fetchMonthRecap` + route

**Files:**
- Create: `apps/server/src/lib/month-recap-query.ts`
- Create: `apps/server/src/lib/month-recap-query.test.ts`
- Create: `apps/server/src/routes/month-recap.ts`
- Modify: `apps/server/src/server/app.ts`

- [ ] **Step 1: Write failing unit test for category assembly**

Test pure helper `buildMonthRecapCategories` that omits empty arrays and maps titles:

```ts
expect(buildMonthRecapCategories({ films: [], tv: [row], reviews: [row] }))
  .toHaveLength(2);
```

- [ ] **Step 2: Implement `fetchMonthRecap`**

```ts
export async function fetchMonthRecap(opts: {
  tz: string | undefined;
  viewerId: string | null;
  now?: Date;
}): Promise<MonthRecapPayload>
```

- Resolve window + `monthKey` + `monthLabel`.
- Parallel `fetchLeaderboard({ kind: "films", window, limit: 3, ... })`, same for `tv`.
- `fetchMembersLeaderboard({ sort: "reviews", window, limit: 3, page: 1, ... })`.
- Map entries to `MonthRecapEntry` (strip `viewerFollows`).
- Return only non-empty categories.

- [ ] **Step 3: Add route**

`apps/server/src/routes/month-recap.ts`:

```ts
export const monthRecapRoute = new Elysia({
  prefix: "/api/community",
  tags: ["community"],
})
  .use(context)
  .get("/month-recap", async ({ query, user, status }) => {
    if (!user) return status(401, "Unauthorized");
    return fetchMonthRecap({
      tz: normalizeLeaderboardTimeZone(query.tz),
      viewerId: user.id,
    });
  }, { query: t.Object({ tz: t.Optional(t.String()) }) });
```

Register in `app.ts`.

- [ ] **Step 4: Run tests**

`cd apps/server && bun test src/lib/month-recap-query.test.ts src/lib/leaderboard-period.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): add month recap API for community winners"
```

---

### Task 4: Web seen state + month key + fetch client

**Files:**
- Create: `apps/web/src/lib/month-recap-types.ts`
- Create: `apps/web/src/lib/month-recap-month-key.ts`
- Create: `apps/web/src/lib/month-recap-month-key.test.ts`
- Create: `apps/web/src/lib/month-recap-seen.ts`
- Create: `apps/web/src/lib/month-recap-seen.test.ts`
- Create: `apps/web/src/lib/fetch-month-recap-client.ts`

- [ ] **Step 1: TDD `month-recap-seen.test.ts`**

Mirror `whats-new-seen.test.ts` with key `still:month-recap-seen:v1:{userId}:{YYYY-MM}`.

- [ ] **Step 2: Implement `month-recap-seen.ts`**

`readMonthRecapSeen`, `markMonthRecapSeen`, `shouldShowMonthRecap(userId, monthKey)`.

- [ ] **Step 3: TDD `month-recap-month-key.test.ts`**

`resolveClientCelebratedMonth(now)` returns `{ monthKey, monthLabel }` using `Intl.DateTimeFormat().resolvedOptions().timeZone`.

- [ ] **Step 4: Implement fetch client**

```ts
export async function fetchMonthRecapClient(tz: string): Promise<MonthRecapPayload | null>
```

`GET /api/community/month-recap?tz=...` via `stillApiOrigin()`, `credentials: "include"`. Return `null` on non-OK.

- [ ] **Step 5: Run tests**

`cd apps/web && bun test src/lib/month-recap-seen.test.ts src/lib/month-recap-month-key.test.ts`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): month recap client helpers and seen state"
```

---

### Task 5: Podium + dialog UI

**Files:**
- Create: `apps/web/src/components/app/month-recap-podium.tsx`
- Create: `apps/web/src/components/app/month-recap-dialog.tsx`

- [ ] **Step 1: `MonthRecapPodium`**

Adapt from `home-leaderboard-podium.tsx`:

- Props: `entries: MonthRecapEntry[]`, `statNoun: (count: number) => string`.
- Layout: 2nd · 1st · 3rd with rank washes.
- Portrait + name + `@handle` → `/profile/[handle]`.
- Count is **plain text** (no ledger opener).

- [ ] **Step 2: `MonthRecapDialog`**

Copy structure from `whats-new-dialog.tsx`:

- Props: `open`, `payload: MonthRecapPayload`, `onDismiss`.
- Slides = `payload.categories` (1–3).
- Per slide: month pill, title, first slide adds `Community highlights` subtitle, podium.
- Footer: dots, Back/Next/Got it, keyboard nav, `APP_MODAL_OVERLAY_CLASS`.

- [ ] **Step 3: Manual smoke**

Run dev server; temporarily force-open dialog with fixture payload.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): month recap carousel dialog and podium"
```

---

### Task 6: Dialog root + app shell mount

**Files:**
- Create: `apps/web/src/components/app/month-recap-dialog-root.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: `MonthRecapDialogRoot`**

Logic (mirror `whats-new-dialog-root.tsx`):

1. `resolveClientCelebratedMonth()`.
2. If `!shouldShowMonthRecap(userId, monthKey)` → return null.
3. Defer 2.5s; poll watch-region prompt (reuse `isWatchRegionPromptActive`).
4. Poll What's New gate:
   - `getActiveWhatsNewRelease()` + `shouldShowWhatsNewRelease` → wait until seen or no release.
   - Use `readWhatsNewSeenReleaseId` poll every 300ms (max 45s fallback).
5. `fetchMonthRecapClient(tz)`.
6. If `categories.length === 0` → return null (do not mark seen).
7. Open dialog; `onDismiss` → `markMonthRecapSeen(userId, monthKey)`.
8. Error boundary marks seen on render failure.

- [ ] **Step 2: Mount in `app-shell.tsx`**

```tsx
<MonthRecapDialogRoot userId={user.id} />
```

Place immediately after `WhatsNewDialogRoot`.

- [ ] **Step 3: Optional analytics**

On open: `trackSenseProductEvent("month_recap.viewed", { monthKey, slideCount })`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): mount month recap dialog in app shell"
```

---

### Task 7: Verification + docs

- [ ] **Step 1: Run targeted tests**

```bash
cd apps/server && bun test src/lib/leaderboard-period.test.ts src/lib/month-recap-query.test.ts
cd apps/web && bun test src/lib/month-recap-seen.test.ts src/lib/month-recap-month-key.test.ts
```

- [ ] **Step 2: Typecheck**

```bash
bun run check-types
```

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-06-30-month-recap-dialog-design.md`, set **Status: Approved**.

- [ ] **Step 4: Manual QA checklist**

1. Signed in, mock clock first day of month → recap appears after delay.
2. Dismiss → refresh → no recap.
3. What's New eligible → recap only after What's New dismissed.
4. API returns empty categories → no dialog.
5. `prefers-reduced-motion` → no slide translate.

- [ ] **Step 5: `graphify update .`** (if graphify available)

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-06-30-month-recap-dialog-design.md
git commit -m "docs: approve month recap dialog spec"
```

---

## Executor notes

- **Do not** modify person-detail files (`person-detail-*`, `person-detail-view.ts`).
- Prefer **explicit `window` override** over anchoring `now` inside prior month — avoids off-by-one at month boundaries.
- **Do not mark seen** when fetch fails or all categories empty.
- Reuse stat copy: films → `N films`, TV → `N shows`, reviews → `N reviews` (check `membersLeaderboardStatNoun` / home leaderboard helpers).
- Modal stacking: recap root must **never** open while What's New is still eligible.
