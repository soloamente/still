"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import {
	HOME_TASTE_MATCHED_RAIL_CELL_CLASSNAME,
	HOME_TASTE_MATCHED_RAIL_TRACK_CLASSNAME,
} from "@/lib/home-taste-matched-rail-layout";
import { useTasteRailVisibleCount } from "@/lib/use-taste-rail-visible-count";

const SKELETON_SLOT_IDS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
	"s",
	"t",
	"u",
	"v",
	"w",
	"x",
] as const;

/** Horizontal taste rail placeholder — reserves space so the lobby grid does not jump. */
export function HomeTasteMatchedRailSkeleton() {
	const { trackRef, visibleCount } = useTasteRailVisibleCount();
	const slots = SKELETON_SLOT_IDS.slice(0, visibleCount);

	return (
		<div
			className="w-full min-w-0 space-y-2.5"
			role="status"
			aria-busy
			aria-live="polite"
			aria-label="Loading taste-matched films"
		>
			<p className="sr-only">Loading films matched to your taste…</p>
			<ShimmerBone className="mx-auto h-4 w-56 max-w-[85%] rounded-md bg-background" />
			<div ref={trackRef} className={HOME_TASTE_MATCHED_RAIL_TRACK_CLASSNAME}>
				{slots.map((slot) => (
					<div
						key={`taste-rail-skel-${slot}`}
						className={`${HOME_TASTE_MATCHED_RAIL_CELL_CLASSNAME} gap-1.5`}
					>
						<ShimmerBone className="aspect-2/3 w-full rounded-2xl bg-background" />
						<ShimmerBone className="mx-auto h-3 w-[88%] rounded-md bg-background" />
					</div>
				))}
			</div>
		</div>
	);
}
