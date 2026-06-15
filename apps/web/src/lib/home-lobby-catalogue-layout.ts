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

/** Centered auto-fill poster wall — onboarding taste + favorites (matches `/home` lobby tracks). */
export const ONBOARDING_CATALOGUE_GRID_CLASSNAME =
	"mx-auto grid w-full max-w-6xl justify-items-center gap-x-3 gap-y-8 sm:gap-x-4 [grid-template-columns:repeat(auto-fill,minmax(6.75rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(8.25rem,1fr))] lg:[grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))]";

/** One onboarding catalogue tile — poster + centered title under the frame. */
export const ONBOARDING_CATALOGUE_CELL_CLASSNAME =
	"flex w-full max-w-[11rem] flex-col items-center text-center";

export const ONBOARDING_CATALOGUE_TITLE_CLASSNAME =
	"mt-2 line-clamp-2 w-full max-w-full text-pretty text-center font-medium text-foreground text-xs leading-snug sm:text-sm";

/** Grayscale non-hovered tiles when one lobby poster is focused/hovered (`:has()`). */
export const HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME =
	"[&_a>.poster-art]:transition-[filter] [&_a>.poster-art]:duration-200 [&_a>.poster-art]:ease-out motion-reduce:[&_a>.poster-art]:transition-none [@media(hover:hover)]:[&:has(a:hover)_a:not(:hover)>.poster-art]:grayscale [&:has(a:focus-within)_a:not(:focus-within)>.poster-art]:grayscale";

/** Base `className` for the rounded card that wraps sort chips + `PopularMoviesInfinite`. */
export const HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME =
	"flex flex-1 flex-col gap-2.5 rounded-[2.5rem] bg-card p-4";

/**
 * Sort + venue chip row under sticky chrome — always one line.
 * Leading sort/feed rail scrolls; trailing venue/period popovers stay pinned on the right.
 */
export const HOME_LOBBY_FILTER_ROW_CLASSNAME =
	"flex items-center gap-2 sm:gap-x-3";

/** Leading sort/feed rail — grows and scrolls; never squeezes chip labels onto a second line. */
export const HOME_LOBBY_FILTER_ROW_LEADING_CLASSNAME = "min-w-0 flex-1";

/** Shared pill track for lobby chip toolbars (sort, venue, period). */
export const HOME_LOBBY_CHIP_TRACK_CLASSNAME =
	"flex w-fit max-w-full flex-nowrap gap-1 rounded-full bg-background p-1";

/** Compact chip tap target — matches `HomeCatalogSortChips` beside wider `sm:` padding. */
export const HOME_LOBBY_CHIP_BUTTON_CLASSNAME =
	"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-5 sm:py-2.5";

/** Icon-only filters trigger inside the lobby chip track (Movies/TV/Community mobile). */
export const HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME =
	"relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-[transform,color] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none [@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Horizontal scroll edge fades on `bg-card` — use `to-card/0`, not `transparent`,
 * so OKLab gradients do not dip through black on mobile.
 */
export const HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME =
	"pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-card from-0% via-card/50 via-35% to-card/0 sm:w-8";

export const HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME =
	"pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-card from-0% via-card/50 via-35% to-card/0 sm:w-8";
