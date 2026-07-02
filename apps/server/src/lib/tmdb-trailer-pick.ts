export type TmdbTrailerRow = {
	key: string;
	site: string;
	type: string;
};

/** First official trailer/teaser on YouTube or Vimeo from a TMDb videos payload. */
export function pickTrailerFromVideoResults(
	results: TmdbTrailerRow[] | null | undefined,
): { key: string; site: string } | null {
	if (!results?.length) return null;

	const trailer =
		results.find(
			(row) =>
				row.type === "Trailer" &&
				(row.site === "YouTube" || row.site === "Vimeo"),
		) ?? results.find((row) => row.site === "YouTube" || row.site === "Vimeo");
	if (!trailer?.key) return null;
	return { key: trailer.key, site: trailer.site };
}

/** First trailer from cached movie detail JSON (`append_to_response=videos`). */
export function pickTrailerFromTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): { key: string; site: string } | null {
	const results = (
		tmdbJson?.videos as { results?: TmdbTrailerRow[] } | undefined
	)?.results;
	return pickTrailerFromVideoResults(results);
}
