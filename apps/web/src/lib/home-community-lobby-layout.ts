/**
 * Shared layout tokens for every Community tab body on `/home`.
 * One scroll shell + one feed column width keeps Ranks, Reviews, Activity, and Lists aligned.
 */

/** Body slot under the filter row — grows with content; `/home` Lenis scrolls the page. */
export const HOME_COMMUNITY_LOBBY_BODY_CLASSNAME =
	"min-w-0 flex-1 px-1 pb-6 pt-2 sm:px-2";

/** @deprecated Use {@link HOME_COMMUNITY_LOBBY_BODY_CLASSNAME} — kept for skeleton imports. */
export const HOME_COMMUNITY_LOBBY_SCROLL_CLASSNAME =
	HOME_COMMUNITY_LOBBY_BODY_CLASSNAME;

/** Centered feed rail — Activity, Reviews, Ranks, list subsection headers. */
export const HOME_COMMUNITY_FEED_COLUMN_CLASSNAME =
	"mx-auto w-full max-w-3xl px-2 sm:px-3";

/** Vertical stack for feed cards (reviews, activity). */
export const HOME_COMMUNITY_FEED_LIST_CLASSNAME =
	"flex flex-col gap-4 sm:gap-5";

/** Full-height empty state centering inside the lobby scroll shell. */
export const HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME =
	"flex min-h-[min(28rem,60vh)] flex-col items-center justify-center px-2 py-8 sm:px-4";
