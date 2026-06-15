/**
 * Diary score on a **0.0–10.0** scale (one decimal in the log sheet UI).
 *
 * Stored in `log.rating` as integer **tenths** (0–100): display = stored / 10
 * (e.g. `87` → `8.7`, `8` → `0.8`, `100` → `10`).
 *
 * Migration **`0031_log_rating_tenths_backfill`** multiplies legacy whole rows
 * `1..10` by 10 so old `8` (8.0) becomes `80` — do not read 1–10 as whole scores.
 */

const TENTHS_MAX = 100;

/** API / DB integer tenths → display score on 0–10. */
export function logRatingToDisplay(
	stored: number | null | undefined,
): number | null {
	if (stored == null || !Number.isFinite(stored)) return null;
	return stored / 10;
}

/** UI score → integer tenths for POST/PATCH (e.g. `7.2` → `72`, `0.8` → `8`). */
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

/** Format a **0–10 display** score for UI copy (slider readout, labels). */
export function formatLogRatingDisplay(display: number): string {
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

/** Format API/DB `log.rating` / `review.rating` (tenths 0–100) for UI copy. */
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
