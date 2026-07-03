# Taste Queue — Non-Interrupting Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven execution (one task per subagent; human `go` between tasks) or executing-plans for batch runs.

**Goal:** Fix taste hero + rail so log / watchlist / dismiss removes a title, advances focus to the next item, and backfills replacements at the **tail** only (target depth 24) without async hijack.

**Architecture:** Shared pure helpers + debounced `for-you` fetch in `taste-match-queue.ts`; hero and rail replace local splice handlers with remove + `scheduleBackfill()`; hero gets unified `activeIndexAfterRemoval` and poster `AnimatePresence`.

**Tech Stack:** Bun tests, Eden `api.api.taste`, React 19 client components, `motion/react`, existing `reconcileTasteMatchMovies`.

**Spec:** `docs/superpowers/specs/2026-07-03-taste-queue-non-interrupting-backfill-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/taste-match-queue.ts` | `activeIndexAfterRemoval`, `mergeTailBackfill`, `createTasteQueueBackfillScheduler` |
| `apps/web/src/lib/taste-match-queue.test.ts` | Unit tests for index math, merge, debounce |
| `apps/web/src/lib/taste-matched-discovery.ts` | Export `TASTE_MATCH_TARGET_RESULTS = 24` |
| `apps/web/src/components/home/home-taste-matched-hero.tsx` | Shared queue wiring, index fix, tail backfill, poster enter/exit |
| `apps/web/src/components/home/home-taste-matched-rail.tsx` | Shared queue wiring, tail backfill, `taste-title-consumed` listener |
| `packages/ui/src/styles/globals.css` | Optional transitions.dev `:root` tokens (only if absent) |

---

### Task 1: Pure queue helpers

**Files:**
- Create: `apps/web/src/lib/taste-match-queue.ts`
- Create: `apps/web/src/lib/taste-match-queue.test.ts`
- Modify: `apps/web/src/lib/taste-matched-discovery.ts`

- [ ] **Step 1: Export target constant**

In `taste-matched-discovery.ts`:

```ts
/** Mirrors `apps/server/src/lib/taste-matched-discovery.ts`. */
export const TASTE_MATCH_TARGET_RESULTS = 24;
```

- [ ] **Step 2: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
  activeIndexAfterRemoval,
  mergeTailBackfill,
  TASTE_MATCH_TARGET_RESULTS,
} from "./taste-match-queue";
import type { TasteMatchMovie } from "./taste-matched-discovery";

const row = (id: number): TasteMatchMovie => ({
  tmdbId: id,
  title: `Film ${id}`,
  posterPath: null,
  year: 2020,
});

describe("activeIndexAfterRemoval", () => {
  test("keeps index when removing active title", () => {
    expect(activeIndexAfterRemoval(2, 2, 7)).toBe(2);
  });
  test("decrements when removing before active", () => {
    expect(activeIndexAfterRemoval(1, 3, 7)).toBe(2);
  });
  test("unchanged when removing after active", () => {
    expect(activeIndexAfterRemoval(5, 2, 7)).toBe(2);
  });
  test("clamps to last index", () => {
    expect(activeIndexAfterRemoval(0, 0, 1)).toBe(0);
  });
});

describe("mergeTailBackfill", () => {
  test("appends unseen candidates to target depth", () => {
    const current = [row(1), row(2), row(3)];
    const candidates = [row(1), row(4), row(5), row(6)];
    const out = mergeTailBackfill(current, candidates, 6);
    expect(out.map((m) => m.tmdbId)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  test("stops at candidate exhaustion", () => {
    const current = [row(1), row(2)];
    const out = mergeTailBackfill(current, [row(3)], 24);
    expect(out.map((m) => m.tmdbId)).toEqual([1, 2, 3]);
  });
  test("no-op when already at target", () => {
    const current = Array.from({ length: 24 }, (_, i) => row(i + 1));
    const out = mergeTailBackfill(current, [row(99)], 24);
    expect(out).toBe(current);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `cd apps/web && bun test src/lib/taste-match-queue.test.ts`

- [ ] **Step 4: Implement helpers**

```ts
export const TASTE_MATCH_TARGET_RESULTS = 24;

export function activeIndexAfterRemoval(
  removedIndex: number,
  activeIndex: number,
  remainingLength: number,
): number {
  let next = activeIndex;
  if (removedIndex < activeIndex) next -= 1;
  // removedIndex === activeIndex → keep index (next title slides in)
  const maxIndex = Math.max(0, remainingLength - 1);
  return Math.min(Math.max(0, next), maxIndex);
}

export function mergeTailBackfill(
  current: TasteMatchMovie[],
  candidates: TasteMatchMovie[],
  targetLength = TASTE_MATCH_TARGET_RESULTS,
): TasteMatchMovie[] {
  if (current.length >= targetLength) return current;
  const onScreen = new Set(current.map((m) => m.tmdbId));
  const next = [...current];
  for (const candidate of candidates) {
    if (next.length >= targetLength) break;
    if (onScreen.has(candidate.tmdbId)) continue;
    onScreen.add(candidate.tmdbId);
    next.push(candidate);
  }
  return next.length === current.length ? current : next;
}
```

Re-export `TASTE_MATCH_TARGET_RESULTS` from `taste-matched-discovery.ts` or import from queue module in one direction only — pick **one** canonical export in `taste-match-queue.ts` and re-export from discovery if needed for backwards compat.

- [ ] **Step 5: Run test — expect PASS**

Run: `cd apps/web && bun test src/lib/taste-match-queue.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/taste-match-queue.ts apps/web/src/lib/taste-match-queue.test.ts apps/web/src/lib/taste-matched-discovery.ts
git commit -m "feat(web): taste queue index math and tail backfill helpers"
```

---

### Task 2: Debounced backfill scheduler

**Files:**
- Modify: `apps/web/src/lib/taste-match-queue.ts`
- Modify: `apps/web/src/lib/taste-match-queue.test.ts`

- [ ] **Step 1: Write failing debounce test**

Pattern after `patron-online-refresh-scheduler.test.ts`:

```ts
describe("createTasteQueueBackfillScheduler", () => {
  test("debounces rapid schedule calls into one trailing run", async () => {
    let runs = 0;
    const scheduler = createTasteQueueBackfillScheduler({
      debounceMs: 50,
      runBackfill: async () => { runs += 1; },
    });
    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    await new Promise((r) => setTimeout(r, 120));
    expect(runs).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement scheduler**

```ts
export const TASTE_QUEUE_BACKFILL_DEBOUNCE_MS = 150;

export function createTasteQueueBackfillScheduler(options: {
  debounceMs?: number;
  runBackfill: () => void | Promise<void>;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = options.debounceMs ?? TASTE_QUEUE_BACKFILL_DEBOUNCE_MS;

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      void options.runBackfill();
    }, debounceMs);
  }

  return { schedule, cancel };
}
```

Add factory `buildTasteQueueBackfillRunner` that accepts `getMovies`, `setMovies`, and Eden fetch — keeps scheduler testable without mocking `api`:

```ts
export function buildTasteQueueBackfillRunner(args: {
  getMovies: () => TasteMatchMovie[];
  setMovies: (next: TasteMatchMovie[]) => void;
  fetchForYou: () => Promise<TasteMatchedDiscoveryPayload | null>;
}): () => Promise<void> {
  return async () => {
    const current = args.getMovies();
    if (current.length >= TASTE_MATCH_TARGET_RESULTS) return;
    const data = await args.fetchForYou();
    if (!data || data.coldStart) return;
    const candidates = reconcileTasteMatchMovies(data.movies, data.consumedTmdbIds);
    const merged = mergeTailBackfill(current, candidates);
    if (merged !== current) args.setMovies(merged);
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): debounced taste queue backfill scheduler"
```

---

### Task 3: Wire `HomeTasteMatchedHero`

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx`

- [ ] **Step 1: Replace `handleNotInterested` activeIndex block**

Remove:

```ts
if (index <= activeIndex && activeIndex > 0) {
  setActiveIndex((prev) => Math.max(0, prev - 1));
}
```

After filter remove, use:

```ts
setActiveIndex((prev) =>
  activeIndexAfterRemoval(index, prev, snapshot.length - 1),
);
```

- [ ] **Step 2: Remove all in-slot splice / single-replacement append**

Delete dismiss `replacement` splice block and `handleTitleConsumed` early return when `remainingCount >= TASTE_MATCH_MIN_RESULTS` + single-candidate append.

- [ ] **Step 3: Add scheduler ref**

```ts
const backfillSchedulerRef = useRef(
  createTasteQueueBackfillScheduler({
    runBackfill: buildTasteQueueBackfillRunner({
      getMovies: () => moviesRef.current,
      setMovies,
      fetchForYou: async () => { /* api.api.taste["for-you"].get() */ },
    }),
  }),
);
```

Use `moviesRef` synced via `useEffect` so debounced callback reads latest queue.

- [ ] **Step 4: Shared remove helper**

```ts
function removeFromQueue(tmdbId: number) {
  const snapshot = moviesRef.current;
  const index = snapshot.findIndex((f) => f.tmdbId === tmdbId);
  if (index < 0) return;
  setMovies((prev) => prev.filter((f) => f.tmdbId !== tmdbId));
  setActiveIndex((prev) => activeIndexAfterRemoval(index, prev, snapshot.length - 1));
  backfillSchedulerRef.current.schedule();
}
```

Wire `handleNotInterested`, `handleTitleConsumed`, and event listener through this.

- [ ] **Step 5: Dismiss error rollback**

On dismiss POST failure: restore snapshot movies + activeIndex; do not schedule backfill.

- [ ] **Step 6: Manual smoke**

Run dev server → `/home?browse=movies` → log spotlight → confirm next title stays; no flash of removed title after ~200ms.

- [ ] **Step 7: Commit**

```bash
git commit -am "fix(web): taste hero tail backfill without spotlight hijack"
```

---

### Task 4: Hero poster enter/exit motion

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx`

- [ ] **Step 1: Track entering tail ids**

```ts
const enteringPosterIdsRef = useRef<Set<number>>(new Set());
```

On backfill `setMovies`, diff old/new ids; add new tail ids to set; clear each id after `onAnimationComplete` (~150ms) or immediately when `reduceMotion`.

- [ ] **Step 2: Wrap poster map in `AnimatePresence`**

Mirror rail pattern:

```tsx
<AnimatePresence initial={false} mode="popLayout">
  {movies.map((film, index) => (
    <motion.button
      key={film.tmdbId}
      layout={!reduceMotion}
      initial={enteringPosterIdsRef.current.has(film.tmdbId) && !reduceMotion
        ? { opacity: 0, scale: 0.96 } : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      ...
    />
  ))}
</AnimatePresence>
```

Use state bump (`enteringPosterIds` as `useState<Set<number>>`) if ref-only does not trigger initial animation — prefer small `useState` set of entering ids cleared on complete.

- [ ] **Step 3: Verify reduced motion** — no layout/enter/exit tweens.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(web): taste hero poster rail enter/exit motion"
```

---

### Task 5: Wire `HomeTasteMatchedRail`

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-rail.tsx`

- [ ] **Step 1: Replace handlers with shared remove + scheduler**

Same pattern as hero (no `activeIndex`). Remove splice blocks in `handleNotInterested` and `handleTitleConsumed`.

- [ ] **Step 2: Subscribe to `TASTE_TITLE_CONSUMED_EVENT`**

```ts
useEffect(() => {
  const onConsumed = (event: Event) => {
    const detail = (event as CustomEvent<TasteTitleConsumedDetail>).detail;
    if (detail?.tmdbId != null) removeFromQueue(detail.tmdbId);
  };
  window.addEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
  return () => window.removeEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
}, [removeFromQueue]);
```

- [ ] **Step 3: Dismiss path**

Optimistic remove → POST dismiss → on success `schedule()`; on failure restore + toast.

- [ ] **Step 4: Manual smoke**

Dismiss rail tile → tile exits; no replacement in same cell; queue length restored after debounce.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix(web): taste rail tail backfill and consumed listener"
```

---

### Task 6: transitions.dev tokens (optional polish)

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

- [ ] **Step 1: Check for existing `--dropdown-open-dur` in `:root`**

If absent, append transitions.dev universal `:root` block from `.agents/skills/transitions-dev/SKILL.md` (resize + dropdown tokens only — do not duplicate if any `--resize-dur` already present).

- [ ] **Step 2: Optionally reference CSS vars in hero poster `transition` duration** — YAGNI unless aligning to 250ms dropdown token; spec allows 150ms motion/react as primary.

- [ ] **Step 3: Commit** (skip commit if no CSS change)

---

### Task 7: Verification + graphify

- [ ] **Step 1: Run unit tests**

```bash
cd apps/web && bun test src/lib/taste-match-queue.test.ts src/lib/taste-matched-discovery.test.ts
```

Expected: all PASS

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && bun run check-types
```

- [ ] **Step 3: Manual QA checklist** (from spec)

1. Hero log → next trailer, tail poster pop-in  
2. Hero dismiss → no jump to previous film  
3. Hero rapid 3× dismiss → single backfill burst  
4. Rail dismiss → no in-cell replacement  
5. Reduced motion → instant  

- [ ] **Step 4: Update scratchpad** — mark plan tasks complete pending human verify

- [ ] **Step 5: graphify**

```bash
graphify update .
```

- [ ] **Step 6: Final commit** if scratchpad-only delta

---

## Success criteria

- No `splice(index, 0, replacement)` in hero or rail taste handlers
- Queue targets 24 titles after debounced backfill
- Removing active hero title keeps `activeIndex` stable
- Unit tests cover index math, merge, debounce
- Human verifies hero browse flow uninterrupted after actions
