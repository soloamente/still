import { formatLogRatingDisplay } from "@/lib/log-rating";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

/** UTC calendar year param — mirrors server validation. */
export function parseYearInReviewYearParam(raw: string): number | null {
	const year = Number.parseInt(raw, 10);
	if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
	return year;
}

export function formatYearInReviewDecade(decade: number | null): string | null {
	if (decade == null) return null;
	return `${decade}s`;
}

export function formatYearInReviewBusiestMonth(
	month: number | null,
): string | null {
	if (month == null || month < 1 || month > 12) return null;
	return MONTH_NAMES[month - 1] ?? null;
}

export function formatYearInReviewAverageRating(
	value: number | null,
): string | null {
	if (value == null) return null;
	return formatLogRatingDisplay(value);
}
