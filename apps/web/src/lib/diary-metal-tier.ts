import type { BorderBeamColorVariant } from "border-beam";

export type DiaryMetalTier = "silver" | "gold" | "chromatic";

/** BorderBeam only applies to circular patron portraits. */
export function isCircularPatronPortraitClass(className?: string): boolean {
	if (!className) return true;
	if (/rounded-2xl|rounded-xl|rounded-lg|rounded-md/.test(className)) {
		return false;
	}
	return /rounded-full/.test(className) || !/rounded-/.test(className);
}

/** Diary volume tier → `border-beam` palette (mirrors silver / gold / chromatic metal presets). */
export function diaryMetalBorderBeamColorVariant(
	tier: DiaryMetalTier,
): BorderBeamColorVariant {
	switch (tier) {
		case "silver":
			return "mono";
		case "gold":
			return "sunset";
		case "chromatic":
			return "colorful";
		default: {
			const _exhaustive: never = tier;
			return _exhaustive;
		}
	}
}

/** Full-strength `border-beam` pulse for every diary metal tier. */
export const DIARY_METAL_BORDER_BEAM_STRENGTH = 1;
