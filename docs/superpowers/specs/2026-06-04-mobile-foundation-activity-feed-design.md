# Mobile App — Phase 1: Foundation + Activity Feed

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan
**App:** `apps/native` (Expo Router / React Native)

## Context

`still` is a social media-tracking platform (identity-first, retention-driven —
see `sense-media-platform-strategy.md`). The web app (`apps/web`) is feature-rich
across ~16 areas. The native app (`apps/native`) is currently bare
Better-T-Stack boilerplate (drawer + tabs + sign-in/up).

The destination is **full feature parity** on mobile, delivered in phases. Each
phase gets its own spec → plan → build cycle. This document specs **Phase 1**:
the foundation everything else builds on, plus the **Activity feed** as the first
end-to-end vertical that sets the template for later features.

### Phasing (for context — only Phase 1 is specced here)

- **Phase 1 (this spec):** App shell + 5-tab nav, auth wired end-to-end, the
  TanStack Query + Eden data layer, a minimal mobile design-system baseline, and
  the **Activity feed** (Home) built fully.
- **Phase 2+:** Feature verticals — Search/Discover, Log & rate, movie/tv detail,
  diary, lists/watchlist, reviews, people/profile, chat, news, notifications,
  achievements — grouped into a few specs.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Phase 1 vertical | Home / Activity feed | Read-heavy; exercises lists, infinite scroll, data fetching — strong template for most screens. |
| Data layer | TanStack Query + typed Eden client (`@still/api-client`) | Caching, infinite queries, refetch, future optimistic mutations out of the box; RN standard; scales to all verticals. |
| Navigation shell | 5 tabs: Home · Search · **＋Log** · Inbox · You | Create-centric; matches retention-first strategy (logging is the daily routine). "You" absorbs identity-tier features later. |
| Feed card style | Rich cards | Larger posters, avatar header, inline like/comment affordances — more tactile and social. |

## Scope

**In scope**
- App shell with the 5-tab navigation (replaces today's `(drawer)` boilerplate).
- Auth wired end-to-end: signed-in **and** signed-out (discover) paths.
- TanStack Query + Eden data layer.
- Minimal mobile design-system baseline (only what the feed needs + obvious reuse).
- **Activity feed** (Home) built fully: rich cards per item kind, infinite scroll,
  pull-to-refresh, loading/empty/error states.

**Explicitly NOT in scope (later phases)**
- Search, Log/＋ flow, Inbox, You/Profile — exist as **stub "Coming soon" screens**
  so the shell is navigable; not real.
- Detail screens (tapping a card does not navigate to a title page yet).
- Mutations — likes/comments are **display-only** this phase.
- Chat, push notifications.

## Architecture

```
apps/native/
  app/
    _layout.tsx            # root providers: Query, Auth gate, Theme, HeroUI, gesture/keyboard
    (tabs)/
      _layout.tsx          # 5-tab bar: Home · Search · +Log · Inbox · You
      index.tsx            # Home → Activity feed
      search.tsx           # stub
      log.tsx              # stub (center action)
      inbox.tsx            # stub
      you.tsx              # stub
  lib/
    api.ts                 # Eden client factory: EXPO_PUBLIC_SERVER_URL + forwarded auth cookie
    query-client.ts        # TanStack QueryClient + provider
    auth-client.ts         # (exists) better-auth expo client
  features/feed/
    use-activity-feed.ts   # useInfiniteQuery wrapping /api/feed | /api/feed/discover
    activity-feed-types.ts # ported item/payload types + parse logic
    activity-list.tsx      # virtualized list + pull-to-refresh + footer states
    cards/
      activity-log-card.tsx
      activity-review-card.tsx
      activity-list-card.tsx
      activity-divergence-card.tsx
  components/ui/           # baseline: Avatar, Poster, Stars, Card, Skeleton, Text/theme tokens
```

Key foundation points:
- **Drawer removed.** `(drawer)` boilerplate is replaced by `(tabs)`. Existing
  `sign-in`/`sign-up` components are reused behind an auth gate.
- **Eden client** is the same `treaty<App>()` the web uses (`@still/api-client`),
  pointed at `EXPO_PUBLIC_SERVER_URL`, forwarding the better-auth session cookie
  from SecureStore so `/api/feed` is authenticated.
- **TanStack Query** `QueryClientProvider` wraps the app.

## Activity Feed — detail

### Data
- `useActivityFeed()` → `useInfiniteQuery`.
- Signed-in: `GET /api/feed?limit=40&before=<cursor>` + community period/tz params.
- Signed-out: `GET /api/feed/discover` (+ period/tz params).
- Page size 40 (matches web `COMMUNITY_ACTIVITY_LIMIT`).
- `getNextPageParam`: return the **last item's `at`** when a full page (≥40) was
  returned; otherwise `undefined` (end of feed).

### Types & parsing
- Item shape: `{ kind, at, payload }` with kinds `log | review | list | divergence`.
- Port the normalization (`parseFeedApiActivityItems` and the per-kind payload
  types) from the web `home-community-activity` lib so parsing is resilient — no
  blind `as` casts on untrusted payloads.

### Rendering — rich cards, one component per kind
- **log** — avatar header (name + "rated · 2h"), larger poster, title, star
  rating, liked/rewatch chips.
- **review** — avatar header, poster, title, quoted review snippet, like/comment
  counts (display-only).
- **list** — avatar header, list title, item count, cover poster strip.
- **divergence** — rating-divergence row (your rating vs theirs), guarded by
  `isFeedRatingDivergencePayload`.
- **Posters:** TMDB poster-URL helper ported from web; rendered via `expo-image`
  for caching + placeholder.
- **Virtualization:** FlashList if added, else `FlatList`.

### Interactions (Phase 1)
- Tapping a card: no-op placeholder (optionally a gentle `expo-haptics` tap) —
  detail screens come later.
- **Pull-to-refresh:** re-runs the first page.
- **Infinite scroll:** `onEndReached` fetches the next page.

## States & error handling
- **Loading:** skeleton rich-cards for first load; footer spinner for next pages.
- **Empty:** signed-in with no activity → "Follow people to fill your feed" empty
  state. Signed-out always falls back to `/discover`.
- **Error:** page-level retry (`refetch`) for first-page failure; inline
  "Tap to retry" footer for pagination failure (mirrors web `CommunityInfiniteFooter`).
- **Auth:** no session → render `/discover` feed + a sign-in affordance; session
  present → personalized feed.

## Testing
Pragmatic for RN:
- **Unit-test** the parsing/normalization (`parseFeedApiActivityItems` port) and
  the `getNextPageParam` cursor logic with fixtures — the bug-prone bits, runnable
  without a simulator.
- **Manual smoke pass** (documented checklist) for cards and the list on device /
  Expo Go. No heavy RN-testing-library harness in Phase 1.

## Design-system baseline
Minimal reusable primitives in `components/ui/`: Avatar, Poster, Stars, Card
surface, Skeleton, Text scale + theme tokens (via uniwind / HeroUI). Only what the
feed needs plus obvious near-term reuse, so Phase 2 verticals start from shared
atoms.

## Open considerations (not blocking)
- Whether to adopt FlashList now or defer to `FlatList` until perf demands it.
- Exact community `period`/`tz` defaults to send from mobile (mirror web defaults).
- Whether the signed-out sign-in affordance is a banner or a header button.
