"use client";

import { cn } from "@still/ui/lib/utils";

/**
 * Top + bottom edge fades for review composer, quick log, and create-list sheets —
 * softens the scroll clip on `bg-card` (matches search dialog scrim weights).
 */
export function ModalSheetScrollScrims({
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
					"modal-sheet-scroll-fade pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-linear-to-b from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"modal-sheet-scroll-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-linear-to-t from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}
