"use client";

import { cn } from "@still/ui/lib/utils";

/** Sticky-edge fades for scrollable sheet/drawer bodies on `bg-card`. */
export function SheetScrollScrims({
	showHeaderFade,
	showFooterFade,
}: {
	showHeaderFade: boolean;
	showFooterFade: boolean;
}) {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-linear-to-b from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-linear-to-t from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}
