"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import { useRef } from "react";

import { SearchDialogHorizontalScrollEdges } from "@/components/home/search-dialog-horizontal-scroll-edges";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

/**
 * Horizontal scroller with canvas-colored edge fades — used by studio / genre /
 * poster / people rails in the catalog search dialog.
 */
export function SearchDialogHorizontalRail({
	label,
	contentKey,
	enabled = true,
	gapClassName = "gap-2.5",
	className,
	scrollClassName,
	children,
	scrollRef: scrollRefProp,
}: {
	label: string;
	contentKey: string;
	enabled?: boolean;
	gapClassName?: string;
	className?: string;
	scrollClassName?: string;
	children: ReactNode;
	scrollRef?: RefObject<HTMLDivElement | null>;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const scrollRef = scrollRefProp ?? innerRef;
	const railEnabled = enabled;
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		railEnabled,
		contentKey,
	);

	return (
		<div className={cn("relative min-w-0 overflow-hidden", className)}>
			<div
				ref={scrollRef}
				data-lenis-prevent-wheel
				role="toolbar"
				aria-label={label}
				className={cn(
					HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
					gapClassName,
					"relative z-0 items-center pb-0",
					scrollClassName,
				)}
			>
				{children}
			</div>
			{/* After scrollport so backdrop-filter samples tiles below these overlays. */}
			<SearchDialogHorizontalScrollEdges
				showStartFade={showStartFade}
				showEndFade={showEndFade}
				tint="background"
			/>
		</div>
	);
}
