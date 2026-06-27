# Profile Image Crop (banner + avatar) — Design

**Status:** Approved direction, pending spec review
**Date:** 2026-06-27

## Context

Profile **banners** display at a fixed **3:1** ratio and **avatars** at **2:3**, both
`object-cover` — whatever the patron uploads is auto-centered and cropped to fit,
with no control over framing. Today's flow (`profile-media-customizer.tsx`):
pick a file → stage it (`pendingAvatar`/`pendingBanner` via `URL.createObjectURL`)
→ the Settings "Save" uploads it to `POST /api/profiles/me/avatar` and
`/api/profiles/me/banner`. No crop library is installed; nothing stores crop data.

## Goal

Let patrons **pan + zoom to frame** their banner/avatar inside a locked-ratio crop
frame on upload, then upload the **cropped result**. Predictable: the crop maps 1:1
to what's displayed.

## Decisions (locked in brainstorming)

- **Controls:** pan (drag) + zoom (slider/pinch).
- **Aspect:** locked to the display slots — **3:1** banner, **2:3** avatar. (Free
  aspect was considered and dropped; the slots are fixed, so a free crop would just
  be re-cropped.)
- **Storage model:** **bake the crop client-side** and upload the final image. To
  re-frame later, the patron re-picks and re-crops. **No server or DB changes** —
  the existing upload endpoints receive the cropped image as-is.
- **Animated GIFs bypass the cropper.** A canvas crop flattens a GIF to a single
  frame, which would break the Pro animated-avatar/banner feature
  (`isAnimatedGifUpload`, `mergeBannerAnimationPref`). If the picked file is an
  animated GIF, skip the dialog and stage it raw (today's behavior).
- **Output:** WebP at a quality setting (smaller than PNG/JPEG), capped at a sensible
  max resolution (banner ~1600×533, avatar ~800×1200) so files stay well under the
  4 MB (avatar) / 5 MB-ish (banner) limits. The cropped blob is re-checked against
  `assertProfileMediaUploadSize` before staging.

## Approach

Use **`react-easy-crop`** (~10 KB, no deps): drag-to-pan, zoom, fixed-aspect frame,
touch + mouse, returns `croppedAreaPixels`. On confirm, a canvas utility renders
that rectangle to a `Blob` → wrapped as a `File` → fed into the existing staging flow.

Rejected alternatives: `react-image-crop` (free-form selection UX, not pan/zoom-in-frame);
hand-rolling pan/zoom/pinch (needless re-implementation).

## Flow

```
pick file
  ├─ animated GIF? ──► stage raw File (unchanged)         (Pro animated media)
  └─ otherwise ─────► open ImageCropDialog (aspect 3:1 | 2:3)
                        pan + zoom → Confirm
                        ──► cropImage(src, areaPixels) → WebP Blob → File
                        ──► assertProfileMediaUploadSize(File)
                        ──► setPendingBanner / setPendingAvatar({ file, previewUrl })
                            (existing Save uploads it; display unchanged)
```

## Components / files (all `apps/web`)

- **Create** `src/components/profile/image-crop-dialog.tsx` — modal built on
  `react-easy-crop`: the crop surface (locked aspect), a zoom slider, Cancel/Confirm.
  Props: `open`, `src` (object URL of the picked file), `aspect`, `onCancel`,
  `onConfirm(croppedAreaPixels, zoom)`. Uses the app's existing dialog primitive for
  consistency.
- **Create** `src/lib/crop-image.ts` — `cropImageToFile(src, areaPixels, opts)`:
  loads the image, draws the crop rect to an offscreen `<canvas>` (downscaled to the
  max output dimensions), `canvas.toBlob('image/webp', quality)`, returns a `File`
  (preserves a sensible name + `.webp`). Pure, unit-testable for the math
  (output dimensions, clamping) with the canvas mocked.
- **Modify** `src/components/profile/profile-media-customizer.tsx` —
  `onPickBannerFile` / `onPickAvatarFile` now: detect animated GIF (reuse the
  client-side check that mirrors `isAnimatedGifUpload`); if so stage raw; else set
  dialog state (`src`, `aspect`, which target) and open the dialog. The dialog's
  `onConfirm` runs `cropImageToFile` then stages the result.
- **Modify** `apps/web/package.json` — add `react-easy-crop`.

## Edge cases

- **Cancel** in the dialog → nothing staged; the file input is reset so re-picking the
  same file fires `change` again.
- **Crop output exceeds size limit** (rare with WebP downscale) → toast the existing
  size error, don't stage.
- **Very small source image** (smaller than the frame at min zoom) → `react-easy-crop`
  clamps; allow it (the upload just won't be hi-res).
- **`canvas.toBlob` returns null** (decode failure) → toast a generic "Couldn't process
  image", don't stage.

## Out of scope

- Re-editing an already-saved image's framing without re-upload (would need
  original + crop-params storage; explicitly not this build).
- Rotation, filters, free aspect, server-side image processing.
- Changing the display slot ratios or where images appear.

## Testing

- **Unit** (`crop-image.test.ts`): output-dimension math — given source size, crop
  area, and max dimensions, the computed canvas size is correct and clamped;
  aspect preserved. (Canvas drawing mocked.)
- **Manual/QA:** pick a wide photo → banner dialog 3:1 → pan/zoom → confirm → Save →
  banner shows the framed crop. Same for avatar 2:3. Animated GIF (Pro) → no dialog,
  uploads animated. Cancel → nothing changes.
