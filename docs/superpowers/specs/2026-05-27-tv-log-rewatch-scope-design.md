# TV diary rewatch scope — design spec

**Date:** 2026-05-27  
**Status:** Approved — implementation complete, pending manual QA  
**Approach:** 1 (client scoped-count helper + auto season diary on mark complete)

## Problem

1. **Rewatch defaults wrong:** Quick Log sets `rewatch` when *any* diary row exists on the show. Logging **Season 2** after **Season 1** incorrectly defaults to rewatch.
2. **Hero badge misleading:** The rewatch circle shows `myLogs.length` (all scopes). Patrons expect it to reflect **whole-series** diary logs only.
3. **Season rows lack diary signal:** Progress panel shows episode completion but not how many **season-scoped** diary entries exist.
4. **Mark season complete is two-step:** Completing a season only updates `tv_watch` progress, then a toast nudges **Log to diary** again — feels like logging twice.

## Goals

1. **Scope-aware rewatch (A):** Rewatch defaults on only when a prior log exists for the **same** scope (show / season / episode).
2. **Hero count = show scope:** Badge and “record another watch” on the hero use **show-scoped** log count only.
3. **Per-season diary count:** Each season row in progress (season mode) shows that season’s diary count (and sensible actions).
4. **Mark complete → diary:** Marking a season complete **creates one season-scoped diary row** automatically when none exists — no second “Log to diary” prompt.

## Non-goals

- Changing `tv_watch` progress mechanics (episode checkboxes, complete-season API).
- Auto-logging on every episode checkbox toggle.
- Server-enforced rewatch (patron can still toggle Rewatch in Quick Log).
- Merging or deduping multiple season logs into one.

## Scope matching rules

Shared helper: `countTvLogsInScope(logs, target)` / `tvLogsMatchingScope(logs, target)`.

| Target scope | Matches log when |
|--------------|------------------|
| **show** | `logScope === "show"` OR `logScope` null/undefined (legacy → treat as show) |
| **season** + `N` | `logScope === "season"` AND `seasonNumber === N` |
| **episode** + `S` + `E` | `logScope === "episode"` AND same season + episode |

**Rewatch default (new log):** `rewatch = count > 0` for the **currently selected** scope in Quick Log.

**Movies:** unchanged (`priorLogCount` = all film logs).

## UI behavior

### Hero (`tv-detail-primary-actions`)

- `showLogCount = countTvLogsInScope(myLogs, { logScope: "show" })`.
- Rewatch icon badge: show only when `showLogCount > 1` (display `showLogCount`).
- Opening Quick Log from hero (no scope args): `logScope: "show"`, `priorLogCount: showLogCount` (or pass `priorTvLogs` — see Quick Log).
- `hasLogged` for hero layout may remain “any log on show” OR “any show-scoped log” — **use any log** so patrons who only logged seasons still see diary affordances; only the **badge number** is show-scoped.

### Quick Log sheet

- TV opens pass `priorTvLogs: MyTvLog[]` (from cached `myLogs`).
- On open and when patron changes **scope / season / episode** pickers: recompute `rewatch` from scoped count (do not fight explicit edit mode with `logId`).

### Progress panel — season mode (`tv-detail-progress-panel`)

Per season row:

- `seasonLogCount = countTvLogsInScope(myLogs, { logScope: "season", seasonNumber: sn })`.
- Subline includes diary hint when `seasonLogCount > 0`, e.g. `3 / 10 episodes · Complete · 1 log` (copy TBD; singular/plural).
- **Incomplete season:** **Mark season complete** (unchanged progress action).
- **Complete season:**
  - If `seasonLogCount === 0` — should not happen after this feature if they used Mark complete (auto-log); still allow **Log to diary** as fallback.
  - If `seasonLogCount > 0` — primary action **Edit diary** (latest season-scoped log) or **Log again** if `seasonLogCount > 1` uses rewatch default; v1: **Edit diary** when count === 1, **Log to diary** (scoped, rewatch default) when patron wants another — prefer **Edit** for most recent season log when count ≥ 1.

Simplified v1 actions when season episodes complete:

| `seasonLogCount` | Button |
|------------------|--------|
| 0 | **Log to diary** (fallback; auto-log should have run) |
| 1 | **Edit diary** |
| 2+ | **Edit diary** + optional secondary “Log again” OR badge `×N` on row — **prefer:** show count in subline + **Edit diary** (latest) |

### Mark season complete → auto diary

After `postTvWatchCompleteSeason` succeeds:

1. If `countTvLogsInScope(myLogs, { season, sn }) === 0`:
   - `postLog({ tvId, logScope: "season", seasonNumber: sn, watchedAt: today, watchVenue: "streaming", rewatch: false, … })` with **minimal row** (no rating required; no Quick Log sheet).
2. `refreshUserState()` on TV detail.
3. Toast: **“Season N marked complete”** — description optional (“Added to your diary”); **no** “Log to diary” action button.

If `postLog` fails after progress succeeded: toast success for progress + **“Couldn’t add diary entry”** with retry action (opens Quick Log scoped to season).

If season-scoped log **already exists:** skip create; toast only progress message.

## Implementation notes

| Area | Change |
|------|--------|
| `apps/web/src/lib/tv-log-scope-prior.ts` | New: `countTvLogsInScope`, `findLatestTvLogInScope` |
| `use-tv-detail-user-state.ts` | Scoped `priorLogCount`; expose `myLogs` or helpers |
| `quick-log-sheet.tsx` | `priorTvLogs` + recompute on scope change |
| `tv-detail-primary-actions.tsx` | `showLogCount` for badge |
| `tv-detail-progress-panel.tsx` | Season counts, auto-log, button states |
| `catalogue-poster-tile.tsx` | TV quick log: show-scoped prior count |
| Tests | `tv-log-scope-prior.test.ts` |

## Acceptance

- [ ] Log S1 → open Quick Log for S2 → **Rewatch off** by default.
- [ ] Log S1 again (scoped season 1) → **Rewatch on**.
- [ ] Hero badge shows **show** log count only (S1+S2 season logs don’t inflate it).
- [ ] Season row shows **per-season** log count.
- [ ] **Mark season complete** creates one season diary row; no follow-up toast CTA to log again.
- [ ] Complete season with existing season log → **Edit diary**, not redundant empty log prompt.

## Related specs

- `docs/superpowers/specs/2026-05-20-tv-watching-progress-design.md` (original optional diary CTA — superseded for mark-complete by this spec)
