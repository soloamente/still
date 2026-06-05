"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import type { ReactElement } from "react";

/** Compact label — matches hero watchlist / add-to-list tooltips. */
export const DETAIL_ICON_TOOLTIP_CLASS = "px-2 py-2 text-xs leading-none";

/**
 * Hover label for icon-only hero controls on film/TV detail.
 * Pass `label={null}` to skip the tooltip (text pills stay unwrapped).
 */
export function DetailIconTooltip({
	label,
	children,
}: {
	label: string | null;
	children: ReactElement;
}) {
	if (!label) {
		return children;
	}

	return (
		<Tooltip>
			<TooltipTrigger delay={0} render={children} />
			<TooltipContent sideOffset={8} className={DETAIL_ICON_TOOLTIP_CLASS}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
