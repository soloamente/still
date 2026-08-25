/**
 * Landing hero spiral density — Originkit `imageSize` is CSS px, not a fraction
 * of the canvas. 320px tiles on a ~430px phone band pile on top of each other.
 */

export const LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX = 320;
export const LANDING_HERO_SPIRAL_IMAGE_SIZE_MIN = 40;
/**
 * Desktop hero min-edge the 320px tile was tuned against (ultrawide height).
 * Smaller bands scale tiles from this so coils do not pile up.
 */
export const LANDING_HERO_SPIRAL_IMAGE_SIZE_REFERENCE_PX = 1386;
/**
 * Phone-end mix: even 12% of a square Agentation band still stacked.
 * Mix toward this fraction so 432×427 tiles stay ~11% of min-edge (~48px).
 */
export const LANDING_HERO_SPIRAL_COMPACT_SIZE_FRACTION = 0.06;

export const LANDING_HERO_SPIRAL_SPACING_DESKTOP = 5.4;
export const LANDING_HERO_SPIRAL_SPACING_COMPACT = 11;
export const LANDING_HERO_SPIRAL_TURNS_DESKTOP = 2.7;
export const LANDING_HERO_SPIRAL_TURNS_COMPACT = 1.85;
/** Below this min-edge, bump arc spacing so remaining tiles do not collide. */
export const LANDING_HERO_SPIRAL_COMPACT_MIN_PX = 640;

export interface LandingHeroSpiralLayout {
	imageSize: number;
	spacing: number;
	turns: number;
}

/** Spiral tile size + arc spacing for the hero canvas min edge (CSS px). */
export function landingHeroSpiralLayout(
	minViewportPx: number,
): LandingHeroSpiralLayout {
	const edge = Math.max(0, minViewportPx);
	const desktopFraction =
		LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX /
		LANDING_HERO_SPIRAL_IMAGE_SIZE_REFERENCE_PX;
	const t = Math.min(1, edge / LANDING_HERO_SPIRAL_IMAGE_SIZE_REFERENCE_PX);
	// Tighter than linear on phones; still 320px at the 1386 desktop reference.
	const fraction =
		LANDING_HERO_SPIRAL_COMPACT_SIZE_FRACTION +
		(desktopFraction - LANDING_HERO_SPIRAL_COMPACT_SIZE_FRACTION) * t;
	const imageSize = Math.round(
		Math.min(
			LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX,
			Math.max(LANDING_HERO_SPIRAL_IMAGE_SIZE_MIN, edge * fraction),
		),
	);
	const compact = edge < LANDING_HERO_SPIRAL_COMPACT_MIN_PX;
	return {
		imageSize,
		spacing: compact
			? LANDING_HERO_SPIRAL_SPACING_COMPACT
			: LANDING_HERO_SPIRAL_SPACING_DESKTOP,
		turns: compact
			? LANDING_HERO_SPIRAL_TURNS_COMPACT
			: LANDING_HERO_SPIRAL_TURNS_DESKTOP,
	};
}
