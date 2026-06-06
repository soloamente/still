# Home Community First-Load Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Community on `/home` paints on first visit without requiring a Movies/TV round-trip.

**Architecture:** Extract pure gate resolver; compare client URL + pending state to frozen `serverBrowse`; auto `navigate` when stale; session restore uses `navigate` not `replaceState`.

**Tech Stack:** Next.js App Router, React 19, Bun test

**Spec:** `docs/superpowers/specs/2026-06-06-home-community-first-load-design.md`

---

### Task 1: Gate resolver + tests

- [x] Create `home-lobby-body-gate-mode.ts` with `resolveLobbyBodyGateMode`
- [x] Add `home-lobby-body-gate-mode.test.ts` (5 cases)
- [x] Run `bun test src/lib/home-lobby-body-gate-mode.test.ts`

### Task 2: Wire gate + session restore

- [x] Update `home-lobby-body-gate.tsx` — client urlBrowse, stale RSC sync effect
- [x] Update `home-lobby-session-restore.tsx` — `navigate(href)`
- [x] Rename prop in `home/page.tsx` to `serverBrowse`

### Task 3: Manual QA

- [ ] Bare `/home` with Community as last surface → Community content loads
- [ ] `/home?browse=community` cold load → lists paint
- [ ] Tap Movies → Community → skeleton briefly, then content
- [ ] Movies cold load unchanged
