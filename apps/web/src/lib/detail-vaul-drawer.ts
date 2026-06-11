/**
 * Vaul bottom-sheet chrome — `handleOnly` drag on the rail; body scrolls in a full-width flex child.
 */

/** Marks Sense filmography sheets — used to neutralize Vaul’s injected handle chrome in CSS. */
export const MOVIE_DETAIL_DRAWER_SURFACE_ATTR = "data-still-detail-drawer";

export const MOVIE_DETAIL_DRAWER_CONTENT_CLASSNAME =
	"fixed inset-x-0 bottom-0 z-50 flex h-[min(88svh,920px)] max-h-[min(96svh,920px)] flex-col overflow-hidden overscroll-none rounded-t-[2.25rem] bg-card outline-none shadow-2xl";

/** App-shell drawers (lists, profile) sit above the mobile tab bar (`z-50`). */
export const APP_DETAIL_DRAWER_CONTENT_CLASSNAME =
	"fixed inset-x-0 bottom-0 z-[60] flex h-[min(88svh,920px)] max-h-[min(96svh,920px)] flex-col overflow-hidden overscroll-none rounded-t-[2.25rem] bg-card outline-none shadow-2xl";

export const MOVIE_DETAIL_NESTED_DRAWER_CONTENT_CLASSNAME =
	"fixed inset-x-0 bottom-0 z-60 flex h-[min(80svh,880px)] max-h-[min(92svh,880px)] flex-col overflow-hidden overscroll-none rounded-t-[2.25rem] bg-card outline-none shadow-2xl";

/** Full-width scrollport — content columns live inside, not on this element. */
export const MOVIE_DETAIL_DRAWER_SCROLL_CLASSNAME =
	"w-full min-h-0 flex-1 contain-[paint] overflow-y-auto overscroll-contain px-5 pt-2 pb-10 [-ms-overflow-style:none] scrollbar-none sm:px-8 sm:pb-12";

export const MOVIE_DETAIL_NESTED_DRAWER_SCROLL_CLASSNAME =
	"w-full min-h-0 flex-1 contain-[paint] overflow-y-auto overscroll-contain px-5 pt-2 pb-10 [-ms-overflow-style:none] scrollbar-none sm:px-8 sm:pb-12";

/** Wraps sheet children below the handle so the body fills remaining height. */
export const MOVIE_DETAIL_DRAWER_BODY_CLASSNAME =
	"flex min-h-0 w-full flex-1 flex-col";

/** Full-width drag rail — Sense grip is the child span; Vaul default pill overridden in CSS. */
export const MOVIE_DETAIL_DRAWER_HANDLE_CLASSNAME =
	"mx-auto mt-2 flex min-h-11 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing";

export const MOVIE_DETAIL_DRAWER_HANDLE_GRIP_CLASSNAME =
	"pointer-events-none h-1 w-12 shrink-0 rounded-full bg-muted-foreground/35";
