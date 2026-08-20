"use client";

import { cn } from "@still/ui/lib/utils";

/** Sticky-edge fades for scrollable sheet/drawer bodies on `bg-card`. */
export function SheetScrollScrims({
	showHeaderFade,
	showFooterFade,
	footerTone = "default",
	headerTone = "default",
}: {
	showHeaderFade: boolean;
	showFooterFade: boolean;
	/** `filmography` — stronger bottom depth for poster grids in Vaul sheets. */
	footerTone?: "default" | "subtle" | "filmography";
	/** Match footer strength when posters hard-crop under the top edge. */
	headerTone?: "default" | "subtle" | "filmography";
}) {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-30 bg-linear-to-b to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					headerTone === "subtle" && "h-10 from-10% from-card/75 via-card/35",
					headerTone === "default" && "h-14 from-20% from-card via-card/70",
					headerTone === "filmography" && "h-20 from-30% from-card via-card/92",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-linear-to-t to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					footerTone === "subtle" && "h-10 from-10% from-card/75 via-card/35",
					footerTone === "default" && "h-16 from-20% from-card via-card/70",
					footerTone === "filmography" && "h-20 from-30% from-card via-card/92",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}
