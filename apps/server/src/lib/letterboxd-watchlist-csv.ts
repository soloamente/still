/**
 * Parses Letterboxd `watchlist.csv` from a data export folder.
 */

import { headerIndex, parseCsvLine, parseDate } from "./letterboxd-csv-parse";

export interface LetterboxdWatchlistRow {
	name: string;
	year: number | null;
	letterboxdUri: string | null;
	addedAt: Date | null;
}

export function parseLetterboxdWatchlistCsv(
	text: string,
): LetterboxdWatchlistRow[] {
	const lines = text
		.replace(/^\uFEFF/, "")
		.split(/\r?\n/)
		.filter(Boolean);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0] ?? "");
	const nameIdx = headerIndex(headers, "Name", "Film", "Title");
	const yearIdx = headerIndex(headers, "Year");
	const uriIdx = headerIndex(headers, "Letterboxd URI", "URI");
	const dateIdx = headerIndex(headers, "Date", "Added Date");

	if (nameIdx < 0) return [];

	const rows: LetterboxdWatchlistRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = parseCsvLine(lines[i] ?? "");
		const name = cells[nameIdx]?.trim();
		if (!name) continue;
		const yearRaw = yearIdx >= 0 ? cells[yearIdx]?.trim() : "";
		const yearParsed = yearRaw ? Number.parseInt(yearRaw, 10) : Number.NaN;
		const year =
			Number.isFinite(yearParsed) && yearParsed > 1800 ? yearParsed : null;
		rows.push({
			name,
			year,
			letterboxdUri: uriIdx >= 0 ? cells[uriIdx]?.trim() || null : null,
			addedAt: dateIdx >= 0 ? parseDate(cells[dateIdx] ?? "") : null,
		});
	}
	return rows;
}
