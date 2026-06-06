# Home Community First-Load Skeleton Hang

**Status:** Approved (2026-06-06; human **go**)  
**Date:** 2026-06-06  
**Scope:** `/home?browse=community` (and bare `/home` restored to Community) stuck on `CommunityLobbySkeleton`  
**Related:** [Home Browse Instant Navigation](./2026-05-29-home-browse-instant-navigation-design.md)

## Summary

Patrons landing on **Community** see the lobby skeleton forever until they switch to Movies/TV and back. The browse pill and address bar show Community, but the catalogue never paints.

## Root cause

`HomeLobbyBodyGate` compares client `activeBrowse` to a **frozen server prop** (`urlBrowse={browse}` from RSC). When the client URL says Community but the server rendered the Movies/TV branch, the gate enters `community-pending` and returns `CommunityLobbySkeleton` **without mounting** the Community RSC subtree — and never exits because no `router.replace` runs.

Common trigger: bare `/home` visit where `HomeLobbySessionRestore` rewrites the URL to `?browse=community` via `history.replaceState` (localStorage) while the server had no matching cookie and rendered Movies. Visiting Movies/TV then Community runs `router.replace`, aligns RSC with URL, and works.

## Decisions

| Topic | Decision |
|--------|----------|
| Primary fix | Gate uses **client** `urlBrowse` from context + `isPending`; server prop renamed `serverBrowse` for stale-RSC detection only |
| Skeleton rule | Show target skeleton when optimistic (`activeBrowse !== clientUrlBrowse`), `isPending`, or **RSC stale** (`clientUrlBrowse !== serverBrowse`) |
| Stale RSC sync | `useEffect` one-shot `navigate(currentHref)` when client URL settled but `serverBrowse` differs |
| Session restore | Use `navigate(href)` instead of `replaceState` on bare `/home` so RSC catches up |
| Prefetch | Optional follow-up — not required for this fix |

## Gate matrix (target)

| `activeBrowse` | `clientUrlBrowse` | `serverBrowse` | `isPending` | Body |
|----------------|-------------------|----------------|-------------|------|
| `community` | `movies`/`tv` | any | yes/no | `CommunityLobbySkeleton` |
| `movies`/`tv` | `community` | any | yes/no | `TmdbLobbySkeleton` |
| aligned | aligned | **≠ client** | no | skeleton + `navigate` sync |
| aligned | aligned | aligned | no | RSC `children` |

## Success criteria

1. Open app at `/home?browse=community` (or bare `/home` with Community as last surface) — Community lists/reviews/activity paint without visiting Movies first.
2. Optimistic browse tap still shows skeleton until RSC pending completes.
3. Movies/TV cold load unchanged.

## Files

| File | Change |
|------|--------|
| `home-lobby-body-gate.tsx` | Client-aware gate + stale RSC sync |
| `home-lobby-session-restore.tsx` | `navigate` instead of `replaceState` |
| `home-lobby-body-gate.test.ts` | Unit tests for gate resolver |
| `home/page.tsx` | Prop rename `serverBrowse` |
