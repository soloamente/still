# Animated profile media + portrait color preference

**Status:** Approved (2026-06-10)  
**Date:** 2026-06-10  
**Topic:** Pro patrons upload animated GIF banner and portrait (Discord Nitro parity); patron-controlled grayscale-until-hover on profile hero portrait  
**Approach:** Upload-gate + URL inference (Approach 1), with lightweight `preferences` flags set at upload time  
**Related:** `apps/server/src/routes/profiles.ts` · `apps/web/src/components/profile/profile-media-customizer.tsx` · `apps/web/src/components/profile/profile-patron-header.tsx` · `apps/web/src/components/profile/patron-portrait-avatar.tsx` · `apps/web/src/components/profile/me-profile-expression-settings.tsx` · `apps/web/src/lib/profile-preferences.ts`

## Summary

**Sense Pro** patrons can upload **animated GIF** files for **profile banner** and **portrait**, similar to Discord Nitro. GIFs **loop everywhere** the portrait appears (nav, feed, leaderboards, profile hero, etc.). Non-Pro patrons keep today’s static-only uploads; GIF attempts return a clear Pro-required error.

Patrons also get a **Settings** toggle for **grayscale portrait until hover** on the **public profile hero** (default **on**, matching current behavior). When off, the profile hero portrait is always full color. Animated GIFs use a **CSS grayscale filter** while looping (not pause-until-hover). Small avatar surfaces (nav, feed) show GIFs in **full color** without grayscale.

`prefers-reduced-motion` shows the **first frame only** (no loop) for banner and portrait GIFs.

## Problem

| Symptom | Root cause |
|---------|------------|
| Profile media is static-only in practice | Upload + display assume still images; no GIF loop rendering |
| Portrait grayscale is hardcoded | `ProfilePatronHeader` always applies `grayscale` + hover reveal |
| No Pro differentiation for expressive media | Pro unlocks accent/frame but not animated identity |

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Animation format | **Animated GIF** for banner and portrait (Discord-style) |
| Pro gate | **Pro only** — non-Pro GIF uploads rejected |
| Portrait animation scope | **Everywhere** `PatronPortraitAvatar` is used |
| Banner animation scope | Profile header + settings preview only (banner is not shown in feed/nav today) |
| Portrait color (profile hero) | **Patron toggle** in Settings; default **grayscale until hover** |
| GIF + grayscale (default mode) | **CSS filter only** — GIF keeps looping under `grayscale`; hover removes filter |
| Grayscale on small avatars | **Off** — feed/nav/leaderboard GIFs always full color |
| OG / share previews | Unchanged — static OG routes; no animated GIF in share cards |
| Implementation approach | **Approach 1** — upload gate + inference; set explicit flags on upload (no derivatives) |

## Data model

### Preferences (jsonb on `profile.preferences`)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `profilePortraitGrayscaleUntilHover` | `boolean` | `true` (absent = on) | Profile hero portrait only |
| `avatarIsAnimated` | `boolean` | `false` | Set `true` when last avatar upload is GIF; cleared on non-GIF replace |
| `bannerIsAnimated` | `boolean` | `false` | Set `true` when last banner upload is GIF; cleared on non-GIF replace |

Web constants in `apps/web/src/lib/profile-preferences.ts`:

- `PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER`
- `PROFILE_PREF_AVATAR_IS_ANIMATED`
- `PROFILE_PREF_BANNER_IS_ANIMATED`

Server sanitization in `apps/server/src/lib/sanitize-appearance-preferences.ts` (or dedicated profile-media sanitizer): coerce booleans; strip unknown keys unchanged.

**No new SQL columns.** Existing `user.image` and `profile.bannerUrl` blob URLs remain the source of truth for bytes.

### Inferring animation without flags (fallback)

Blob keys embed the original filename: `avatars/{userId}/{timestamp}-{filename}`. If flags are missing on legacy rows, treat URL/path ending in `.gif` (case-insensitive) as animated. Flags are authoritative when present.

## API

### `POST /api/profiles/me/avatar` and `POST /api/profiles/me/banner`

Existing multipart `file` field, 4MB cap, `image/*` validation extended:

| Case | Response |
|------|----------|
| `file.type === 'image/gif'` or `.gif` name + patron **not Pro** | `403` `{ code: "PRO_ANIMATED_MEDIA_REQUIRED", error: "…" }` |
| Valid GIF + Pro | Upload to Blob; update `user.image` or `profile.bannerUrl`; merge `avatarIsAnimated: true` or `bannerIsAnimated: true` into preferences |
| Non-GIF image | Upload as today; set corresponding `*IsAnimated` flag to `false` |

Rate limits unchanged (10/min per slot).

### `PATCH /api/profiles/me`

Accept `preferences.profilePortraitGrayscaleUntilHover: boolean` in the existing shallow-merge preferences object. Available to **all** patrons (not Pro-gated).

### Profile read payloads

`GET /api/profiles/:handle` (and any payload that feeds `PatronPortraitAvatar` with animation) must expose:

- `preferences.profilePortraitGrayscaleUntilHover` (or derived boolean for visitors)
- `preferences.avatarIsAnimated` / `preferences.bannerIsAnimated` **or** top-level convenience fields mirrored from preferences for RSC ergonomics

Feed/list endpoints that include `user.image` should include `avatarIsAnimated` when the row joins profile preferences (or a minimal `{ image, handle, avatarIsAnimated }` shape).

## Web — Settings UI

### Settings → Profile (`ProfileMediaCustomizer`)

- Helper copy under pickers: **Pro patrons can upload animated GIF** for banner and portrait (Discord-style loops).
- Non-Pro: unchanged static upload; if server returns `PRO_ANIMATED_MEDIA_REQUIRED`, toast explains Pro unlock.
- Settings preview: render GIF with `<img>` when pending or committed file is GIF (blob preview already uses `<img>`).

### Settings → Appearance (`MeProfileExpressionSettings`)

New `MePreferenceToggle` (all patrons):

- **Title:** Grayscale portrait until hover  
- **Description:** On your public profile, your portrait stays monochrome until a visitor hovers. Off keeps full color on the profile hero. Does not affect small avatars elsewhere.  
- **Default:** on (`true`)

Place below existing Pro **Profile expression** block (accent / banner frame).

Wire through `settings-form-context.tsx` like `castCrewMonochromeOnHover`.

## Web — Display

### Shared portrait component (`PatronPortraitAvatar`)

New optional props:

```ts
isAnimated?: boolean;
grayscaleUntilHover?: boolean; // only honored when caller opts in (profile hero)
respectReducedMotion?: boolean; // default true
```

Rendering rules:

| `isAnimated` | Element | Notes |
|--------------|---------|-------|
| `false` | Next `Image` `unoptimized` | Current behavior |
| `true` | native `<img>` `unoptimized` | Required for GIF loop in React 19 / Next |

Grayscale classes (profile hero only, when `grayscaleUntilHover === true`):

```
grayscale [@media(hover:hover)]:hover:grayscale-0
```

When `grayscaleUntilHover === false`, omit grayscale classes.

`prefers-reduced-motion: reduce`: render GIF as static (first frame) — use CSS `animation: none` on wrapper and document that GIF decoding may still animate in some browsers; acceptable v1 mitigation is `aria-hidden` decorative + optional future server-side first-frame asset (out of scope).

### Profile hero (`ProfilePatronHeader`)

- Banner: if `bannerIsAnimated`, use `<img>` fill cover inside banner frame; else keep Next `Image`.
- Portrait: pass `isAnimated` + `grayscaleUntilHover` from profile preferences into `PatronPortraitAvatar`.
- Remove hardcoded grayscale from header; delegate to component props.

### Other `PatronPortraitAvatar` call sites (~15)

Pass `isAnimated` from user/profile payload when available; **do not** pass `grayscaleUntilHover` (defaults off). Examples: `nav-user-avatar.tsx`, `feed-person-avatar.tsx`, `home-curator-spotlights.tsx`, leaderboards, review sheets.

### Proxy routes

`GET /api/profiles/avatar/:handle`, `GET /api/profiles/me/avatar`, `GET /api/profiles/banner/:handle` already stream bytes with stored `Content-Type`. Ensure GIF responses keep `Content-Type: image/gif` so browsers loop correctly.

## Server — Pro check

Reuse existing `profile.isPro` on the authenticated user’s profile row inside avatar/banner upload handlers before accepting GIF MIME/extension.

## Error handling

| Scenario | UX |
|----------|-----|
| Non-Pro picks `.gif` | Toast: animated banner/portrait requires Sense Pro |
| File > 4MB | Existing toast |
| Blob misconfigured | Existing 503 |
| Pro downgrades with GIF on file | GIF remains stored and animates until patron replaces with still image (no automatic strip in v1) |

## Testing

### Server (`profiles.test.ts` or new media tests)

- Pro + GIF → 200, `avatarIsAnimated: true` in preferences
- Non-Pro + GIF → 403 `PRO_ANIMATED_MEDIA_REQUIRED`
- Pro + PNG → 200, `avatarIsAnimated: false`
- PATCH `profilePortraitGrayscaleUntilHover: false` persists

### Web (manual / component)

- Profile hero: toggle on → grayscale + hover color on still and GIF
- Profile hero: toggle off → always color
- Nav avatar: GIF loops, no grayscale
- `prefers-reduced-motion` → no perceived loop (best-effort CSS)
- Settings preview shows GIF loop for Pro pending upload

## Out of scope (v1)

- WebP animated, MP4/WebM video banners
- Server-generated static thumbnails for feed
- Automatic GIF → still conversion on Pro lapse
- Grayscale on banner
- Animated GIF in OG/Satori images

## Implementation plan

Invoke **writing-plans** skill after spec review to produce task breakdown (server upload gate → preference keys → `PatronPortraitAvatar` → settings toggles → call-site payload threading → tests).
