# Listing detail scroll reset — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Always land at the top when opening film/TV detail or switching detail tabs, while preserving lobby scroll on back navigation.

**Architecture:** Add a shared `scrollDocumentToTop` helper (Lenis + native), a `useListingDetailScrollReset` hook (`useLayoutEffect` + rAF retry + temporary `history.scrollRestoration = 'manual'`), wire it into `MovieDetailViewShell`, and DRY `AppScrollToTop`.

**Tech stack:** Next.js App Router, React 19, Lenis (`lenis/react`), `bun:test`

**Spec:** `docs/superpowers/specs/2026-08-02-listing-detail-scroll-reset-design.md`

---

### Task 1: `scrollDocumentToTop` lib + tests

**Files:**
- Create: `apps/web/src/lib/scroll-document-to-top.ts`
- Create: `apps/web/src/lib/scroll-document-to-top.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, test, mock } from "bun:test";
import { scrollWindowToTopInstant } from "./scroll-document-to-top";

describe("scrollWindowToTopInstant", () => {
  test("calls window.scrollTo with top 0 and instant behavior", () => {
    const scrollTo = mock(() => {});
    const original = globalThis.window;
    // @ts-expect-error test stub
    globalThis.window = { scrollTo };
    try {
      scrollWindowToTopInstant();
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    } finally {
      globalThis.window = original;
    }
  });
});
```

**Step 2: Run test — expect FAIL**

Run: `cd apps/web && bun test src/lib/scroll-document-to-top.test.ts`
Expected: FAIL — module not found

**Step 3: Implement minimal lib**

```ts
import type Lenis from "lenis";

export type ScrollDocumentBehavior = "instant" | "smooth";

export function scrollWindowToTopInstant(): void {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "instant" });
}

export function scrollDocumentToTop(options?: {
  lenis?: Lenis | null;
  behavior?: ScrollDocumentBehavior;
}): void {
  const behavior = options?.behavior ?? "instant";
  const lenis = options?.lenis;
  if (lenis) {
    lenis.scrollTo(0, {
      immediate: behavior === "instant",
      duration: behavior === "instant" ? 0 : undefined,
    });
  }
  if (behavior === "instant") {
    scrollWindowToTopInstant();
    return;
  }
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
```

**Step 4: Run test — expect PASS**

Run: `cd apps/web && bun test src/lib/scroll-document-to-top.test.ts`
Expected: PASS

---

### Task 2: `useListingDetailScrollReset` hook

**Files:**
- Create: `apps/web/src/lib/use-listing-detail-scroll-reset.ts`
- Modify: `apps/web/src/components/movie/movie-detail-view-shell.tsx`

**Step 1: Add hook**

```ts
"use client";

import { useLenis } from "lenis/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { scrollDocumentToTop } from "@/lib/scroll-document-to-top";
import type { MovieDetailView } from "@/lib/movie-detail-view";

export function useListingDetailScrollReset(args: {
  listingId: number;
  view: MovieDetailView;
}): void {
  const lenis = useLenis();
  const previousRestorationRef = useRef<ScrollRestoration | null>(null);
  const resetKeyRef = useRef<string | null>(null);

  const resetKey = `${args.listingId}:${args.view}`;

  // While on detail, block browser from replaying stale scroll offsets.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    previousRestorationRef.current = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      if (previousRestorationRef.current != null) {
        window.history.scrollRestoration = previousRestorationRef.current;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    scrollDocumentToTop({ lenis, behavior: "instant" });
  }, [lenis, resetKey]);

  // One rAF retry catches late browser restoration races.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = requestAnimationFrame(() => {
      if (window.scrollY > 0) {
        scrollDocumentToTop({ lenis, behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [lenis, resetKey]);
}
```

**Step 2: Wire into `MovieDetailViewShell`**

In `MovieDetailViewShellBody`:

- Import `useListingDetailScrollReset`
- Call `useListingDetailScrollReset({ listingId: movieId, view })`
- **Remove** the existing `previousViewRef` + `useEffect` that only calls `window.scrollTo` on view change (hook subsumes it)

**Step 3: Smoke in dev**

Run: `bun dev` (web `:3001`)
Manual: `/home` scroll down → open movie → confirm top; switch tabs → confirm top.

---

### Task 3: DRY `AppScrollToTop`

**Files:**
- Modify: `apps/web/src/components/app/app-scroll-to-top.tsx`

**Step 1: Import helper**

Replace inline Lenis + `window.scrollTo` in `scrollToTop` callback with:

```ts
scrollDocumentToTop({
  lenis,
  behavior: reduceMotion ? "instant" : "smooth",
});
```

Preserve existing `duration` for smooth button via helper options if needed — or keep button-specific Lenis duration in `AppScrollToTop` only (helper smooth path uses native smooth as fallback).

**Step 2: Verify floating button still works**

Manual: scroll `/home` → tap floating scroll-to-top → returns to top with smooth motion (when smooth scroll enabled and reduced motion off).

---

### Task 4: Automated verification + graphify

**Step 1: Run tests**

Run: `cd apps/web && bun test src/lib/scroll-document-to-top.test.ts`
Expected: PASS

**Step 2: Lint touched files**

Run: `cd apps/web && bunx biome check src/lib/scroll-document-to-top.ts src/lib/use-listing-detail-scroll-reset.ts src/components/movie/movie-detail-view-shell.tsx src/components/app/app-scroll-to-top.tsx`

**Step 3: Update graph (if CLI available)**

Run: `graphify update .` from repo root (skip if not on PATH).

---

### Task 5: Manual QA checklist (human)

- [ ] Home → movie (first visit) — top
- [ ] Home → movie (revisit) — top
- [ ] Detail scroll down → back — home position restored
- [ ] Tab switches — top each time
- [ ] Smooth scroll setting ON — same behavior
- [ ] TV detail `/tv/[id]` — same behavior

**Success criteria:** All items pass; no flash of wrong scroll on mid-tier mobile.
