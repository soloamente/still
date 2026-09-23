/**
 * Portrait scrim helpers — pick a chromatic dark swatch from a profile photo so
 * the rank overlay fades with the picture, not a flat black plate.
 */

/** Fall back scrim when the portrait has no sampleable color. */
export const SEARCH_DIALOG_PEOPLE_SCRIM_FALLBACK_RGB = "rgb(0, 0, 0)";

/** Perceived luma 0–255 (Rec. 709). */
export function rgbLuminance(r: number, g: number, b: number): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Simple chroma — max−min channel distance; greys score ~0. */
export function rgbChroma(r: number, g: number, b: number): number {
	return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Skip crushed blacks — they dominate studio portraits and read as “just black”. */
export const SEARCH_DIALOG_PEOPLE_DARK_LUMA_MIN = 18;
/** Upper bound for “dark” candidate pixels. */
export const SEARCH_DIALOG_PEOPLE_DARK_LUMA_MAX = 165;
/** Minimum chroma so the scrim carries a visible hue. */
export const SEARCH_DIALOG_PEOPLE_MIN_CHROMA = 28;

/** Bucket size for quantization (0–255 → ~16 buckets per channel). */
const COLOR_BUCKET = 16;

function bucketKey(r: number, g: number, b: number): string {
	const br = Math.min(255, Math.floor(r / COLOR_BUCKET) * COLOR_BUCKET);
	const bg = Math.min(255, Math.floor(g / COLOR_BUCKET) * COLOR_BUCKET);
	const bb = Math.min(255, Math.floor(b / COLOR_BUCKET) * COLOR_BUCKET);
	return `${br},${bg},${bb}`;
}

function parseBucketKey(key: string): { r: number; g: number; b: number } {
	const [r, g, b] = key.split(",").map((part) => Number(part));
	return {
		r: Number.isFinite(r) ? r : 0,
		g: Number.isFinite(g) ? g : 0,
		b: Number.isFinite(b) ? b : 0,
	};
}

function bucketToRgbString(key: string): string {
	const { r, g, b } = parseBucketKey(key);
	// Bias toward the mid of the cell so the scrim is not crushed to the floor.
	const mid = COLOR_BUCKET / 2;
	return `rgb(${Math.min(255, r + mid)}, ${Math.min(255, g + mid)}, ${Math.min(255, b + mid)})`;
}

function pickModeKey(counts: Map<string, number>): string | null {
	let bestKey: string | null = null;
	let bestCount = 0;
	for (const [key, count] of counts) {
		if (count > bestCount) {
			bestCount = count;
			bestKey = key;
		}
	}
	return bestKey;
}

/**
 * Chromatic dark modal from raw RGBA. Prefers hues over near-black greys so the
 * scrim reads as a color. Falls back to the most chromatic mid-dark pixel, then
 * any dark modal — never invents a palette when the buffer is empty.
 */
export function pickMostUsedDarkRgbFromRgba(
	data: ArrayLike<number>,
	opts?: {
		lumaMin?: number;
		lumaMax?: number;
		minChroma?: number;
	},
): string | null {
	if (data.length < 4) return null;

	const lumaMin = opts?.lumaMin ?? SEARCH_DIALOG_PEOPLE_DARK_LUMA_MIN;
	const lumaMax = opts?.lumaMax ?? SEARCH_DIALOG_PEOPLE_DARK_LUMA_MAX;
	const minChroma = opts?.minChroma ?? SEARCH_DIALOG_PEOPLE_MIN_CHROMA;

	const chromaticDarkCounts = new Map<string, number>();
	const midDarkCounts = new Map<string, number>();
	let bestChromaKey: string | null = null;
	let bestChroma = -1;

	for (let i = 0; i < data.length; i += 4) {
		const alpha = data[i + 3] ?? 0;
		if (alpha < 128) continue;
		const r = data[i] ?? 0;
		const g = data[i + 1] ?? 0;
		const b = data[i + 2] ?? 0;
		const luma = rgbLuminance(r, g, b);
		const chroma = rgbChroma(r, g, b);
		const key = bucketKey(r, g, b);

		if (luma >= lumaMin && luma <= lumaMax) {
			midDarkCounts.set(key, (midDarkCounts.get(key) ?? 0) + 1);
			if (chroma >= minChroma) {
				chromaticDarkCounts.set(
					key,
					(chromaticDarkCounts.get(key) ?? 0) + 1,
				);
			}
			if (chroma > bestChroma) {
				bestChroma = chroma;
				bestChromaKey = key;
			}
		}
	}

	const chosen =
		pickModeKey(chromaticDarkCounts) ??
		bestChromaKey ??
		pickModeKey(midDarkCounts);
	if (!chosen) return null;
	return bucketToRgbString(chosen);
}

/**
 * Same-origin Next image optimizer URL so canvas can read TMDb pixels without
 * CORS. Display tiles keep the raw CDN URL (no `crossOrigin`).
 */
export function searchDialogPeopleScrimSampleSrc(remoteUrl: string): string {
	const trimmed = remoteUrl.trim();
	if (!/^https?:\/\//i.test(trimmed)) return trimmed;
	const params = new URLSearchParams({
		url: trimmed,
		w: "96",
		q: "75",
	});
	return `/_next/image?${params.toString()}`;
}

/**
 * Draw a tiny downsample and return the modal dark RGB. Returns null when the
 * canvas is tainted (CORS) or drawing fails.
 */
export function sampleMostUsedDarkRgb(
	source: CanvasImageSource,
	size = 32,
): string | null {
	try {
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(source, 0, 0, size, size);
		const { data } = ctx.getImageData(0, 0, size, size);
		return pickMostUsedDarkRgbFromRgba(data);
	} catch {
		return null;
	}
}

/**
 * Bottom→top fade: opaque portrait color at the base, clear toward the face.
 */
export function searchDialogPeoplePortraitScrimStyle(
	rgb: string | null | undefined,
): { backgroundImage: string } {
	const color = rgb?.trim() || SEARCH_DIALOG_PEOPLE_SCRIM_FALLBACK_RGB;
	return {
		backgroundImage: `linear-gradient(to top, ${color} 0%, ${color} 12%, transparent 100%)`,
	};
}
