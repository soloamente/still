"use client";

import { cn } from "@still/ui/lib/utils";

/** Canvas well vs card shell — edge tint matches the surface behind the rail. */
export type SearchDialogHorizontalScrollEdgeTint = "background" | "card";

const EDGE_CHROME: Record<
	SearchDialogHorizontalScrollEdgeTint,
	{
		leftWidthClass: string;
		rightWidthClass: string;
		leftGradientClass: string;
		rightGradientClass: string;
	}
> = {
	background: {
		leftWidthClass: "w-8",
		rightWidthClass: "w-16",
		leftGradientClass:
			"bg-linear-to-r from-background via-background/80 to-transparent",
		rightGradientClass:
			"bg-linear-to-l from-background via-background/80 to-transparent",
	},
	card: {
		leftWidthClass: "w-8",
		rightWidthClass: "w-10",
		leftGradientClass: "bg-linear-to-r from-card via-card/80 to-transparent",
		rightGradientClass: "bg-linear-to-l from-card via-card/85 to-transparent",
	},
};

/** Horizontal clip edges for ⌘K rails — color fade only (no backdrop blur). */
export function SearchDialogHorizontalScrollEdges({
	showStartFade,
	showEndFade,
	tint = "background",
}: {
	showStartFade: boolean;
	showEndFade: boolean;
	tint?: SearchDialogHorizontalScrollEdgeTint;
}) {
	const chrome = EDGE_CHROME[tint];

	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-y-0 left-0 z-10 transition-opacity duration-200 motion-reduce:transition-none",
					chrome.leftWidthClass,
					chrome.leftGradientClass,
					showStartFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-y-0 right-0 z-10 transition-opacity duration-200 motion-reduce:transition-none",
					chrome.rightWidthClass,
					chrome.rightGradientClass,
					showEndFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}
