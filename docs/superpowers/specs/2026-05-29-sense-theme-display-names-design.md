# Sense — Theme display names (emotion-first)

**Status:** Implemented (Set A labels, 2026-05-29)  
**Parent:** Sense brand (`apps/web/src/lib/app-brand.ts`) — *where your taste feels real*  
**Related:** SN.14 profile themes ([2026-05-29-sense-tier-3-design.md](./2026-05-29-sense-tier-3-design.md))

## Summary

Rename patron-facing **shell palette labels** from cinema/venue vocabulary to **one-word emotions** — the feeling each theme is meant to give while using Sense. **Technical theme ids and CSS classes stay unchanged** (`theme-theater`, `theme-lobby-light`, etc.) so stored `preferences.appTheme` and `next-themes` storage keep working without migration.

## Locked display names (Set A)

| Technical id | CSS class | Tier | Old label | **New label** |
|--------------|-----------|------|-----------|---------------|
| `theme-theater` | `html.theme-theater` | Free | Theater | **Calm** |
| `theme-lobby-light` | `html.theme-lobby-light` | Free | Lobby Light | **Lucid** |
| `theme-noir` | `html.theme-noir` | Free | Noir | **Pensive** |
| `theme-ember` | `html.theme-ember` | Pro | Ember | **Cozy** |
| `theme-midnight` | `html.theme-midnight` | Pro | Midnight | **Dreamy** |

### Patron-facing one-liners (Settings copy — optional in v1)

| Label | Hint (max ~12 words) |
|-------|----------------------|
| **Calm** | Settled dark — default Sense room |
| **Lucid** | Bright and clear for daytime browsing |
| **Pensive** | Cool, inward mood for late scrolls |
| **Cozy** | Warm ember glow (Sense Pro) |
| **Dreamy** | Soft violet night calm (Sense Pro) |

## Design principles

1. **Emotion, not place** — No Theater, Lobby, Dusk, or temperature-only **Cool**.
2. **One word per chip** — Fits account menu rail and Settings grid.
3. **Ids stable** — `APP_THEME_CLASS_*` constants and server `APP_THEME_IDS` unchanged.
4. **Legacy aliases unchanged** — `dark` → theater palette, `light` → lobby-light; only labels change.
5. **Pro tier** — Cozy / Dreamy remain gated by `isPro`; error copy stays “Theme requires Pro”.

## Scope

### In scope

- Update `label` on each entry in `apps/web/src/lib/app-themes.ts` (`APP_THEMES`).
- Update `MENU_THEME_LABEL` in `apps/web/src/components/app/account-menu-theme-picker.tsx` (short chip labels: use same words; **Lucid** may show as **Lucid** — if rail is too tight, allow **Lucid** full word or abbreviate only if layout breaks in QA).
- Update patron-facing copy in `me-appearance-settings.tsx` that references “Theater” as default (e.g. “Theater is the default…” → “**Calm** is the default…”).
- Update comments in `providers.tsx` / `theme-flash-guard-script.tsx` that describe palettes for developers (Theater → Calm palette / `theme-theater`).
- Add or extend `app-themes.test.ts` snapshot of labels if useful (assert `APP_THEMES[class].label === "Calm"` etc.).

### Out of scope

- Renaming CSS classes or stored theme ids.
- DB migration or profile backfill.
- Marketing site / AGENTS.md bulk rename of unrelated “theater” (venue, audio).
- Reordering themes in UI (keep current order: Calm, Lucid, Pensive, Cozy, Dreamy).

## Architecture

```
APP_THEMES[].label  ──►  Settings swatches (MeAppearanceSettings)
                      ──►  Account menu chips (MENU_THEME_LABEL)
Server APP_THEME_IDS  ──►  validation only (no labels)
profile.preferences.appTheme  ──►  still "theme-theater" | ...
```

No API contract change. Eden types unchanged.

## Error handling

- Unchanged: invalid `appTheme` → 400; Pro theme without `isPro` → 403.
- `resolveAppThemeForPatron` still falls back non-Pro users from `theme-ember` / `theme-midnight` to **Calm** palette (`theme-theater`).

## Testing

| Check | How |
|-------|-----|
| Labels in registry | `bun test apps/web/src/lib/app-themes.test.ts` (optional label assertions) |
| Settings UI | Manual: `/me/settings` → Appearance shows Calm · Lucid · Pensive · Cozy · Dreamy |
| Account menu | Manual: `/home` → avatar menu theme chips match |
| Pro gate | Non-Pro: Cozy/Dreamy disabled; save returns 403 |
| Persistence | Pick **Pensive**, reload — still Pensive; stored value still `theme-noir` |

## Success criteria

- All five patron-visible theme names are emotion words from Set A.
- No user-facing “Theater”, “Lobby Light”, “Noir”, “Ember”, or “Midnight” in theme picker surfaces.
- Existing users with saved `theme-noir` (etc.) see new labels with same palette.

## Implementation follow-up

After spec review: create plan at `docs/superpowers/plans/2026-05-29-sense-theme-display-names.md` via writing-plans skill (Executor, labels-only diff).
