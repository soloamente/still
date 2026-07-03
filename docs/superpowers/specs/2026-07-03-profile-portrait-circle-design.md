# Profile portrait circle parity (settings + onboarding + crop)

**Status:** Approved (brainstorm 2026-07-03)  
**Date:** 2026-07-03  
**Topic:** Settings and onboarding profile-photo previews must match the live profile hero — circular portrait, 1:1 crop  
**Supersedes (avatar aspect only):** `2026-06-27-profile-image-crop-design.md` § avatar **2:3** → **1:1**  
**Related:** `profile-media-customizer.tsx` · `profile-patron-header.tsx` · `onboarding-preview-panel.tsx` · `crop-image.ts` · `2026-06-10-animated-profile-media-design.md`

## Problem

On **Settings → Profile**, `ProfileMediaCustomizer` renders the patron portrait as a **2:3 poster tile** (`aspect-[2/3]`, `rounded-2xl`). Onboarding preview uses the same shell. The **public profile hero** renders the same asset as a **circle** (`size-28 sm:size-32`, `rounded-full`, `object-cover`).

The avatar crop dialog is locked to **2:3** (from the 2026-06-27 crop spec), so patrons frame a poster crop but see a circle on profile — WYSIWYG is broken in both directions.

## Goal

Patrons see **one shape everywhere the product means “your profile photo”** before and after save:

1. **Settings** customizer preview — circle  
2. **Onboarding** wizard preview — circle  
3. **Crop dialog** — **1:1** square frame (maps 1:1 to the circle via `object-cover`)  
4. **Profile hero** — unchanged (already circular)

Banner crop and display stay **3:1**.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Preview shape | **Circle** (`rounded-full` on square box) |
| Crop aspect | **1:1** (was 2:3) |
| Crop max output | **800×800** WebP (was 800×1200) |
| Scope | Settings customizer + onboarding preview + profile loading skeleton + shared tokens |
| GIF uploads | **Unchanged** — Pro animated GIFs bypass cropper; display in circle with `object-cover` |
| Existing blobs | **No migration** — legacy 2:3 uploads keep working; re-pick + re-crop uses 1:1 |
| Shared tokens | New `profile-portrait-shell.ts` — single source for shell classes + crop constants |
| Out of scope | Review composer, quick log, person detail poster slots (listing art, not patron PFP) |

## Shared tokens

**New file:** `apps/web/src/lib/profile-portrait-shell.ts`

| Export | Purpose |
|--------|---------|
| `PROFILE_PORTRAIT_SIZE_CLASSNAME` | `size-28 sm:size-32` — matches `ProfilePatronHeader` |
| `PROFILE_PORTRAIT_SHELL_CLASSNAME` | Size + `rounded-full overflow-hidden` + ring/shadow tokens for settings/onboarding context |
| `PROFILE_PORTRAIT_EMPTY_SHELL_CLASSNAME` | Empty state: `bg-card` raised tile (AGENTS.md settings empty state) |
| `PROFILE_AVATAR_CROP_ASPECT` | `1` |
| `PROFILE_AVATAR_CROP_MAX_PX` | `{ width: 800, height: 800 }` |

Settings/onboarding use the shared shell; profile hero may continue using local constants until a later dedupe — **sizes must match** `size-28 sm:size-32`.

## UI behavior

### Settings (`ProfileMediaCustomizer`)

- Portrait trigger: **square circle** using shared shell classes (replace `aspect-[2/3] rounded-2xl`).
- **Empty state:** persistent Upload icon + **Add photo** label on `bg-card` — not hover-only Edit (unchanged copy pattern, circular shell).
- **Has photo:** `object-cover` fill; hover **Edit** scrim on pointer devices (unchanged).
- `AVATAR_ASPECT` reads from `PROFILE_AVATAR_CROP_ASPECT`; `cropImageToFile` uses `PROFILE_AVATAR_CROP_MAX_PX`.

### Onboarding (`onboarding-preview-panel.tsx`)

- `PreviewPortrait` shell uses the same shared classes so the wizard matches settings + live profile.

### Profile loading (`profile/[handle]/loading.tsx`)

- Portrait skeleton: `size-28 sm:size-32 rounded-full` (remove `aspect-[2/3] rounded-2xl` flash).

## Crop flow (unchanged mechanics, new aspect)

```
pick avatar file
  ├─ animated GIF? ──► stage raw (Pro animated media — unchanged)
  └─ otherwise ─────► ImageCropDialog aspect 1:1
                        pan + zoom → Confirm
                        ──► cropImageToFile (max 800×800) → stage pendingAvatar
                            Save → existing POST /api/profiles/me/avatar
```

Banner path unchanged (3:1, max 1600×533).

## Files to change

| File | Change |
|------|--------|
| `apps/web/src/lib/profile-portrait-shell.ts` | **Create** — shared shell + crop constants |
| `apps/web/src/components/profile/profile-media-customizer.tsx` | Circle shell, import shared crop constants |
| `apps/web/src/components/onboarding/onboarding-preview-panel.tsx` | `PreviewPortrait` uses shared shell |
| `apps/web/src/app/(app)/profile/[handle]/loading.tsx` | Circular portrait skeleton |
| `apps/web/src/lib/crop-image.test.ts` | Update fixtures to 800×800 avatar cap |
| `apps/web/src/components/profile/image-crop-dialog.tsx` | JSDoc: avatar aspect is 1:1 |

**No server, API, or DB changes.**

## Edge cases

- **Legacy 2:3 avatar on CDN:** displays fine in circle via `object-cover` until patron re-crops.
- **GIF (Pro):** skip crop; circle clip may crop edges of non-square GIF — acceptable (same as today with poster slot).
- **Very small source images:** `react-easy-crop` clamp behavior unchanged.

## Testing

### Unit

- `crop-image.test.ts`: `computeOutputSize` with 800×800 max; square crop preserves 1:1 output.

### Manual QA

1. Settings → pick photo → crop dialog is **square** → preview is **circle** → Save → profile hero matches framing.
2. Settings empty state: circular **Add photo** tile on `bg-card`.
3. Onboarding avatar step preview matches settings circle.
4. Pro GIF avatar: no crop dialog; animates in circle on profile.
5. Profile route loading skeleton is circular, not poster.

## Non-goals (v1)

- Circular mask overlay inside `ImageCropDialog` (square frame is sufficient).
- Refactoring `ProfilePatronHeader` to import shell tokens (optional follow-up).
- Re-cropping or migrating existing patron avatars server-side.
