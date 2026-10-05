"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import { cn } from "@still/ui/lib/utils";

import {
	HOME_TASTE_HERO_BAND_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_MOBILE_DROP_CLASSNAME,
	HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
	HOME_TASTE_HERO_SECTION_2K_RESERVE_CLASSNAME,
} from "@/lib/home-taste-hero-layout";

/** Reserves hero height while the tonight pool loads in the layout RSC. */
export function WatchlistTonightHeroSkeleton() {
	return (
		<div
			className={cn(
				"w-full min-w-0",
				HOME_TASTE_HERO_SECTION_2K_RESERVE_CLASSNAME,
				HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
			)}
			role="status"
			aria-busy
			aria-live="polite"
			aria-label="Loading watch tonight pick"
		>
			<p className="sr-only">Loading tonight’s pick from your watchlist…</p>
			<div className="relative overflow-hidden rounded-[2rem] bg-transparent">
				<ShimmerBone className="absolute inset-0 rounded-none bg-card" />
				<div
					className={cn(
						"relative flex min-h-0 flex-col",
						HOME_TASTE_HERO_BAND_CLASSNAME,
						HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME,
					)}
				>
					<div
						className={cn(
							"mt-auto flex w-full flex-col gap-3 px-3 sm:gap-2 sm:px-6",
							HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
							HOME_TASTE_HERO_BAND_CONTENT_MOBILE_DROP_CLASSNAME,
							HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
						)}
					>
						<ShimmerBone className="mx-auto h-4 w-32 rounded-full sm:mx-0" />
						<ShimmerBone className="mx-auto h-[clamp(1.75rem,5.5vw,3.25rem)] w-[min(100%,14rem)] rounded-xl sm:mx-0" />
						<ShimmerBone className="mx-auto h-4 w-56 max-w-full rounded-full sm:mx-0" />
						<div className="flex flex-wrap justify-center gap-2 sm:justify-start">
							<ShimmerBone className="h-11 w-28 rounded-full" />
							<ShimmerBone className="h-11 w-20 rounded-full" />
							<ShimmerBone className="h-11 w-32 rounded-full" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
