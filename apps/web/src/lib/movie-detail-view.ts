/** Query-backed film/TV detail tabs (`?view=`). */
export type MovieDetailView = "about" | "streaming";

export function parseMovieDetailView(
	raw: string | null | undefined,
): MovieDetailView {
	return raw === "streaming" ? "streaming" : "about";
}

/** Same-pathname tab href — used with `useLobbyTransition().navigate`. */
export function buildMovieDetailViewHref(
	basePath: string,
	view: MovieDetailView,
): string {
	if (view === "about") return basePath;
	return `${basePath}?view=streaming`;
}
