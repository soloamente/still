# Home Taste Hero Media Fix — Implementation Plan

> **For agentic workers:** Implement task-by-task; verify on `/home?browse=movies` after each visual change.

**Goal:** Full-bleed taste hero media (no right gap), stable hydration, production logo/trailer when API key is set.

**Architecture:** CSS shell + container-query iframe cover on web; stable `NEXT_PUBLIC_SERVER_URL` for YouTube origin; client-mount gate for notification unread chrome.

**Spec:** `docs/superpowers/specs/2026-07-02-home-taste-hero-media-fix-design.md`

---

### Task 1: Media shell + iframe cover

**Files:** `home-taste-hero-layout.ts`, `home-taste-hero-media-layer.tsx`

- [ ] Centered `w-[calc(100%+2rem)]` bleed on shell
- [ ] `@container` inner + cqw/cqh iframe cover dimensions

### Task 2: Trailer origin hydration

**Files:** `home-taste-matched-hero.tsx`, `home-taste-hero-trailer-src.test.ts`

- [ ] Use `env.NEXT_PUBLIC_SERVER_URL` for YouTube origin
- [ ] Unit test for stable origin param

### Task 3: Notifications bell hydration

**Files:** `notifications-bell-menu.tsx`

- [ ] `useMounted` gate for unread-specific UI

### Task 4: Verify

- [ ] `bun test` relevant files
- [ ] Manual: `/home` hero full bleed; no hydration console errors
