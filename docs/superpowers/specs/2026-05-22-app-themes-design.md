# App Themes — Named Palettes (Theater · Lobby Light · Noir)

**Status:** Approved (brainstorm 2026-05-22)  
**Date:** 2026-05-22  
**Scope:** Web app (`apps/web` + `packages/ui` tokens); Settings appearance controls; profile persistence; Pro-tier infrastructure (no paywall UI in v1)  
**Out of scope (v1):** Native app (`apps/native`), Stripe/billing, paywall/upsell UI, fourth+ themes, `profile.accentColor` driving shell tokens, avatar-menu theme toggle

## Summary

Replace the de-facto single **Aker dark** shell with three **named palettes** patrons pick in **Settings → Appearance**. Each palette is a full semantic token set (canvas, raised, accent, borders). **Cinema atmosphere** (`data-cinema-preset`: arthouse / multiplex) becomes a **user preference** with **bundled defaults** when a palette is first applied; patrons can override atmosphere independently afterward. **Pro gating** is modeled in a shared theme registry and enforced on profile PATCH, but all v1 palettes remain **free**.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Theme model | **Named palettes (A)** — not accent-only skins or locked color+cinema bundles |
| v1 palettes | **Theater** (current), **Lobby Light** (true light shell), **Noir** (cooler dark, muted accent) |
| Implementation | **Approach 1** — `next-themes` theme IDs → `class` on `<html>` (`theme-theater`, `theme-lobby-light`, `theme-noir`); Lobby Light **without** `.dark` |
| Pro (v1) | **Infrastructure only (A)** — `tier: "free" \| "pro"` on registry + server validation; no lock UI |
| Cinema coupling | **Bundled defaults (B)** — theme switch sets recommended preset unless `cinemaPresetUserOverride === true` |
| Entry point | **Settings only** — not avatar menu (per AGENTS.md) |
| Per-film dye | **Unchanged** — `.movie-themed` / `MovieThemeProvider` on movie & TV detail only |
| `data-cinema-preset` | Move from env-only on `<html>` to client-synced preference (env may remain dev override) |

## Problem

1. The live app is **always dark**: `layout.tsx` hard-codes `className="… dark"`; `:root` and `.dark` duplicate the same tokens; **no `.light`** block exists.
2. `ModeToggle` (light / dark / system) is **unwired** and would not change surfaces meaningfully.
3. Patrons cannot choose a **daytime-readable** shell or an alternate **cinematic** dark without forking CSS ad hoc.
4. Future **Pro-only** themes need a stable ID + tier contract before billing ships.
5. Cinema preset is **build-time** (`NEXT_PUBLIC_CINEMA_PRESET`) — cannot follow patron choice or palette defaults.

## User stories

1. As a patron, I open **Settings → Appearance**, pick **Lobby Light**, and the app immediately uses a light canvas with readable ink while keeping Still’s orange accent family.
2. As a patron, I pick **Noir** and see a cooler, deeper shell with a softer accent — distinct from Theater.
3. As a patron, I switch to **Lobby Light** and, if I have never customized atmosphere, the app applies the **recommended** cinema preset for that palette; I can still change **Arthouse / Multiplex** later without it resetting on every visit.
4. As a signed-in patron, my theme and cinema preset survive reload and sync across devices via `profile.preferences`.
5. As a guest, my choices persist in `localStorage` until I sign in; on first authenticated session, guest values merge into profile when prefs are unset.
6. As a product owner, I can add a `pro` tier theme later without changing the persistence or validation shape.

## Theme registry

Single source of truth: `apps/web/src/lib/app-themes.ts` (export types + `APP_THEMES` record). Mirror minimal validation on server: `apps/server/src/lib/app-themes.ts` (IDs + tier only — avoid importing web into server incorrectly; duplicate allowed for v1 or extract to `packages/shared` if trivial).

| ID | Label | Tier (v1) | Default `cinemaPreset` | Notes |
|----|--------|-----------|-------------------------|--------|
| `theater` | Theater | `free` | `arthouse` | Current Aker OKLCH dark; **default** for new users |
| `lobby-light` | Lobby Light | `free` | `arthouse` | True light shell; Mobbin-adjacent readability; grain opacity may be reduced via theme-scoped tokens |
| `noir` | Noir | `free` | `multiplex` | Cooler neutrals, deeper canvas, desaturated desert-orange accent |

```ts
export type AppThemeId = "theater" | "lobby-light" | "noir";
export type AppThemeTier = "free" | "pro";
export type CinemaPresetId = "arthouse" | "multiplex";

export type AppThemeDefinition = {
  id: AppThemeId;
  label: string;
  tier: AppThemeTier;
  defaultCinemaPreset: CinemaPresetId;
  /** For Settings swatch preview */
  preview: { canvas: string; raised: string; accent: string };
};
```

**System preference:** Keep `enableSystem` on `ThemeProvider`. Map OS light → `lobby-light`, OS dark → `theater` via `next-themes` `value` prop (exact API per `next-themes@0.4.x` docs). Optional fourth Settings tile **System** that sets theme to `system`.

**Invalid / legacy storage:** Unknown theme id → `theater`. Migrate `localStorage` key from default `theme` to `still-app-theme` on first read.

## CSS architecture (`packages/ui/src/styles/globals.css`)

1. **`:root`** — shared mechanics only: spacing, font stacks, cinema animation keyframes, Mobbin specimen vars, non-semantic brand hex references.
2. **`.theme-theater`** — port current semantic ladder (`--background`, `--card`, `--accent`, borders, selection, sidebar) from today’s `:root` / `.dark`.
3. **`.theme-lobby-light`** — light `--palette-canvas` / `--palette-raised`, dark foreground ink, adjusted `--border` / `--input` / `::selection` for light surfaces.
4. **`.theme-noir`** — alternate OKLCH neutrals + muted `--accent` / `--ring`.
5. **Tailwind `@custom-variant dark`** — remains `(&:is(.dark *))` for any legacy `dark:` utilities; **do not** add `.dark` on `<html>` for Lobby Light. Prefer semantic tokens (`bg-background`, `text-foreground`) in new code; audit critical `dark:` usages during implementation (toasts, third-party).
6. **Lobby Light + grain** — if grain reads muddy on white canvas, add theme-scoped opacity vars under `.theme-lobby-light` (e.g. lower `--cinema-grain-opacity`).

Remove duplicate “default dark” assumption: semantic colors must live under theme classes, not unscoped `:root` alone.

## Runtime shell (`apps/web`)

### `ThemeProvider` (`components/providers.tsx`)

- `attribute="class"`
- `defaultTheme="theater"`
- `storageKey="still-app-theme"`
- `themes={["theater", "lobby-light", "noir"]}` (+ `system` if exposed)
- `disableTransitionOnChange` (keep)
- `enableSystem` with mapped light/dark theme ids

### `AppThemeShell` (new client wrapper)

Responsibilities:

1. Hydrate `appTheme` from profile (signed-in) or `localStorage` (guest) and call `setTheme`.
2. Sync `document.documentElement.dataset.cinemaPreset` from `cinemaPreset` preference.
3. On **theme change** (Settings or instant apply): if `!cinemaPresetUserOverride`, apply registry `defaultCinemaPreset` and persist.
4. Expose context or callbacks for Settings section (optional; props may suffice).

### Root layout (`app/layout.tsx`)

- Remove hard-coded `dark` from `<html className>`.
- Default SSR class: `theme-theater` (matches `defaultTheme`).
- `suppressHydrationWarning` on `<html>` (keep).
- `viewport.themeColor` / `colorScheme`: derive from active theme (Theater/Noir → dark; Lobby Light → light) via client effect or inline script alongside `next-themes`.

### Orphan `ModeToggle`

- Do not wire to avatar menu.
- Delete or repurpose in implementation plan if unused after Appearance section ships.

## Persistence

### Preference keys (`apps/web/src/lib/profile-preferences.ts`)

| Constant | Key | Type |
|----------|-----|------|
| `PROFILE_PREF_APP_THEME` | `appTheme` | `AppThemeId` |
| `PROFILE_PREF_CINEMA_PRESET` | `cinemaPreset` | `CinemaPresetId` |
| `PROFILE_PREF_CINEMA_PRESET_USER_OVERRIDE` | `cinemaPresetUserOverride` | `boolean` |

### Guest `localStorage`

| Key | Value |
|-----|--------|
| `still-app-theme` | `AppThemeId` |
| `still-cinema-preset` | `CinemaPresetId` |

### Server (`apps/server/src/routes/profiles.ts`)

On PATCH `preferences`:

1. If `appTheme` present: must be known id; if theme `tier === "pro"` and `profile.isPro === false`, reject with **403** (no pro themes in v1 registry).
2. If `cinemaPreset` present: must be `arthouse` \| `multiplex`.
3. Shallow-merge preferences (existing behavior).

### Sign-in merge

When session loads profile with empty `appTheme` / `cinemaPreset`, copy guest `localStorage` values once, then PATCH profile (implementation detail in plan — avoid blocking render).

## Settings UI (`/me/settings`)

New section **Appearance** (above **Theater audio** or immediately after Profile — executor picks consistent `MeSettingsSection` order):

### Color theme

- Three-tile grid (radio semantics): swatch preview (`preview.canvas` / `raised` / `accent`) + label.
- **Instant apply:** updating selection calls `setTheme` + updates dirty state for profile PATCH on **Save** (same pattern as other settings fields).
- Accessible: `role="radiogroup"`, each tile `role="radio"` + `aria-checked`.

### Cinema atmosphere

- Segmented control: **Quiet theater** (`arthouse`) / **Multiplex booth** (`multiplex`) — patron-facing labels; values stay `arthouse` \| `multiplex`.
- Changing this control sets `cinemaPresetUserOverride: true`.
- Updates `data-cinema-preset` immediately + persists on Save.

### Save payload

Extend `SettingsForm` `preferences` merge with `appTheme`, `cinemaPreset`, `cinemaPresetUserOverride`.

## Bundled cinema default flow

```
Patron selects new appTheme in Settings
  → setTheme(appTheme)  // class on <html>
  → if !cinemaPresetUserOverride:
        cinemaPreset = APP_THEMES[appTheme].defaultCinemaPreset
        set data-cinema-preset on <html>
        update local state + mark dirty for PATCH
  → else: leave cinemaPreset unchanged
```

| Theme | Default preset | Rationale |
|-------|----------------|-----------|
| Theater | arthouse | Current production default |
| Lobby Light | arthouse | Quieter atmosphere suits daytime reading |
| Noir | multiplex | Heavier booth energy matches noir aesthetic |

## Pro infrastructure (v1)

- Registry includes `tier` on every theme (all `free` today).
- Server validation ready for `tier: "pro"` entries later.
- **No** locked tiles, badges, or checkout CTAs in v1.
- `profile.isPro` already exists on `profile` table — no migration required for gating stub.

## Edge cases

| Case | Behavior |
|------|----------|
| Unknown `appTheme` in DB | Client + server treat as `theater` |
| `NEXT_PUBLIC_CINEMA_PRESET=multiplex` in dev | May seed initial html attribute; client prefs override after hydration |
| Sonner / toast theme | Map `lobby-light` → `light`, others → `dark` |
| Movie detail `.movie-themed` | Independent of shell theme |
| `prefers-reduced-motion` | Unchanged; cinema audio rules unchanged |
| Flash of wrong theme | Use `next-themes` injection script; default `theme-theater` on SSR html |

## Objective (spec-driven)

**Objective:** Patrons can choose among three distinct shell identities that respect Still’s cinematic product direction, with persistence and future Pro extensibility, without regressing Theater as the default look.

**Tech stack:** Next.js 16 App Router, React 19, `next-themes@0.4.x`, Tailwind v4 (`packages/ui` globals), Better Auth session, profile `preferences` JSONB, Drizzle `profile.isPro`.

## Commands

```bash
# Dev (from repo root)
bun run dev:web          # http://localhost:3001
bun run dev:server       # API for profile PATCH

# Verify
bun run build            # turbo — web + server
cd apps/web && bun test  # unit tests (add app-themes.test.ts)
cd apps/server && bun test  # if server validation tests added

# After code changes (workspace rule)
graphify update .
```

## Project structure

| Path | Role |
|------|------|
| `packages/ui/src/styles/globals.css` | Theme class token blocks |
| `apps/web/src/lib/app-themes.ts` | Registry + helpers (`isAppThemeId`, `resolveAppTheme`) |
| `apps/web/src/lib/profile-preferences.ts` | Pref keys + readers |
| `apps/web/src/lib/app-themes.test.ts` | Registry + resolution tests |
| `apps/web/src/components/app/app-theme-shell.tsx` | Hydration + cinema `dataset` sync |
| `apps/web/src/components/profile/me-appearance-settings.tsx` | Settings tiles + atmosphere control |
| `apps/web/src/components/profile/settings-form.tsx` | Wire prefs into PATCH |
| `apps/web/src/components/providers.tsx` | ThemeProvider config |
| `apps/web/src/app/layout.tsx` | Remove hard-coded `dark` |
| `apps/server/src/lib/app-themes.ts` | Server-side id + tier validation |
| `apps/server/src/routes/profiles.ts` | Enforce on preferences merge |

## Code style

- Named exports; `interface` for public shapes; `as const` maps over enums.
- Comments only for non-obvious business rules (override flag, Pro tier).
- Import `motion/react` not `framer-motion` if any motion added to picker (optional; static tiles OK for v1).

```ts
export function resolveAppTheme(raw: unknown): AppThemeId {
  if (typeof raw === "string" && raw in APP_THEMES) return raw as AppThemeId;
  return "theater";
}
```

## Testing strategy

| Level | What |
|-------|------|
| Unit | `resolveAppTheme`, bundled default helper, guest merge helper |
| Unit (server) | PATCH rejects unknown `appTheme` / invalid `cinemaPreset`; pro tier rejection when a pro theme is added to registry in tests |
| Manual QA | Matrix: each theme on `/home`, `/me/settings`, movie detail (per-film accent), reload, sign-in merge, system OS preference |
| Visual | Lobby Light WCAG AA spot-check on body text + chip contrast |

## Boundaries

**Always:**

- Keep Theater visually equivalent to current production default.
- Use semantic surface tokens in new UI; avoid new gratuitous `dark:` utilities.
- Validate theme ids on server PATCH.
- `disableTransitionOnChange` on theme provider.

**Ask first:**

- Adding a fourth theme or `packages/shared` extraction for registry.
- Changing global `@custom-variant dark` definition.
- Avatar-menu theme shortcut (product reversal).

**Never:**

- Purple/neon “AI” accent palettes (design-taste / AGENTS direction).
- Commit secrets; force-push.
- Block movie detail per-film theming behind shell theme.

## Success criteria

1. **Theater** matches current dark Aker shell within normal QA tolerance.
2. **Lobby Light** is a credible true-light shell (readable body text, chips, Settings panels).
3. **Noir** is visibly distinct from Theater (cooler neutrals + muted accent).
4. Theme + cinema preset persist for signed-in users; guests survive reload via `localStorage`.
5. Theme switch applies bundled cinema preset only when `cinemaPresetUserOverride` is false.
6. Server rejects unknown theme ids; pro-tier check is implemented but inactive (all free).
7. Appearance controls live only under `/me/settings`.
8. `bun run build` passes; new unit tests pass.

## Open questions

_None — locked in brainstorm 2026-05-22._

## References

- `apps/web/src/components/providers.tsx`
- `apps/web/src/app/layout.tsx`
- `packages/ui/src/styles/globals.css`
- `packages/db/src/schema/profile.ts` (`preferences`, `isPro`)
- `apps/web/src/lib/profile-preferences.ts`
- `apps/server/src/routes/profiles.ts`
- `design.md` (Mobbin achromatic specimen — reference for Lobby Light contrast targets)
