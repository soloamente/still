# Activity Signature Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons scroll the diary rhythm heatmap left through paginated older weeks, opening anchored on the most recent activity.

**Architecture:** Extend `buildActivitySignature` into a `before` + `weeks` chunk builder on the server; add `rangeStart`, `rangeEnd`, and `hasOlder` to the profile activity-signature API. On the web, an infinite-scroll hook prepends older 26-week chunks when the user scrolls near the left edge, preserving scroll position and showing horizontal edge fades.

**Tech Stack:** Bun tests, Elysia profiles route, Drizzle/Neon, React client hook, `ProfileActivitySignature`, `useHorizontalScrollFades`.

**Spec:** `docs/superpowers/specs/2026-07-03-activity-signature-infinite-scroll-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/activity-signature.ts` | Chunk builder + shared types |
| `apps/server/src/lib/activity-signature.test.ts` | Server unit tests |
| `apps/server/src/routes/profiles.ts` | Query params + `hasOlder` |
| `apps/web/src/lib/activity-signature.ts` | Normalize new response fields |
| `apps/web/src/lib/activity-signature-prepend-scroll.ts` | Pure scroll-preserve helper |
| `apps/web/src/lib/activity-signature-prepend-scroll.test.ts` | Scroll helper tests |
| `apps/web/src/lib/activity-signature-merge-weeks.ts` | Dedupe prepend merge |
| `apps/web/src/lib/activity-signature-merge-weeks.test.ts` | Merge tests |
| `apps/web/src/lib/use-profile-activity-signature-infinite.ts` | Infinite fetch hook |
| `apps/web/src/components/profile/profile-activity-signature.tsx` | Scroll UI + fades |

---

### Task 1: Server chunk builder

**Files:**
- Modify: `apps/server/src/lib/activity-signature.ts`
- Test: `apps/server/src/lib/activity-signature.test.ts`

- [ ] **Step 1: Write failing tests for chunked builder**

Add to `activity-signature.test.ts`:

```ts
import {
  buildActivitySignatureChunk,
  ACTIVITY_SIGNATURE_WEEKS,
} from "./activity-signature";

describe("buildActivitySignatureChunk", () => {
  test("returns requested week count ending before exclusive date", () => {
    const payload = buildActivitySignatureChunk({
      watchedAtValues: ["2026-01-15T12:00:00.000Z", "2025-12-01T12:00:00.000Z"],
      beforeExclusive: "2026-07-01",
      weeks: 26,
      now: new Date("2026-06-30T12:00:00.000Z"),
    });
    expect(payload.weeks).toHaveLength(26);
    expect(payload.rangeEnd).toBe("2026-06-30");
    expect(payload.rangeStart <= "2025-12-01").toBe(true);
    const dec1 = payload.weeks
      .flatMap((w) => w.days)
      .find((d) => d.date === "2025-12-01");
    expect(dec1?.count).toBe(1);
  });

  test("default 52-week chunk matches legacy buildActivitySignature window", () => {
    const now = new Date("2026-05-29T15:00:00.000Z");
    const logs = ["2026-05-28T08:00:00.000Z"];
    const legacy = buildActivitySignature(logs, now);
    const chunked = buildActivitySignatureChunk({
      watchedAtValues: logs,
      weeks: ACTIVITY_SIGNATURE_WEEKS,
      now,
    });
    expect(chunked.weeks).toHaveLength(legacy.weeks.length);
    expect(chunked.totalLogs).toBe(legacy.totalLogs);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/server && bun test src/lib/activity-signature.test.ts`  
Expected: FAIL — `buildActivitySignatureChunk` not defined

- [ ] **Step 3: Implement chunk builder**

In `activity-signature.ts`:

- Add `ActivitySignatureChunkPayload` extending payload with `rangeStart`, `rangeEnd`.
- Add `buildActivitySignatureChunk({ watchedAtValues, beforeExclusive?, weeks?, now? })`.
- Compute `beforeExclusive` default: `addUtcDays(utcDateKeyFromWatchedAt(now), 1)`.
- Compute `rangeEnd = addUtcDays(beforeExclusive, -1)`.
- Anchor `gridEndMonday` on `rangeEnd`; walk back `(weeks - 1) * 7` days for `gridStartMonday`.
- Set `rangeStart` to first day of first week column.
- Refactor `buildActivitySignature` to call chunk builder with `weeks: ACTIVITY_SIGNATURE_WEEKS`.

- [ ] **Step 4: Run tests**

Run: `cd apps/server && bun test src/lib/activity-signature.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/activity-signature.ts apps/server/src/lib/activity-signature.test.ts
git commit -m "feat(server): add paginated activity signature chunk builder"
```

---

### Task 2: API route params and hasOlder

**Files:**
- Modify: `apps/server/src/routes/profiles.ts`

- [ ] **Step 1: Extend route query schema**

Near `GET /:handle/activity-signature`, add query:

```ts
query: t.Object({
  weeks: t.Optional(t.Numeric({ minimum: 1, maximum: 52, default: 52 })),
  before: t.Optional(t.String()),
}),
```

- [ ] **Step 2: Parse before and compute window**

```ts
const weeks = Math.min(52, Math.max(1, Number(query.weeks ?? 52)));
const beforeExclusive =
  query.before?.trim() ||
  addUtcDays(utcDateKeyFromWatchedAt(new Date()), 1);

// validate YYYY-MM-DD on beforeExclusive; 400 if invalid

const rangeEnd = addUtcDays(beforeExclusive, -1);
const windowStart = /* Monday anchor minus (weeks-1)*7, same as chunk builder */;
```

- [ ] **Step 3: Narrow SQL to window**

Replace fixed `ACTIVITY_SIGNATURE_DAYS` lookback with `gte(log.watchedAt, windowStart)` and `lt(log.watchedAt, beforeExclusive parsed as date)`.

- [ ] **Step 4: hasOlder EXISTS query**

```ts
const [older] = await db
  .select({ exists: sql`1` })
  .from(log)
  .where(
    and(
      eq(log.userId, row.userId),
      isNull(log.removedAt),
      lt(log.watchedAt, windowStart),
    ),
  )
  .limit(1);
const hasOlder = Boolean(older);
```

- [ ] **Step 5: Return chunk payload + hasOlder**

Call `buildActivitySignatureChunk` and spread `hasOlder` into JSON.

- [ ] **Step 6: Manual smoke**

Run server; `curl /api/profiles/{handle}/activity-signature?weeks=26` returns 26 weeks + `hasOlder`.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routes/profiles.ts
git commit -m "feat(api): paginate profile activity signature with hasOlder"
```

---

### Task 3: Web types and pure helpers

**Files:**
- Modify: `apps/web/src/lib/activity-signature.ts`
- Create: `apps/web/src/lib/activity-signature-merge-weeks.ts`
- Create: `apps/web/src/lib/activity-signature-merge-weeks.test.ts`
- Create: `apps/web/src/lib/activity-signature-prepend-scroll.ts`
- Create: `apps/web/src/lib/activity-signature-prepend-scroll.test.ts`

- [ ] **Step 1: Extend payload type**

```ts
export type ActivitySignaturePayload = {
  weeks: ActivitySignatureWeek[];
  totalDaysActive: number;
  totalLogs: number;
  rangeStart?: string;
  rangeEnd?: string;
  hasOlder?: boolean;
};
```

Update `normalizeActivitySignaturePayload` to pass through new fields.

- [ ] **Step 2: Write merge-weeks test**

```ts
import { describe, expect, test } from "bun:test";
import { mergeActivitySignatureWeeks } from "./activity-signature-merge-weeks";

test("prepends older weeks and dedupes by weekStart", () => {
  const existing = [{ weekStart: "2026-05-25", days: [] }];
  const older = [
    { weekStart: "2026-05-18", days: [] },
    { weekStart: "2026-05-25", days: [] },
  ];
  const merged = mergeActivitySignatureWeeks(older, existing);
  expect(merged.map((w) => w.weekStart)).toEqual(["2026-05-18", "2026-05-25"]);
});
```

- [ ] **Step 3: Implement merge helper**

```ts
export function mergeActivitySignatureWeeks(
  prepend: ActivitySignatureWeek[],
  current: ActivitySignatureWeek[],
): ActivitySignatureWeek[] {
  const seen = new Set(current.map((w) => w.weekStart));
  const uniqueOlder = prepend.filter((w) => !seen.has(w.weekStart));
  return [...uniqueOlder, ...current];
}
```

- [ ] **Step 4: Write scroll-preserve test**

```ts
import { computeScrollLeftAfterPrepend } from "./activity-signature-prepend-scroll";

test("adds width delta to scrollLeft", () => {
  expect(
    computeScrollLeftAfterPrepend({ scrollLeft: 120, prevScrollWidth: 800, nextScrollWidth: 1000 }),
  ).toBe(320);
});
```

- [ ] **Step 5: Implement scroll helper**

```ts
export function computeScrollLeftAfterPrepend({
  scrollLeft,
  prevScrollWidth,
  nextScrollWidth,
}: {
  scrollLeft: number;
  prevScrollWidth: number;
  nextScrollWidth: number;
}): number {
  return scrollLeft + (nextScrollWidth - prevScrollWidth);
}
```

- [ ] **Step 6: Run web lib tests**

Run: `cd apps/web && bun test src/lib/activity-signature-merge-weeks.test.ts src/lib/activity-signature-prepend-scroll.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/activity-signature.ts apps/web/src/lib/activity-signature-merge-weeks.ts apps/web/src/lib/activity-signature-merge-weeks.test.ts apps/web/src/lib/activity-signature-prepend-scroll.ts apps/web/src/lib/activity-signature-prepend-scroll.test.ts
git commit -m "feat(web): activity signature merge and scroll helpers"
```

---

### Task 4: Infinite fetch hook

**Files:**
- Create: `apps/web/src/lib/use-profile-activity-signature-infinite.ts`
- Deprecate usage in: `apps/web/src/lib/use-profile-activity-signature.ts` (keep file; re-export or thin wrapper)

- [ ] **Step 1: Implement hook skeleton**

```ts
export function useProfileActivitySignatureInfinite(handle: string) {
  const [weeks, setWeeks] = useState<ActivitySignatureWeek[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [totals, setTotals] = useState({ totalDaysActive: 0, totalLogs: 0 });
  const loadingOlderRef = useRef(false);

  // initial: GET ?weeks=52
  // loadOlder: GET ?weeks=26&before=rangeStart
  // on older success: merge weeks, add totals, update rangeStart/hasOlder
  return { weeks, rangeStart, hasOlder, loadingInitial, loadingOlder, totals, loadOlder };
}
```

- [ ] **Step 2: Wire Eden treaty calls**

```ts
const res = await api.api.profiles({ handle }).["activity-signature"].get({
  query: { weeks: 52 },
});
// older:
const res = await api.api.profiles({ handle }).["activity-signature"].get({
  query: { weeks: 26, before: rangeStart },
});
```

- [ ] **Step 3: Accumulate totals across chunks**

On each successful page: `setTotals((t) => ({ totalDaysActive: t.totalDaysActive + page.totalDaysActive, totalLogs: t.totalLogs + page.totalLogs }))`.

- [ ] **Step 4: Guard concurrent older fetches**

Use `loadingOlderRef` — return early if already in flight or `!hasOlder`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/use-profile-activity-signature-infinite.ts
git commit -m "feat(web): infinite activity signature fetch hook"
```

---

### Task 5: ProfileActivitySignature UI

**Files:**
- Modify: `apps/web/src/components/profile/profile-activity-signature.tsx`

- [ ] **Step 1: Swap hook**

Replace `useProfileActivitySignature` with `useProfileActivitySignatureInfinite`.

- [ ] **Step 2: Initial scroll-right on first load**

Keep existing effect but key off `loadingInitial` + `weeks.length`:

```ts
useEffect(() => {
  if (loadingInitial || weeks.length === 0) return;
  const el = scrollRef.current;
  if (!el) return;
  el.scrollLeft = el.scrollWidth - el.clientWidth;
}, [loadingInitial, weeks.length]);
```

Only run when `weeks` first populated (use ref `didInitialScrollRef`).

- [ ] **Step 3: Scroll listener for older pages**

```ts
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  const onScroll = () => {
    if (el.scrollLeft < 80 && hasOlder && !loadingOlder) {
      const prevWidth = el.scrollWidth;
      void loadOlder().then(() => {
        requestAnimationFrame(() => {
          if (!scrollRef.current) return;
          scrollRef.current.scrollLeft = computeScrollLeftAfterPrepend({
            scrollLeft: scrollRef.current.scrollLeft,
            prevScrollWidth: prevWidth,
            nextScrollWidth: scrollRef.current.scrollWidth,
          });
        });
      });
    }
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => el.removeEventListener("scroll", onScroll);
}, [hasOlder, loadingOlder, loadOlder]);
```

- [ ] **Step 4: Horizontal edge fades**

```ts
import { useHorizontalScrollFades } from "@/lib/use-horizontal-scroll-fades";

const { showStartFade, showEndFade } = useHorizontalScrollFades(scrollRef);
```

Wrap scrollport in `relative`; add left/right gradient scrims to `transparent` when fades active (match `search-dialog-studio-rail.tsx` pattern).

- [ ] **Step 5: Loading older skeleton**

When `loadingOlder`, render 3 narrow `bg-muted/30 animate-pulse` week columns at the start of the grid (inside scroll content).

- [ ] **Step 6: Limit cell animation to initial paint**

Add `initialChunkRenderedRef`; only apply `motion.div` spring `delay` when `!initialChunkRenderedRef.current`. Set ref true after first chunk mounts. Prepend columns use `initial={false}` or plain `div`.

- [ ] **Step 7: Update copy and aria**

- `aria-label="Diary activity — scroll horizontally for earlier weeks"`
- Embedded subtitle: append `· scroll for earlier` when `hasOlder`

- [ ] **Step 8: Manual QA**

1. Open streak popover on profile with 2+ years of logs  
2. Confirm opens on recent weeks  
3. Scroll left — older months appear without jump  
4. Reach start — no more fetches  

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/profile/profile-activity-signature.tsx
git commit -m "feat(profile): infinite scroll diary rhythm heatmap"
```

---

### Task 6: graphify + changelog (optional)

- [ ] **Step 1:** Run `graphify update .` from repo root after code changes.

- [ ] **Step 2:** If shipping to patrons, add changelog entry in `apps/web/src/lib/product-changelog.ts` — “Diary rhythm scrolls back through your full watch history.”

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Cursor API `before` + `weeks` | Task 2 |
| `hasOlder` | Task 2 |
| Chunk builder | Task 1 |
| Open anchored on now | Task 5 step 2 |
| Prepend + scroll preserve | Tasks 3, 5 |
| Edge fades | Task 5 step 4 |
| Reduced motion on prepend | Task 5 step 6 |
| Popover parity | Task 5 (same component) |
| Error handling | Hook: catch + keep state; optional toast in Task 5 if time |

No placeholders remain in task steps above.
