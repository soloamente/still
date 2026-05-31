/**
 * Parses Letterboxd diary/ratings CSV exports (UTF-8).
 * Column names vary slightly by export type; we match case-insensitively.
 */

export interface LetterboxdCsvRow {
	name: string;
	year: number | null;
	letterboxdUri: string | null;
	/** Letterboxd 0.5–5 stars, or empty. */
	ratingStars: number | null;
	rewatch: boolean;
	watchedAt: Date | null;
}

function parseCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (ch === "," && !inQuotes) {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	cells.push(current.trim());
	return cells;
}

function headerIndex(headers: string[], ...names: string[]): number {
	const lower = headers.map((h) => h.toLowerCase().trim());
	for (const name of names) {
		const idx = lower.indexOf(name.toLowerCase());
		if (idx >= 0) return idx;
	}
	return -1;
}

function parseRating(raw: string): number | null {
	const t = raw.trim();
	if (!t) return null;
	const n = Number.parseFloat(t);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

function parseDate(raw: string): Date | null {
	const t = raw.trim();
	if (!t) return null;
	const d = new Date(t);
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Converts Letterboxd star rating (0.5–5) to stored diary tenths (0–100).
 */
export function letterboxdStarsToStoredTenths(stars: number): number {
	const clamped = Math.min(5, Math.max(0.5, stars));
	return Math.round(clamped * 20);
}

export function parseLetterboxdCsv(text: string): LetterboxdCsvRow[] {
	const lines = text
		.replace(/^\uFEFF/, "")
		.split(/\r?\n/)
		.filter(Boolean);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0] ?? "");
	const nameIdx = headerIndex(headers, "Name", "Film", "Title");
	const yearIdx = headerIndex(headers, "Year");
	const uriIdx = headerIndex(headers, "Letterboxd URI", "URI");
	const ratingIdx = headerIndex(headers, "Rating");
	const rewatchIdx = headerIndex(headers, "Rewatch");
	const watchedIdx = headerIndex(headers, "Watched Date", "Date", "Diary Date");

	if (nameIdx < 0) return [];

	const rows: LetterboxdCsvRow[] = [];
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
			ratingStars: ratingIdx >= 0 ? parseRating(cells[ratingIdx] ?? "") : null,
			rewatch:
				rewatchIdx >= 0
					? /^yes|true|1$/i.test(cells[rewatchIdx]?.trim() ?? "")
					: false,
			watchedAt: watchedIdx >= 0 ? parseDate(cells[watchedIdx] ?? "") : null,
		});
	}
	return rows;
}

export function letterboxdImportDedupeKey(row: LetterboxdCsvRow): string {
	const uri = row.letterboxdUri?.toLowerCase() ?? "";
	if (uri) return `lb:${uri}`;
	const y = row.year ?? 0;
	const watched = row.watchedAt?.toISOString().slice(0, 10) ?? "";
	return `lb:${row.name.toLowerCase()}:${y}:${watched}`;
}

function uriMergeKey(row: LetterboxdCsvRow): string | null {
	const uri = row.letterboxdUri?.trim().toLowerCase();
	return uri ? `lburi:${uri}` : null;
}

function mergeLetterboxdPair(
	a: LetterboxdCsvRow,
	b: LetterboxdCsvRow,
): LetterboxdCsvRow {
	const aTime = a.watchedAt?.getTime();
	const bTime = b.watchedAt?.getTime();
	let watchedAt: Date | null = a.watchedAt ?? b.watchedAt;
	if (a.watchedAt && b.watchedAt && aTime != null && bTime != null) {
		watchedAt = aTime <= bTime ? a.watchedAt : b.watchedAt;
	}
	return {
		name: a.name || b.name,
		year: a.year ?? b.year,
		letterboxdUri: a.letterboxdUri ?? b.letterboxdUri,
		ratingStars: a.ratingStars ?? b.ratingStars,
		rewatch: a.rewatch || b.rewatch,
		watchedAt,
	};
}

/**
 * Merge rows from multiple Letterboxd CSVs (e.g. diary.csv + ratings.csv).
 * Same Letterboxd URI → one row (earliest watch date, any non-null rating).
 */
export function mergeLetterboxdImportRows(
	batches: LetterboxdCsvRow[][],
): LetterboxdCsvRow[] {
	const byUri = new Map<string, LetterboxdCsvRow>();
	const withoutUri: LetterboxdCsvRow[] = [];

	for (const row of batches.flat()) {
		const uriKey = uriMergeKey(row);
		if (!uriKey) {
			withoutUri.push(row);
			continue;
		}
		const prev = byUri.get(uriKey);
		byUri.set(uriKey, prev ? mergeLetterboxdPair(prev, row) : { ...row });
	}

	const seen = new Set<string>();
	const merged: LetterboxdCsvRow[] = [];
	for (const row of [...byUri.values(), ...withoutUri]) {
		const key = letterboxdImportDedupeKey(row);
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(row);
	}
	return merged;
}
