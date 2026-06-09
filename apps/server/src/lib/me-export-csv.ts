/**
 * Pure CSV primitives for the patron data export (`GET /api/me/export`).
 * Letterboxd-compatible film CSVs depend on exact header layouts — keep the
 * formatting rules here and unit-tested, away from the db-fetch code.
 */

export type CsvValue = string | number | boolean | null | undefined;

export function csvEscape(value: CsvValue): string {
	if (value == null) return "";
	const str =
		typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
	if (/[",\n\r]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function buildCsv(
	headers: readonly string[],
	rows: ReadonlyArray<ReadonlyArray<CsvValue>>,
): string {
	const lines = [headers.map(csvEscape).join(",")];
	for (const row of rows) {
		lines.push(row.map(csvEscape).join(","));
	}
	return `${lines.join("\n")}\n`;
}

/** Stored `log.rating` / `review.rating` (tenths 0–100 or legacy 1–10) → 0–10 display. */
export function storedRatingToDisplayTen(stored: number): number {
	return stored > 10 ? stored / 10 : stored;
}

/** 0–10 display score → Letterboxd 0.5–5 stars, rounded to the nearest half star. */
export function displayTenToLetterboxdStars(displayTen: number): number {
	return Math.max(0.5, Math.round(displayTen) / 2);
}

/** Native-score column: one decimal (`7.2`), whole `10` at the max (house style). */
export function formatRatingTenDisplay(displayTen: number): string {
	if (displayTen === 10) return "10";
	return displayTen.toFixed(1);
}

/** UTC `YYYY-MM-DD` for date columns; empty string for missing values. */
export function exportDateKey(value: Date | string | null | undefined): string {
	if (value == null) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}
