/**
 * Diary score on a **0.0–10.0** scale (one decimal in the log sheet UI).
 *
 * Stored in `log.rating` as integer **tenths** (0–100). Legacy rows with values
 * `1..10` are treated as whole scores on the same 0–10 scale (half-star era).
 */

const TENTHS_MAX = 100;

/** API / DB integer → display score (e.g. `72` → `7.2`, legacy `9` → `9`). */
export function logRatingToDisplay(
	stored: number | null | undefined,
): number | null {
	if (stored == null || !Number.isFinite(stored)) return null;
	if (stored <= 10) return stored;
	return Math.round(stored) / 10;
}

/** UI score → integer tenths for POST/PATCH (e.g. `7.2` → `72`). */
export function logRatingToStored(
	display: number | null | undefined,
): number | null {
	if (display == null || !Number.isFinite(display)) return null;
	const clamped = Math.min(10, Math.max(0, display));
	return Math.round(clamped * 10);
}

export function clampLogRatingDisplay(value: number): number {
	return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

export function formatLogRatingDisplay(value: number): string {
	// Accept API tenths (e.g. `100`) or legacy whole scores before clamping for display.
	const display = logRatingToDisplay(value);
	if (display == null) return "0.0";
	const clamped = clampLogRatingDisplay(display);
	// Patron scale tops out at 10 — show a clean integer at the ceiling (not 10.0).
	if (Math.round(clamped * 10) >= 100) return "10";
	return clamped.toFixed(1);
}

/** Animated hero / ticker — same rules as {@link formatLogRatingDisplay} on 0–10 display scale. */
export function formatPatronScoreTickerLabel(display: number): string {
	const clamped = clampLogRatingDisplay(display);
	if (Math.round(clamped * 10) >= 100) return "10";
	return clamped.toFixed(1);
}

/** Format API/DB `log.rating` / `review.rating` (tenths or legacy 1–10) for UI copy. */
export function formatStoredLogRatingDisplay(
	stored: number | null | undefined,
): string | null {
	const display = logRatingToDisplay(stored);
	if (display == null) return null;
	return formatLogRatingDisplay(display);
}

export function isValidStoredLogRating(stored: number): boolean {
	return Number.isInteger(stored) && stored >= 0 && stored <= TENTHS_MAX;
}

/** `POST /api/reviews` expects a whole 1–10 integer — map diary storage to that scale. */
export function diaryStoredToReviewApiRating(
	stored: number | null | undefined,
): number | undefined {
	const display = logRatingToDisplay(stored);
	if (display == null) return undefined;
	const rounded = Math.round(clampLogRatingDisplay(display));
	if (rounded < 1) return undefined;
	return Math.min(10, rounded);
}
