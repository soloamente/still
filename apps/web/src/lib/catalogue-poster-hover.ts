import { cn } from "@still/ui/lib/utils";

export type CataloguePosterHoverStacking = "catalogue" | "sheet";

/**
 * Vertical room for avatar-group lift (~4px) + 1.05 scale.
 * Put this on the overflow-x scroller, never on `.t-avatar-group` —
 * `overflow-x: auto` computes `overflow-y` to `auto` and shears the hover.
 */
export const CATALOGUE_POSTER_HOVER_LIFT_GUTTER_CLASSNAME =
	"mt-[-0.75rem] pt-3";

/** Horizontal poster rail scroller — sibling of `CataloguePosterGroup`, not the same node. */
export const CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME = cn(
	"scrollbar-none overflow-x-auto overscroll-x-contain pb-1",
	"[-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
	CATALOGUE_POSTER_HOVER_LIFT_GUTTER_CLASSNAME,
);

/**
 * Poster gallery hover shell — transitions.dev `.t-avatar` lift/scale instead of
 * the old card-tinted box-shadow. Pair with `CataloguePosterGroup` (`t-avatar-group`).
 */
export function cataloguePosterHoverShellClassName(
	hoverStacking: CataloguePosterHoverStacking = "catalogue",
	options?: { avatarGroupItem?: boolean },
): string {
	const avatarGroupItem = options?.avatarGroupItem ?? true;
	const elevationHoverZ =
		hoverStacking === "sheet"
			? "focus-within:z-[1] [@media(hover:hover)]:hover:z-[1]"
			: "focus-within:z-[100] [@media(hover:hover)]:hover:z-[100]";

	return cn(
		avatarGroupItem && "t-avatar",
		"group relative z-0 block w-full min-w-0 overflow-visible transition-[z-index] duration-200 ease-out",
		elevationHoverZ,
	);
}
