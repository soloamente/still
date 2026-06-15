/** Query-backed film/TV detail tabs (`?view=`; legacy `?tab=` still parses). */
export type MovieDetailView = "about" | "community" | "quotes" | "streaming";

export type MovieDetailListingKind = "movie" | "tv";

export type MovieDetailViewHrefOptions = {
	listingKind?: MovieDetailListingKind;
	season?: number | null;
	episode?: number | null;
};

const MOVIE_DETAIL_VIEWS: readonly MovieDetailView[] = [
	"about",
	"community",
	"quotes",
	"streaming",
];

function isMovieDetailView(value: string): value is MovieDetailView {
	return (MOVIE_DETAIL_VIEWS as readonly string[]).includes(value);
}

/** Resolve active tab from `view` or legacy notification `tab` query keys. */
export function parseMovieDetailView(
	raw: string | null | undefined,
): MovieDetailView {
	if (raw && isMovieDetailView(raw)) return raw;
	return "about";
}

export function parseMovieDetailViewFromSearchParams(searchParams: {
	view?: string | null;
	tab?: string | null;
}): MovieDetailView {
	return parseMovieDetailView(searchParams.view ?? searchParams.tab);
}

/** Same-pathname tab href — used with `useLobbyTransition().navigate`. */
export function buildMovieDetailViewHref(
	basePath: string,
	view: MovieDetailView,
	options?: MovieDetailViewHrefOptions,
): string {
	if (view === "about") return basePath;

	const params = new URLSearchParams();
	params.set("view", view);

	if (
		view === "quotes" &&
		options?.listingKind === "tv" &&
		options.season != null &&
		options.season >= 1 &&
		options.episode != null &&
		options.episode >= 1
	) {
		params.set("season", String(Math.trunc(options.season)));
		params.set("episode", String(Math.trunc(options.episode)));
	}

	return `${basePath}?${params.toString()}`;
}

export function parseMovieDetailTvQuoteEpisode(searchParams: {
	season?: string | null;
	episode?: string | null;
}): { season: number; episode: number } | null {
	const season = Number(searchParams.season);
	const episode = Number(searchParams.episode);
	if (
		!Number.isFinite(season) ||
		!Number.isFinite(episode) ||
		season < 1 ||
		episode < 1
	) {
		return null;
	}
	return { season: Math.trunc(season), episode: Math.trunc(episode) };
}
