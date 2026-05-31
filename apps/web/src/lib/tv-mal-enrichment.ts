/** MAL enrichment DTO from `GET /api/tv/:id`. */
export type TvMalEnrichment = {
	malId: number;
	score: number | null;
	rank: number | null;
	popularity: number | null;
	status: string | null;
};

/** One-line About copy — fails closed when nothing useful to show. */
export function formatTvMalEnrichmentLine(
	enrichment: TvMalEnrichment | null | undefined,
): string | null {
	if (!enrichment) return null;

	const parts: string[] = ["MAL"];
	if (enrichment.score != null) {
		parts.push(enrichment.score.toFixed(2));
	}
	if (enrichment.rank != null) {
		parts.push(`#${enrichment.rank.toLocaleString()} ranked`);
	}
	if (enrichment.popularity != null) {
		parts.push(`#${enrichment.popularity.toLocaleString()} popular`);
	}
	if (enrichment.status?.trim()) {
		parts.push(enrichment.status.trim());
	}

	// Need at least score or status beyond the "MAL" label — otherwise hide empty chrome.
	if (parts.length <= 1) return null;
	return parts.join(" · ");
}
