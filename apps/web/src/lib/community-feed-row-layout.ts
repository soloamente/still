import { cn } from "@still/ui/lib/utils";

/** Raised community feed tile on the lobby `bg-card` canvas. */
export const COMMUNITY_FEED_ROW_CLASS = cn(
	"group flex w-full flex-col gap-3 rounded-[1.75rem] bg-background p-4 sm:gap-4 sm:p-5",
	"transition-[transform,background-color] duration-150 ease-out",
	"[@media(hover:hover)]:hover:bg-foreground/[0.045]",
	"motion-reduce:transition-none",
);

/** Pressable community review row — stacks on the shared tile tokens. */
export const COMMUNITY_FEED_ROW_PRESSABLE_CLASS = cn(
	COMMUNITY_FEED_ROW_CLASS,
	"cursor-pointer text-left active:scale-[0.98] motion-reduce:active:scale-100",
);

/** Poster + copy row inside a community feed tile. */
export const COMMUNITY_FEED_ROW_BODY_CLASS =
	"flex min-w-0 items-start gap-4 sm:gap-5";

/**
 * Text column beside the poster — min height matches {@link ACTIVITY_POSTER_FRAME_CLASS}
 * so meta pills can sit on the bottom edge without stretching the cover art.
 */
export const COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS =
	"flex min-h-[8.25rem] min-w-0 flex-1 flex-col gap-2.5";

/** Variable review/log copy — grows so the meta row can sit on the bottom edge. */
export const COMMUNITY_FEED_ROW_COPY_STACK_CLASS =
	"flex min-w-0 flex-1 flex-col gap-2.5";

/** Engagement / rating pill row at the foot of a community tile. */
export const COMMUNITY_FEED_META_PILL_ROW_CLASS =
	"mt-auto flex shrink-0 flex-wrap items-center gap-2 pt-0.5";

/** Patron byline row above poster/copy on community tiles. */
export const COMMUNITY_FEED_BYLINE_CLASS =
	"flex min-w-0 items-center gap-2.5 sm:gap-3";

/** Compact stat pill on community feed rows. */
export const COMMUNITY_FEED_META_PILL_CLASS = cn(
	"inline-flex min-h-7 items-center gap-1.5 rounded-full bg-card px-2.5",
	"text-muted-foreground text-xs tabular-nums",
);

/** Sticky intro chrome — pins under the lobby filter row while the page scrolls. */
export const COMMUNITY_FEED_STICKY_INTRO_CLASSNAME = cn(
	"relative sticky top-0 z-20 shrink-0 bg-card",
	"pt-0.5 pb-3 sm:pb-4",
	// Soft edge when content slides beneath the pinned intro band.
	"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-linear-to-b after:from-card after:to-card/0",
);
