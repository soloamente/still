/**
 * Community ranks column — matches Activity/Reviews `max-w-2xl` rail on `/home`.
 * Rows are flat `bg-background` tiles on the lobby `bg-card` canvas (no nested card tray).
 */
export const HOME_COMMUNITY_RANKS_COLUMN_CLASSNAME =
	"mx-auto flex w-full max-w-2xl flex-col gap-6";

/** Rank list from #4 — spaced tiles, no wrapping `bg-card` shell. */
export const HOME_COMMUNITY_RANKS_LIST_CLASSNAME = "flex flex-col gap-2";

/** Shared row chrome for film/show/member rank lists. */
export const HOME_COMMUNITY_RANKS_ROW_CLASSNAME =
	"flex min-h-12 items-center gap-3 rounded-xl bg-background px-3 py-2.5";

/** Signed-in viewer row when they fall outside the visible page. */
export const HOME_COMMUNITY_RANKS_VIEWER_ROW_CLASSNAME =
	"bg-[color-mix(in_oklab,var(--color-desert-orange)_14%,var(--background))]";

/** Podium stage — one raised tray; pedestals carry rank tint, not nested cards. */
export const HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME =
	"rounded-2xl bg-card px-4 pt-4 pb-0 sm:px-6 sm:pt-5";
