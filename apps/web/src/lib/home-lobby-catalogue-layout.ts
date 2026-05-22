/**
 * Canonical lobby poster catalogue layout for `/home` and any surface that should
 * match it pixel-for-pixel (e.g. diary “Catalogue” view).
 */
export const HOME_LOBBY_CATALOGUE_GRID_CLASSNAME =
	"isolate grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 md:gap-2 lg:grid-cols-5 lg:gap-2 xl:grid-cols-6 xl:gap-2";

/**
 * List detail films — wide `minmax` tracks so the films section reads larger than lobby grids.
 * `auto-fill` keeps sparse lists from shrinking a lone poster into a tiny cell.
 */
export const LIST_DETAIL_FILMS_GRID_CLASSNAME =
	"isolate grid w-full max-w-7xl gap-4 sm:gap-5 [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))] lg:[grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))] 2xl:[grid-template-columns:repeat(auto-fill,minmax(17.5rem,1fr))]";

export const HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME =
	"min-w-0 rounded-[3rem]";

export const HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME =
	"rounded-[3rem] border-0 bg-background";

/** Grayscale non-hovered tiles when one lobby poster is focused/hovered (`:has()`). */
export const HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME =
	"[&_a>.poster-art]:transition-[filter] [&_a>.poster-art]:duration-200 [&_a>.poster-art]:ease-out motion-reduce:[&_a>.poster-art]:transition-none [@media(hover:hover)]:[&:has(a:hover)_a:not(:hover)>.poster-art]:grayscale [&:has(a:focus-within)_a:not(:focus-within)>.poster-art]:grayscale";

/** Base `className` for the rounded card that wraps sort chips + `PopularMoviesInfinite`. */
export const HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME =
	"flex min-h-0 flex-1 flex-col gap-2.5 rounded-[2.5rem] bg-card p-4";
