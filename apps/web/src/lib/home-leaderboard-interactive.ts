import { cn } from "@still/ui/lib/utils";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Profile link — @handle on podium; stays quiet until hover/focus. */
export const leaderboardHandleLinkClassName = (extra?: string) =>
	cn(
		"cursor-pointer rounded-md px-1.5 py-0.5 font-medium transition-colors duration-200 ease-out motion-reduce:transition-none",
		"text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
		"decoration-foreground/35 underline-offset-2 [@media(hover:hover)]:hover:underline",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		extra,
	);

/** Watch-log count — press scale from DetailMotionButton + soft hover wash. */
export const leaderboardCountButtonClassName = (extra?: string) =>
	cn(
		"cursor-pointer rounded-lg bg-foreground/5 px-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		extra,
	);
