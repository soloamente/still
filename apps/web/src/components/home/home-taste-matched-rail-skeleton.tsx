"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

/** Horizontal taste rail placeholder — reserves space so the lobby grid does not jump. */
export function HomeTasteMatchedRailSkeleton() {
	return (
		<div
			className="shrink-0 space-y-2.5"
			role="status"
			aria-busy
			aria-live="polite"
			aria-label="Loading taste-matched films"
		>
			<p className="sr-only">Loading films matched to your taste…</p>
			<ShimmerBone className="h-4 w-56 max-w-[85%] rounded-md bg-background" />
			<div className="flex gap-2 overflow-hidden">
				{["a", "b", "c", "d", "e", "f"].map((slot) => (
					<div
						key={`taste-rail-skel-${slot}`}
						className="flex w-27 shrink-0 flex-col gap-1.5 sm:w-30"
					>
						<ShimmerBone className="aspect-2/3 w-full rounded-2xl bg-background" />
						<ShimmerBone className="h-3 w-[88%] rounded-md bg-background" />
					</div>
				))}
			</div>
		</div>
	);
}
