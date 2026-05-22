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
	return clampLogRatingDisplay(value).toFixed(1);
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
