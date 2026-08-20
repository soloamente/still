# Listing detail scroll reset — film/TV detail entry & tabs

**Status:** Approved (brainstorm 2026-08-02; approach **A · Detail-scoped scroll reset + Lenis sync**; human **go**)
**Date:** 2026-08-02
**Scope:** Reset document scroll to the top when patrons **forward-navigate** into film/TV detail or switch detail tabs (About · Streaming · Community · Quotes). Preserve lobby scroll restoration when returning to catalogue lobbies (e.g. `/home` back navigation).
**Out of scope (YAGNI):** Person detail (`/people/[id]`) — follow-up if the same bug appears; animated scroll on route entry; sessionStorage scroll maps; changes to lobby `scroll: false` chip navigation.

## Context

Patrons report that tapping a movie from `/home` often lands them **mid-page** on film detail — as if the app resumed a previous scroll position on that title. Switching detail tabs (About → Community, etc.) can feel the same: content does not reliably start at the top.

**Root causes (confirmed in code):**

1. **No scroll reset on forward entry** — `movie-detail-view-shell.tsx` only calls `window.scrollTo({ top: 0 })` when the **view tab** changes, not when the route or listing id changes.
2. **Lenis desync** — tab reset uses native `window.scrollTo` only. When smooth scroll is enabled (Settings → Experience), Lenis owns scroll position; native calls may not move the visible viewport.
3. **Browser scroll restoration** — revisiting a detail URL in the same session can replay a saved scroll offset **after** React paints, racing client effects.

**What must stay unchanged:**

- Home lobby filter chips use `router.replace(..., { scroll: false })` via `useLobbyTransition` — catalogue scroll position is intentionally preserved during in-lobby navigation.
- Browser **back** from detail to a lobby should still restore the lobby scroll position (default `history.scrollRestoration = 'auto'` outside detail shells).

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Primary approach | **A** — detail-scoped reset + Lenis sync |
| Forward entry (any source) | Always scroll to **top** (hero visible) |
| Re-open same title in session | Always scroll to **top** (do not resume prior detail scroll) |
| Detail tab switch | Always scroll to **top** of the new tab |
| Back to `/home` (or other lobby) | **Preserve** browser-restored lobby scroll |
| Lobby chip nav (`scroll: false`) | **Unchanged** |
| Motion on entry reset | **Instant** (`immediate: true` / `behavior: 'instant'`) — Emil: speed over delight on frequent nav |
| `prefers-reduced-motion` | Still instant (no smooth scroll on reset) |
| v1 routes | `/movies/[id]`, `/tv/[id]` (shared `MovieDetailViewShell`) |

## Behavior matrix

| Navigation | Expected scroll |
| --- | --- |
| Home → tap poster (new title) | Top of detail |
| Home → tap poster (revisited title) | Top of detail |
| Search / diary / profile → detail | Top of detail |
| Detail tab: About → Community → … | Top of tab panel |
| Detail → browser back → home | Restore home scroll |
| Home sort/venue chip (same pathname) | Preserve scroll |
| Browser forward back to detail (edge) | Top of detail (acceptable; rare) |

## Architecture

### New modules

| Module | Kind | Responsibility |
| --- | --- | --- |
| `apps/web/src/lib/scroll-document-to-top.ts` | lib | Pure helpers: instant native scroll; optional Lenis sync via passed instance |
| `apps/web/src/lib/use-listing-detail-scroll-reset.ts` | client hook | `useLayoutEffect` + one rAF retry; toggles `history.scrollRestoration` while mounted |
| `apps/web/src/lib/scroll-document-to-top.test.ts` | test | Unit tests for key builder / native helper (no DOM Lenis) |

### Modified modules

| Module | Change |
| --- | --- |
| `apps/web/src/components/movie/movie-detail-view-shell.tsx` | Replace inline tab `window.scrollTo` with `useListingDetailScrollReset({ listingId: movieId, view })` |
| `apps/web/src/components/app/app-scroll-to-top.tsx` | Reuse `scrollDocumentToTop` helper for Lenis + native parity (DRY) |

### Hook contract

```ts
useListingDetailScrollReset({
  listingId: number,
  view: MovieDetailView,
})
```

**Triggers reset when:**

- `listingId` changes (different title)
- `view` changes (tab switch)
- Initial mount on a detail page

**Does not run when:** unrelated re-renders with the same `listingId` + `view`.

### `scrollDocumentToTop(options)`

```ts
type ScrollDocumentToTopOptions = {
  lenis?: Lenis | null;
  /** Always instant for route/tab resets; smooth only for AppScrollToTop button when allowed */
  behavior?: "instant" | "smooth";
};
```

Implementation:

1. If `lenis` present → `lenis.scrollTo(0, { immediate: behavior === "instant" })`
2. Always → `window.scrollTo({ top: 0, behavior: behavior === "instant" ? "instant" : "smooth" })`

### Browser scroll restoration guard

While the detail shell is mounted:

1. On mount (layout effect): save prior `history.scrollRestoration`, set to `'manual'`
2. Reset scroll (layout effect + rAF retry)
3. On unmount: restore saved value (typically `'auto'`)

This prevents the browser from re-applying a stale detail scroll offset after React commits, without breaking lobby restoration when the patron leaves detail (restoration returns to `'auto'` before the lobby entry is restored on back).

### Timing (Emil / performance)

| Phase | API | Why |
| --- | --- | --- |
| Before paint | `useLayoutEffect` | Avoid flash of wrong scroll position |
| After paint race | `requestAnimationFrame` once | Catch late browser restoration |
| Animation | None on route/tab reset | Frequent interaction — no extraneous motion |

## Data flow

No API or server changes. Client-only scroll coordination on existing detail shells.

## Error handling

| Case | Behavior |
| --- | --- |
| Lenis not mounted (SSR / early hydrate) | Native `window.scrollTo` only |
| `window` undefined | Hook no-ops (SSR) |
| `history.scrollRestoration` unsupported | Skip manual toggle; rely on layout + rAF reset |

## Testing

### Automated

- `scroll-document-to-top.test.ts` — native helper sets `window.scrollY` path (jsdom or stub)
- `listing-detail-scroll-reset-key.test.ts` (optional inline in same file) — stable key from `{ listingId, view }`

### Manual QA

1. `/home` scroll down → tap a movie → lands on **hero** (top)
2. Scroll detail to Community section → back to home → **home scroll restored**
3. Re-open same movie → **top**, not previous detail scroll
4. About → Community → Streaming → Quotes → each opens at **top**
5. Repeat with Settings → Experience → smooth scroll **on** (Lenis)
6. `prefers-reduced-motion: reduce` — instant reset, no jank

## Success criteria

- [ ] Forward navigation to `/movies/[id]` and `/tv/[id]` always starts at document top
- [ ] Detail tab switches always start at document top (Lenis on or off)
- [ ] Back from detail to `/home` preserves catalogue scroll position
- [ ] Home lobby chip navigation still preserves scroll (`scroll: false` unchanged)
- [ ] No visible flash of mid-page content before reset on typical devices

## References

- `apps/web/src/components/movie/movie-detail-view-shell.tsx` — existing tab-only reset
- `apps/web/src/lib/use-lobby-transition.ts` — lobby `scroll: false`
- `apps/web/src/components/lenis-provider.tsx` — `stopInertiaOnNavigate`
- `docs/superpowers/specs/2026-05-29-home-browse-instant-navigation-design.md` — lobby scroll preservation intent
