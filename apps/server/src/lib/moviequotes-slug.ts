/**
 * MovieQuotes.rocks expects kebab-case movie slugs (`?movie=the-matrix`).
 * We derive these from cached TMDb titles when importing by `tmdbId`.
 */

/** Turn a film title into the provider's movie slug query value. */
export function titleToMovieQuotesSlug(title: string): string {
	const normalized = title
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	return normalized;
}
