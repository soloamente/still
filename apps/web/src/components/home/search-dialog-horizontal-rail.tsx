"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import { useRef } from "react";
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
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-background via-background/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showStartFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					// Figma fade is ~66px; keep it ending at color/0 so it does not darken the well.
					"pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-background via-background/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showEndFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				ref={scrollRef}
				data-lenis-prevent-wheel
				role="toolbar"
				aria-label={label}
				className={cn(
					HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
					gapClassName,
					"items-center pb-0",
					scrollClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}
