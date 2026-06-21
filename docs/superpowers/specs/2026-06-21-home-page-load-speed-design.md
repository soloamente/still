# Home Page Load Speed — Design Spec

**Date:** 2026-06-21  
**Status:** Approved

## Problem

Navigating to `/home` via the nav link is noticeably slow. The loading skeleton appears immediately (RSC shell is fast), but content takes a long time to swap in. Hard refresh is faster because HTML streams progressively; client-side nav holds on the skeleton until the full RSC payload resolves.

## Root Cause

`apps/web/src/app/(app)/home/page.tsx` has a 4-step sequential waterfall at the top of the Server Component:

```
1. serverApi()         → fast (builds Eden client, no network)
2. authServer()        → network fetch: /api/auth/get-session
3. fetchMeProfile()    → network fetch: /api/profiles/me
4. compute prefs → Promise.all([continueWatching, tasteMatchedRail, committedSearch])
5. lobbyResult fetch   → network fetch (depends on prefs from step 3)
```

Steps 2 and 3 are **independent** but sequential — one RTT wasted.  
Steps 4 and 5 are also sequential — `lobbyResult` only depends on profile prefs, not session, so it can be merged into the `Promise.all` after steps 2+3 both resolve.

## Design

### Step 1 — Parallelize auth + profile

Replace:
```ts
const api = await serverApi();
const session = await authServer();
const profileResult = await fetchMeProfile();
```

With:
```ts
const api = await serverApi();
const [session, profileResult] = await Promise.all([
  authServer(),
  fetchMeProfile(),
]);
```

This saves one full network RTT on every `/home` render.

### Step 2 — Merge lobbyResult into the Promise.all

After computing prefs from `profileResult` (which is synchronous), move the `lobbyResult` fetch into the existing `Promise.all` alongside `continueWatching`, `tasteMatchedRail`, and `committedSearchPayload`. The current shape is:

```ts
const [continueWatching, tasteMatchedRail, committedSearchPayload] =
  await Promise.all([...]);

// sequential — waits for all three above before starting
lobbyResult = await fetchTvDiscover(...) / fetchMoviesNowPlaying(...) / ...
```

After the fix:
```ts
const [continueWatching, tasteMatchedRail, committedSearchPayload, lobbyResult] =
  await Promise.all([..., resolveLobbyFetch(...)]);
```

Where `resolveLobbyFetch` is a small inline helper (or an immediately-invoked async function) that contains the existing `if/else` tree that picks the right fetch. This saves a second RTT.

### What doesn't change

- No changes to `serverApi`, `authServer`, or `fetchMeProfile` — the fix is purely in call order.
- `force-dynamic` stays — the page must always be fresh.
- No caching layer added — out of scope.
- All Suspense boundaries, skeleton fallbacks, and component structure remain the same.

## Files Affected

- `apps/web/src/app/(app)/home/page.tsx` — only file changed

## Expected Impact

Each eliminated sequential RTT saves however long one API call takes (typically 50–300ms depending on region/load). Two RTTs eliminated = potentially 100–600ms off the skeleton-to-content time perceived during client-side nav.
