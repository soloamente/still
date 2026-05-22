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
	/** DOM `id` on the scroll target — film and list detail share `MovieDetailSectionNav`. */
	id: string;
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

/**
 * About-tab column — widens on `lg+` for cast arc / awards grids without `100vw` breakout
 * (viewport width units include the scrollbar gutter and cause a stray vertical scrollbar).
 */
export const MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME =
	"mx-auto max-w-7xl space-y-12 px-2.5 pt-8 pb-10 sm:px-4 sm:pt-10 md:px-5 md:pt-12 lg:max-w-[96rem] xl:max-w-[108rem]";

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
