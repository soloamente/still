# Profile Image Crop (banner + avatar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons pan + zoom to frame their banner/avatar inside a locked-ratio crop frame on upload, then upload the cropped result.

**Architecture:** Frontend-only. A `react-easy-crop` dialog (locked aspect — 3:1 banner, 2:3 avatar) lets the patron pan/zoom; on confirm a canvas utility renders the crop to a WebP `File` that is staged into the *existing* upload flow (`pendingBanner`/`pendingAvatar`). No server or DB changes. Animated GIFs bypass the cropper (canvas would flatten them) and upload raw, as today.

**Tech Stack:** React 19, Next.js, `react-easy-crop`, Canvas 2D, `motion/react` (existing dialog shell pattern), Bun test.

---

## File Structure

- **Create** `apps/web/src/lib/crop-image.ts` — `computeOutputSize` (pure, tested) + `cropImageToFile` (canvas crop → WebP `File`).
- **Create** `apps/web/src/lib/crop-image.test.ts` — unit tests for `computeOutputSize`.
- **Create** `apps/web/src/components/profile/image-crop-dialog.tsx` — the crop modal (react-easy-crop + zoom slider + Cancel/Confirm), built on the app's portal+motion dialog shell.
- **Modify** `apps/web/src/components/profile/profile-media-customizer.tsx` — `onPick…File` handlers open the dialog (or bypass for GIFs); dialog confirm crops + stages.
- **Modify** `apps/web/package.json` — add `react-easy-crop`.

---

### Task 1: Add the `react-easy-crop` dependency

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the dependency.** In `apps/web/package.json`, add to `dependencies` (keep rough alphabetical order):

```json
"react-easy-crop": "^5.4.1",
```

- [ ] **Step 2: Install**

Run: `bun install`
Expected: resolves `react-easy-crop`, exit 0.

- [ ] **Step 3: Verify the import resolves**

Run: `bun -e "import('react-easy-crop').then(m => console.log(typeof m.default))"`
Expected: prints `function`

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore(web): add react-easy-crop for profile image cropping"
```

---

### Task 2: `crop-image` utility (TDD the math)

**Files:**
- Create: `apps/web/src/lib/crop-image.ts`
- Test: `apps/web/src/lib/crop-image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/crop-image.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { computeOutputSize } from "./crop-image";

describe("computeOutputSize", () => {
	test("returns the crop size unchanged when it fits within max", () => {
		expect(
			computeOutputSize({ width: 800, height: 1200 }, { width: 800, height: 1200 }),
		).toEqual({ width: 800, height: 1200 });
	});

	test("downscales preserving aspect when the crop exceeds max", () => {
		// 3000x1000 (3:1) crop into a 1600x533 cap → scale 1600/3000.
		const out = computeOutputSize(
			{ width: 3000, height: 1000 },
			{ width: 1600, height: 533 },
		);
		expect(out.width).toBe(1600);
		expect(out.height).toBe(533); // 1000 * (1600/3000) = 533.33 → 533
	});

	test("never upscales (scale capped at 1)", () => {
		expect(
			computeOutputSize({ width: 100, height: 150 }, { width: 800, height: 1200 }),
		).toEqual({ width: 100, height: 150 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/crop-image.test.ts`
Expected: FAIL — `Cannot find module './crop-image'`

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/crop-image.ts`:

```ts
/** Pixel rectangle in the *source* image (what react-easy-crop returns as `croppedAreaPixels`). */
export type CropAreaPixels = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Size = { width: number; height: number };

/**
 * Output canvas size: the crop rectangle downscaled to fit within `max`,
 * preserving aspect ratio. Never upscales (scale capped at 1).
 */
export function computeOutputSize(crop: Size, max: Size): Size {
	const scale = Math.min(1, max.width / crop.width, max.height / crop.height);
	return {
		width: Math.round(crop.width * scale),
		height: Math.round(crop.height * scale),
	};
}

/** Load an <img> from an object URL (or any src). Rejects on decode error. */
function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Image decode failed"));
		img.src = src;
	});
}

/**
 * Render `area` of the source image to an offscreen canvas (downscaled to
 * `maxWidth`×`maxHeight`) and return it as a WebP `File`. Throws if the canvas
 * can't be created or encoded.
 */
export async function cropImageToFile(
	src: string,
	area: CropAreaPixels,
	opts: {
		maxWidth: number;
		maxHeight: number;
		fileName: string;
		quality?: number;
	},
): Promise<File> {
	const img = await loadImage(src);
	const out = computeOutputSize(
		{ width: area.width, height: area.height },
		{ width: opts.maxWidth, height: opts.maxHeight },
	);

	const canvas = document.createElement("canvas");
	canvas.width = out.width;
	canvas.height = out.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas not supported");
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(
		img,
		area.x,
		area.y,
		area.width,
		area.height,
		0,
		0,
		out.width,
		out.height,
	);

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, "image/webp", opts.quality ?? 0.9);
	});
	if (!blob) throw new Error("Couldn't process image");

	return new File([blob], opts.fileName, { type: "image/webp" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/crop-image.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/crop-image.ts apps/web/src/lib/crop-image.test.ts
git commit -m "feat(web): add crop-image canvas utility for profile media"
```

---

### Task 3: `ImageCropDialog` component

**Files:**
- Create: `apps/web/src/components/profile/image-crop-dialog.tsx`

Context: matches the app's hand-rolled dialog shell (portal + `motion/react` + overlay/panel + Escape + body-overflow lock) used by `me-destructive-confirm-dialog.tsx`. `react-easy-crop`'s `<Cropper>` fills a `position: relative` parent, so the crop surface is a sized relative box.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/profile/image-crop-dialog.tsx`:

```tsx
"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const OVERLAY_CLASS =
	"fixed inset-0 z-[250] grid min-h-[100dvh] place-items-center overflow-y-auto overscroll-contain bg-absolute-black/78 px-4 py-8 backdrop-blur-sm";

export function ImageCropDialog({
	open,
	src,
	aspect,
	title,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	/** Object URL of the picked file. */
	src: string | null;
	/** Locked crop aspect (width / height): banner 3, avatar 2/3. */
	aspect: number;
	title: string;
	onCancel: () => void;
	/** Crop rectangle in source pixels. */
	onConfirm: (areaPixels: Area) => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const [mounted, setMounted] = useState(false);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [areaPixels, setAreaPixels] = useState<Area | null>(null);

	useEffect(() => setMounted(true), []);

	// Reset transform each time a new image opens.
	useEffect(() => {
		if (open) {
			setCrop({ x: 0, y: 0 });
			setZoom(1);
			setAreaPixels(null);
		}
	}, [open, src]);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	const handleKey = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		},
		[onCancel],
	);
	useEffect(() => {
		if (!open) return;
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [open, handleKey]);

	if (!mounted) return null;

	const portal = (
		<AnimatePresence>
			{open && src ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
					aria-hidden
					className={OVERLAY_CLASS}
					onClick={onCancel}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: PANEL_EASE }}
						onClick={(e) => e.stopPropagation()}
						className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<div className="flex items-center justify-between px-6 pt-5 pb-3 sm:px-7">
							<h2 id={titleId} className="font-semibold text-foreground text-lg tracking-tight">
								{title}
							</h2>
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onCancel}
								aria-label="Cancel"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						{/* Crop surface — react-easy-crop fills this relative box. */}
						<div className="relative mx-6 h-72 overflow-hidden rounded-2xl bg-background sm:mx-7 sm:h-80">
							<Cropper
								image={src}
								crop={crop}
								zoom={zoom}
								aspect={aspect}
								minZoom={1}
								maxZoom={4}
								restrictPosition
								onCropChange={setCrop}
								onZoomChange={setZoom}
								onCropComplete={(_area, areaPx) => setAreaPixels(areaPx)}
							/>
						</div>

						<div className="px-6 pt-5 sm:px-7">
							<label className="flex items-center gap-3 text-muted-foreground text-xs">
								Zoom
								<input
									type="range"
									min={1}
									max={4}
									step={0.01}
									value={zoom}
									onChange={(e) => setZoom(Number(e.target.value))}
									className="h-1 flex-1 cursor-pointer accent-foreground"
									aria-label="Zoom"
								/>
							</label>
						</div>

						<div className="flex flex-col-reverse gap-2 px-6 pt-6 pb-6 sm:flex-row sm:justify-end sm:gap-3 sm:px-7">
							<Button
								type="button"
								variant="ghost"
								size="pill"
								onClick={onCancel}
								className={cn(
									"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 sm:w-auto sm:min-w-32",
								)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="default"
								size="pill"
								disabled={!areaPixels}
								onClick={() => areaPixels && onConfirm(areaPixels)}
								className="h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background sm:w-auto sm:min-w-32"
							>
								Apply
							</Button>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep "image-crop-dialog"`
Expected: no output. (If `react-easy-crop` exports `Area` differently, import the cropped-area type it provides — check `node_modules/react-easy-crop/index.d.ts`; the component is typed `onCropComplete: (croppedArea, croppedAreaPixels) => void`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/image-crop-dialog.tsx
git commit -m "feat(web): add ImageCropDialog (pan + zoom, locked aspect)"
```

---

### Task 4: Wire the dialog into the media customizer

**Files:**
- Modify: `apps/web/src/components/profile/profile-media-customizer.tsx`

Context: the current `onPickBannerFile`/`onPickAvatarFile` (around lines 76–102) size-check then stage the raw file via `setPendingBanner`/`setPendingAvatar`. Change them to open the crop dialog; on confirm, crop then stage. Animated content: treat any `image/gif` as bypass (preserves animation; avoids client-side GIF frame parsing).

- [ ] **Step 1: Add imports.** At the top of the file, add:

```ts
import { ImageCropDialog } from "@/components/profile/image-crop-dialog";
import { cropImageToFile } from "@/lib/crop-image";
```

- [ ] **Step 2: Add crop-dialog state + constants.** Inside the component, near the other `useState` calls (after `const avatarFileRef = useRef…`), add:

```ts
	// Locked crop aspects (width / height) — must match the display slots.
	const BANNER_ASPECT = 3 / 1;
	const AVATAR_ASPECT = 2 / 3;

	const [cropState, setCropState] = useState<{
		src: string;
		target: "banner" | "avatar";
	} | null>(null);
```

- [ ] **Step 3: Replace the two pick handlers.** Replace the existing `onPickBannerFile` and `onPickAvatarFile` `useCallback`s with:

```ts
	const onPickBannerFile = useCallback(
		(file: File) => {
			try {
				assertProfileMediaUploadSize(file);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "File too large");
				return;
			}
			// GIFs upload raw to preserve animation (canvas crop would flatten them).
			if (file.type === "image/gif") {
				setPendingBanner({ file, previewUrl: URL.createObjectURL(file) });
				return;
			}
			setCropState({ src: URL.createObjectURL(file), target: "banner" });
		},
		[setPendingBanner],
	);

	const onPickAvatarFile = useCallback(
		(file: File) => {
			try {
				assertProfileMediaUploadSize(file);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "File too large");
				return;
			}
			if (file.type === "image/gif") {
				setPendingAvatar({ file, previewUrl: URL.createObjectURL(file) });
				return;
			}
			setCropState({ src: URL.createObjectURL(file), target: "avatar" });
		},
		[setPendingAvatar],
	);
```

- [ ] **Step 4: Add the confirm + cancel handlers.** Add these `useCallback`s after the pick handlers:

```ts
	const closeCrop = useCallback(() => {
		setCropState((prev) => {
			if (prev) URL.revokeObjectURL(prev.src);
			return null;
		});
	}, []);

	const onCropConfirm = useCallback(
		async (areaPixels: { x: number; y: number; width: number; height: number }) => {
			if (!cropState) return;
			const isBanner = cropState.target === "banner";
			try {
				const cropped = await cropImageToFile(cropState.src, areaPixels, {
					maxWidth: isBanner ? 1600 : 800,
					maxHeight: isBanner ? 533 : 1200,
					fileName: isBanner ? "banner.webp" : "avatar.webp",
					quality: 0.9,
				});
				assertProfileMediaUploadSize(cropped);
				const previewUrl = URL.createObjectURL(cropped);
				if (isBanner) {
					setPendingBanner({ file: cropped, previewUrl });
				} else {
					setPendingAvatar({ file: cropped, previewUrl });
				}
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Couldn't process image",
				);
			} finally {
				closeCrop();
			}
		},
		[cropState, setPendingBanner, setPendingAvatar, closeCrop],
	);
```

- [ ] **Step 5: Render the dialog.** Just before the closing `</header>` (after the two `<input>` file elements), add:

```tsx
			<ImageCropDialog
				open={cropState !== null}
				src={cropState?.src ?? null}
				aspect={cropState?.target === "banner" ? BANNER_ASPECT : AVATAR_ASPECT}
				title={cropState?.target === "banner" ? "Position your banner" : "Position your photo"}
				onCancel={closeCrop}
				onConfirm={onCropConfirm}
			/>
```

- [ ] **Step 6: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep "profile-media-customizer"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/profile/profile-media-customizer.tsx
git commit -m "feat(web): crop banner/avatar on upload (pan + zoom, GIFs bypass)"
```

---

### Task 5: Verification

**Files:** none (verification only).

- [ ] **Step 1: Unit tests pass**

Run: `bun test apps/web/src/lib/crop-image.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 2: Web typecheck — no new errors in touched files**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep -E "crop-image|image-crop-dialog|profile-media-customizer"`
Expected: no output.

- [ ] **Step 3: Build smoke (catches client/SSR boundary issues)**

Run: `bun run --filter web build` (or the repo's web build script)
Expected: build succeeds; `react-easy-crop` (a client component, used only under `"use client"`) does not trip SSR.

- [ ] **Step 4: Manual QA (after deploy to a preview or local dev)**

  - Banner: pick a wide photo → dialog opens at 3:1 → pan + zoom → **Apply** → preview shows the framed crop → Save → banner displays the crop.
  - Avatar: same at 2:3.
  - Animated GIF (Pro account): pick a `.gif` → **no dialog**, stages directly, uploads animated.
  - Cancel in the dialog → nothing staged; re-picking the same file re-opens the dialog (the `<input>` value is cleared on change).
  - Oversized result → size toast, nothing staged.

---

## Self-Review

- **Spec coverage:** pan+zoom locked-aspect dialog (Task 3), client-side bake to WebP via canvas (Task 2), wired into existing staging with GIF bypass (Task 4), `react-easy-crop` (Task 1), size re-check on the cropped blob (Task 4 Step 4), verification incl. build + manual QA (Task 5). Out-of-scope items (re-editable storage, rotation, server changes) are not implemented. ✅
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `CropAreaPixels`/`Area` shape `{x,y,width,height}` is consistent across `crop-image.ts`, the dialog's `onConfirm`, and `onCropConfirm`. `cropImageToFile(src, area, { maxWidth, maxHeight, fileName, quality })` signature matches its call site. `computeOutputSize(crop, max)` matches its test and its use inside `cropImageToFile`.
- **Note for the implementer:** if `react-easy-crop`'s exported area type isn't named `Area`, use the type from its `onCropComplete` signature (Task 3 Step 2 note). The `image/gif` bypass intentionally covers *all* GIFs (static included) to avoid client-side animation detection — acceptable and simpler.
