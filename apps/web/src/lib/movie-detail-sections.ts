/** Stable anchor ids for the film detail scroll legend (`MovieDetailSectionNav`). */
export const MOVIE_DETAIL_SECTION = {
	about: "movie-section-about",
	cast: "movie-section-cast",
	awards: "movie-section-awards",
	reviews: "movie-section-reviews",
	lists: "movie-section-lists",
	related: "movie-section-related",
	credits: "movie-section-credits",
} as const;

export type MovieDetailSectionId =
	(typeof MOVIE_DETAIL_SECTION)[keyof typeof MOVIE_DETAIL_SECTION];

export type MovieDetailSectionNavItem = {
	id: MovieDetailSectionId;
	label: string;
};

/** Offset so `scrollIntoView` clears the sticky film header. */
export const MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS =
	"scroll-mt-[calc(3.5rem+env(safe-area-inset-top,0px))]";

/**
 * Symmetric horizontal inset on `xl+` so body sections stay viewport-centered while
 * the fixed right-rail legend sits in the gutter (never `pr-*` alone — that shifts content left).
 */
export const MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS = "xl:px-28 2xl:px-32";

/** Nav labels for the fixed right-rail legend (order matches scroll depth). */
export function buildMovieDetailSectionNavItems({
	hasCast,
	hasAwards,
}: {
	hasCast: boolean;
	hasAwards: boolean;
}): MovieDetailSectionNavItem[] {
	const items: MovieDetailSectionNavItem[] = [
		{ id: MOVIE_DETAIL_SECTION.about, label: "About" },
	];
	if (hasCast) {
		items.push({ id: MOVIE_DETAIL_SECTION.cast, label: "Cast" });
	}
	if (hasAwards) {
		items.push({ id: MOVIE_DETAIL_SECTION.awards, label: "Awards" });
	}
	items.push(
		{ id: MOVIE_DETAIL_SECTION.reviews, label: "Community" },
		{ id: MOVIE_DETAIL_SECTION.related, label: "Related" },
	);
	return items;
}

/** Closing credits crawl — headerless block below Related. */
export function movieDetailCreditsCrawlNavItem(): MovieDetailSectionNavItem {
	return { id: MOVIE_DETAIL_SECTION.credits, label: "Credits" };
}
