/**
 * Parses Letterboxd `reviews.csv` and strips HTML from review bodies.
 */

import {
	headerIndex,
	parseCsvLine,
	parseDate,
	parseRating,
} from "./letterboxd-csv-parse";

export interface LetterboxdReviewRow {
	name: string;
	year: number | null;
	letterboxdUri: string | null;
	ratingStars: number | null;
	rewatch: boolean;
	watchedAt: Date | null;
	publishedAt: Date | null;
	body: string;
}

const HTML_ENTITY_MAP: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
};

/** Letterboxd exports review bodies as HTML — flatten to plain text for Sense. */
export function stripLetterboxdReviewHtml(html: string): string {
	let text = html.trim();
	if (!text) return "";

	// Block-level tags become paragraph breaks before stripping.
	text = text.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
	text = text.replace(/<br\s*\/?>/gi, "\n");
	text = text.replace(/<\/p>/gi, "\n\n");
	text = text.replace(/<p[^>]*>/gi, "");
	text = text.replace(/<[^>]+>/g, "");

	for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
		text = text.replaceAll(entity, char);
	}

	return text
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function parseLetterboxdReviewsCsv(text: string): LetterboxdReviewRow[] {
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
	const reviewIdx = headerIndex(headers, "Review");
	const dateIdx = headerIndex(headers, "Date");

	if (nameIdx < 0 || reviewIdx < 0) return [];

	const rows: LetterboxdReviewRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = parseCsvLine(lines[i] ?? "");
		const name = cells[nameIdx]?.trim();
		if (!name) continue;

		const body = stripLetterboxdReviewHtml(cells[reviewIdx] ?? "");
		if (!body) continue;

		const yearRaw = yearIdx >= 0 ? cells[yearIdx]?.trim() : "";
		const yearParsed = yearRaw ? Number.parseInt(yearRaw, 10) : Number.NaN;
		const year =
			Number.isFinite(yearParsed) && yearParsed > 1800 ? yearParsed : null;

		const watchedAt =
			watchedIdx >= 0 ? parseDate(cells[watchedIdx] ?? "") : null;
		const publishedAt =
			dateIdx >= 0 && dateIdx !== watchedIdx
				? parseDate(cells[dateIdx] ?? "")
				: watchedAt;

		rows.push({
			name,
			year,
			letterboxdUri: uriIdx >= 0 ? cells[uriIdx]?.trim() || null : null,
			ratingStars: ratingIdx >= 0 ? parseRating(cells[ratingIdx] ?? "") : null,
			rewatch:
				rewatchIdx >= 0
					? /^yes|true|1$/i.test(cells[rewatchIdx]?.trim() ?? "")
					: false,
			watchedAt,
			publishedAt,
			body,
		});
	}
	return rows;
}
