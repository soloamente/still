# App Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three named shell palettes (Theater, Lobby Light, Noir) with Settings appearance controls, persistence, bundled cinema defaults, and Pro-tier validation stub.

**Architecture:** `next-themes` applies `theme-*` classes on `<html>`; semantic tokens live in `globals.css` per class; `AppThemeShell` syncs `data-cinema-preset`; profile `preferences` + `localStorage` for guests.

**Tech Stack:** Next.js 16, `next-themes@0.4.x`, Tailwind v4, Elysia profiles PATCH, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-app-themes-design.md`

---

### Task 1: Theme registry + tests (web)

**Files:**
- Create: `apps/web/src/lib/app-themes.ts`
- Create: `apps/web/src/lib/app-themes.test.ts`

- [ ] Tests for `resolveAppTheme`, `resolveCinemaPreset`, `defaultCinemaPresetForTheme`
- [ ] Implement registry + helpers

### Task 2: CSS theme classes

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

- [ ] Move semantic shell tokens from `:root` into `.theme-theater` (keep `:root` shared + theater fallback)
- [ ] Add `.theme-lobby-light`, `.theme-noir`
- [ ] Lobby Light grain opacity tweak if needed

### Task 3: Runtime shell

**Files:**
- Create: `apps/web/src/components/app/app-theme-shell.tsx`
- Modify: `apps/web/src/components/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] ThemeProvider `themes` + `storageKey` + system `value` map
- [ ] AppThemeShell: cinema `dataset` + bundled default on theme change
- [ ] Remove hard-coded `dark` on `<html>`

### Task 4: Profile prefs + server validation

**Files:**
- Modify: `apps/web/src/lib/profile-preferences.ts`
- Create: `apps/server/src/lib/app-themes.ts`
- Modify: `apps/server/src/routes/profiles.ts`

- [ ] Pref constants + readers
- [ ] `sanitizeAppearancePreferences()` on PATCH merge
- [ ] Server tests optional; manual PATCH check

### Task 5: Settings UI

**Files:**
- Create: `apps/web/src/components/profile/me-appearance-settings.tsx`
- Modify: `apps/web/src/components/profile/settings-form.tsx`

- [ ] Appearance section: theme grid + cinema segmented control
- [ ] Instant apply + Save PATCH fields

### Task 6: Verify

- [ ] `cd apps/web && bun test src/lib/app-themes.test.ts`
- [ ] `bun run build` (web)
- [ ] `graphify update .`
