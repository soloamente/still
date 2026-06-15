/**
 * Normalize film titles for fuzzy match against bulk quote catalogs.
 */
export function normalizeTitleForQuoteMatch(title: string): string {
	return title
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/^the\s+/, "")
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "")
		.trim();
}

/** Split `"Speaker: line"` strings from bulk quote dumps. */
export function parseSpeakerPrefixedQuoteLine(raw: string): {
	speaker: string | null;
	body: string;
} {
	const trimmed = raw.trim();
	const colonIdx = trimmed.indexOf(":");
	if (colonIdx <= 0 || colonIdx > 80) {
		return { speaker: null, body: trimmed };
	}
	const speaker = trimmed.slice(0, colonIdx).trim();
	const body = trimmed.slice(colonIdx + 1).trim();
	if (!body) return { speaker: null, body: trimmed };
	return { speaker, body };
}
