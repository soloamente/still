/** Gap between taste-rail cells (`gap-2`). */
export const TASTE_RAIL_GAP_PX = 8;

/** Minimum poster column width before we drop a slot (≈ `w-27`). */
export const TASTE_RAIL_MIN_CELL_PX = 108;

export const TASTE_RAIL_MIN_VISIBLE = 3;

export const TASTE_RAIL_MAX_VISIBLE = 24;

/** How many posters fit on one row without wrapping (pure — unit tested). */
export function tasteRailVisibleCount(containerWidthPx: number): number {
	if (containerWidthPx <= 0) return TASTE_RAIL_MIN_VISIBLE;
	const slots = Math.floor(
		(containerWidthPx + TASTE_RAIL_GAP_PX) /
			(TASTE_RAIL_MIN_CELL_PX + TASTE_RAIL_GAP_PX),
	);
	return Math.min(
		TASTE_RAIL_MAX_VISIBLE,
		Math.max(TASTE_RAIL_MIN_VISIBLE, slots),
	);
}

/** Single flex row — equal-width cells, no second line. */
export const HOME_TASTE_MATCHED_RAIL_TRACK_CLASSNAME =
	"flex w-full flex-nowrap gap-2";

export const HOME_TASTE_MATCHED_RAIL_CELL_CLASSNAME =
	"flex min-w-0 flex-1 basis-0 flex-col";
