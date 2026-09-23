/**
 * Optional per-category diary ratings (stored as tenths 0–100).
 * Skipped categories are omitted from the map — never persisted as zero.
 */

export const LOG_CATEGORY_KEYS = [
	"plot",
	"characters",
	"writing",
	"acting",
	"visuals",
	"sound",
	"enjoyment",
] as const;

export type LogCategoryKey = (typeof LOG_CATEGORY_KEYS)[number];

/** Tenths 0–100; omit skipped keys. */
export type LogCategoryRatings = Partial<Record<LogCategoryKey, number>>;

const LOG_CATEGORY_KEY_SET = new Set<string>(LOG_CATEGORY_KEYS);

function isValidCategoryTenth(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= 100
	);
}

/** Parse JSON/unknown into a sanitized category map (known keys, integer tenths only). */
export function parseLogCategoryRatings(raw: unknown): LogCategoryRatings {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}

	const out: LogCategoryRatings = {};
	for (const [key, value] of Object.entries(raw)) {
		if (!LOG_CATEGORY_KEY_SET.has(key)) continue;
		if (!isValidCategoryTenth(value)) continue;
		out[key as LogCategoryKey] = value;
	}
	return out;
}

/**
 * Suggested overall score on display scale 0–10: mean of rated categories only.
 * Returns null when no categories are present.
 */
export function suggestedOverallFromCategories(
	ratings: LogCategoryRatings,
): number | null {
	const values = LOG_CATEGORY_KEYS.map((key) => ratings[key]).filter(
		(v): v is number => v !== undefined,
	);
	if (values.length === 0) return null;

	const displaySum = values.reduce((sum, tenths) => sum + tenths / 10, 0);
	return displaySum / values.length;
}

/** `PATCH` body shape: a number sets the key, `null` clears it, omitted keys are untouched. */
export type LogCategoryRatingsPatch = Partial<
	Record<LogCategoryKey, number | null>
>;

/**
 * Merge a category patch onto the stored map. Unknown keys / invalid values in the
 * patch are ignored. Returns `null` when nothing is left so the column stays empty.
 */
export function mergeCategoryRatings(
	prev: unknown,
	patch: LogCategoryRatingsPatch | Record<string, unknown>,
): LogCategoryRatings | null {
	const next = parseLogCategoryRatings(prev);
	for (const [key, value] of Object.entries(patch)) {
		if (!LOG_CATEGORY_KEY_SET.has(key)) continue;
		if (value === null) {
			delete next[key as LogCategoryKey];
		} else if (isValidCategoryTenth(value)) {
			next[key as LogCategoryKey] = value;
		}
	}
	return Object.keys(next).length > 0 ? next : null;
}
