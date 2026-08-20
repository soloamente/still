/** Taste hero still rotation — slower hold + soft blur cross-fade when no trailer plays. */

/** Visible hold before the next still cross-fades in. */
export const HOME_TASTE_HERO_STILLS_INTERVAL_MS = 3_000;

/** Cross-fade length — shorter than the hold so each frame reads before it dissolves. */
export const HOME_TASTE_HERO_STILLS_CROSSFADE_MS = 2_500;

/** Outgoing slide blur during cross-fade (incoming resolves to 0). */
export const HOME_TASTE_HERO_STILLS_CROSSFADE_BLUR_PX = 6;

export const HOME_TASTE_HERO_STILLS_CROSSFADE_EASE =
	"cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Merge TMDb backdrop stills with the spotlight fallback — deduped, stable order
 * (fallback first when present so something paints immediately).
 */
export function buildTasteHeroStillSlideUrls(
	screenshotSrcs: readonly string[],
	fallbackBackdropUrl: string | null,
): string[] {
	const seen = new Set<string>();
	const urls: string[] = [];

	if (fallbackBackdropUrl?.trim()) {
		const trimmed = fallbackBackdropUrl.trim();
		seen.add(trimmed);
		urls.push(trimmed);
	}

	for (const src of screenshotSrcs) {
		const trimmed = src.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		urls.push(trimmed);
	}

	return urls;
}
