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
