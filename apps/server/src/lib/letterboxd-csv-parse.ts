/**
 * Shared Letterboxd CSV parsing primitives (diary, watchlist, reviews, likes).
 */

export function parseCsvLine(line: string): string[] {
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

export function headerIndex(headers: string[], ...names: string[]): number {
	const lower = headers.map((h) => h.toLowerCase().trim());
	for (const name of names) {
		const idx = lower.indexOf(name.toLowerCase());
		if (idx >= 0) return idx;
	}
	return -1;
}

export function parseRating(raw: string): number | null {
	const t = raw.trim();
	if (!t) return null;
	const n = Number.parseFloat(t);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

export function parseDate(raw: string): Date | null {
	const t = raw.trim();
	if (!t) return null;
	const d = new Date(t);
	return Number.isNaN(d.getTime()) ? null : d;
}
