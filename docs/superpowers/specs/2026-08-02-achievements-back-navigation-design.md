# Achievements back navigation — anti-loop return

**Status:** Approved (brainstorm 2026-08-02; approach **A · Dedicated return resolver + capture**; human **go**)
**Date:** 2026-08-02
**Scope:** Fix Achievements back pill looping to `/achievements`; persist prior route on achievements entry; mirror Profile/Settings return patterns.
**Out of scope:** Year-in-review sub-routes under `/year/…` (separate shell); mobile tab bar changes.

## Problem

`AchievementsTopBar` uses `useMovieDetailReturn()`, which reads `still:detail-return:v1` session storage. Flow:

1. Patron on `/achievements`
2. Opens profile → `DetailReturnCapture` persists `/achievements` as return
3. Returns to `/achievements` → storage is **not** updated (achievements entry not captured)
4. Back pill resolves to **Achievements** → self-loop

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Approach | **A** — `resolveAchievementsReturn` + capture on achievements entry |
| Self-loop | Never back to any `/achievements` URL (ignore `?tab=`) |
| Fallback | Last `/home` browse rail (`homeBrowseFallback`) |
| Capture | Persist previous route when **entering** achievements (same as profile) |

## Architecture

| Module | Change |
| --- | --- |
| `movie-detail-return.ts` | `isAchievementsPath`, `isAchievementsReturnHref`, `resolveAchievementsReturn` |
| `detail-return-capture.tsx` | Persist on achievements entry |
| `use-achievements-return.ts` | New hook (mirrors `useProfileReturn`) |
| `achievements-top-bar.tsx` | Use `useAchievementsReturn` |

## Behavior matrix

| Navigation | Back pill |
| --- | --- |
| Home → Achievements | Last home browse label (Movies / TV / Community) |
| Profile → Achievements | Profile |
| Achievements → Profile → Achievements | Profile |
| Refresh on Achievements | Home browse fallback |
| Tab switch (`?tab=goals`) | Back unchanged |

## Testing

- Unit: `isAchievementsReturnHref`, `resolveAchievementsReturn` loop guard (mocked storage)
- Manual: account menu → Achievements → back; Achievements → Profile → Achievements → back
