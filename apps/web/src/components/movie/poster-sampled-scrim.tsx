"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { posterSampledScrimStyle } from "@/lib/search-dialog-people-portrait-scrim";
import { useSearchDialogPeoplePortraitScrimColor } from "@/lib/use-search-dialog-people-portrait-scrim-color";

/**
 * Bottom fade sampled from the poster — same chromatic dark swatch as search
 * actor tiles, instead of a flat black plate.
 */
export function PosterSampledScrim({
	posterUrl,
	children,
	/** Diary / watchlist tiles hide the scrim on hover; list lobby keeps title readable. */
	hideOnHover = true,
}: {
	posterUrl: string | null;
	children: ReactNode;
	hideOnHover?: boolean;
}) {
	const color = useSearchDialogPeoplePortraitScrimColor(posterUrl);
	return (
		<div
			className={cn(
				// Slight bottom inset — clears the rounded lip without floating the caption.
				"pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end px-7 pb-4 text-center sm:px-8",
				hideOnHover &&
					"opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:opacity-0",
			)}
			style={posterSampledScrimStyle(color)}
		>
			{children}
		</div>
	);
}
