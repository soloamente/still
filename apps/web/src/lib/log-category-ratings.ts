import { clampLogRatingDisplay } from "@/lib/log-rating";

/**
 * Optional per-category diary ratings — client mirror of
 * `apps/server/src/lib/log-category-ratings.ts` (the server is the source of
 * truth for keys and validation). Values are stored tenths 0–100, like `log.rating`.
 */
export const LOG_CATEGORIES = [
	{ key: "plot", label: "Plot" },
	{ key: "characters", label: "Characters" },
	{ key: "writing", label: "Writing" },
	{ key: "acting", label: "Acting" },
	{ key: "visuals", label: "Visuals" },
	{ key: "sound", label: "Sound" },
	{ key: "enjoyment", label: "Enjoyment" },
] as const;

export type LogCategoryKey = (typeof LOG_CATEGORIES)[number]["key"];

/** Only rated keys; skipped categories are absent (never stored as zero). */
export type LogCategoryRatings = Partial<Record<LogCategoryKey, number>>;

/** `PATCH /api/logs/:id` body: a number sets the key, `null` clears it. */
export type LogCategoryRatingsPatch = Partial<
	Record<LogCategoryKey, number | null>
>;

/** Mean of rated categories on the 0–10 display scale (one decimal), or `null`. */
export function suggestedOverallFromCategories(
	ratings: LogCategoryRatings,
): number | null {
	const values = LOG_CATEGORIES.map(({ key }) => ratings[key]).filter(
		(tenths): tenths is number => tenths !== undefined,
	);
	if (values.length === 0) return null;
	const mean =
		values.reduce((sum, tenths) => sum + tenths / 10, 0) / values.length;
	return clampLogRatingDisplay(mean);
}

export type CategorySuggestionAction =
	| { kind: "none" }
	/** Overall unset — offer the suggestion as the score. */
	| { kind: "offer"; display: number }
	/** Overall already set — keep it, allow an explicit switch. */
	| { kind: "switch"; display: number };

export function categorySuggestionAction(
	overallDisplay: number | null,
	suggestedDisplay: number | null,
): CategorySuggestionAction {
	if (suggestedDisplay == null) return { kind: "none" };
	if (overallDisplay == null)
		return { kind: "offer", display: suggestedDisplay };
	if (clampLogRatingDisplay(overallDisplay) === suggestedDisplay) {
		return { kind: "none" };
	}
	return { kind: "switch", display: suggestedDisplay };
}

export function categoryProgressLabel(index: number): string {
	return `${index + 1} of ${LOG_CATEGORIES.length}`;
}
