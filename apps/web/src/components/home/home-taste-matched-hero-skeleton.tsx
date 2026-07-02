"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import { cn } from "@still/ui/lib/utils";

import {
	HOME_TASTE_HERO_BAND_CLASSNAME,
	HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
	HOME_TASTE_HERO_TOP_OFFSET_CLASSNAME,
} from "@/lib/home-taste-hero-layout";

/** Cinematic taste hero placeholder — reserves lobby height before for-you loads. */
export function HomeTasteMatchedHeroSkeleton() {
	return (
		<div
			className={cn(
				"w-full min-w-0",
				HOME_TASTE_HERO_TOP_OFFSET_CLASSNAME,
				HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
			)}
			role="status"
			aria-busy
			aria-live="polite"
			aria-label="Loading taste-matched spotlight"
		>
			<p className="sr-only">Loading films matched to your taste…</p>
			<div className="relative overflow-hidden rounded-[2rem] bg-background">
				<ShimmerBone className="absolute inset-0 rounded-none bg-card" />
				<div
					className={`relative flex min-h-0 flex-col justify-end ${HOME_TASTE_HERO_BAND_CLASSNAME}`}
				>
					<div className="relative z-10 mt-auto flex w-full flex-col justify-end gap-2 px-3 pb-1 sm:mt-0 sm:p-6">
						<ShimmerBone className="mx-auto h-3.5 w-48 max-w-[70%] rounded-md bg-card sm:mx-0 sm:h-4 sm:w-56" />
						<ShimmerBone className="mx-auto h-[clamp(2.25rem,5.5vw,5.75rem)] w-[min(100%,14rem)] rounded-lg bg-card sm:mx-0 sm:max-w-[min(100%,16rem)]" />
						<div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 sm:justify-start sm:gap-2 sm:pt-1">
							<ShimmerBone className="size-10 shrink-0 rounded-full bg-card sm:size-11" />
							<ShimmerBone className="h-10 w-32 rounded-full bg-card sm:h-11 sm:w-36" />
							<ShimmerBone className="size-10 shrink-0 rounded-full bg-card sm:hidden" />
							<ShimmerBone className="hidden h-11 w-32 rounded-full bg-card sm:block" />
						</div>
						<div className="flex gap-2 py-1 pl-1 sm:gap-2.5 sm:py-2 sm:pl-2">
							<ShimmerBone className="h-[4.5rem] w-[3.75rem] rounded-xl bg-card sm:h-28 sm:w-20 sm:rounded-2xl" />
							<ShimmerBone className="h-[4.5rem] w-[3.75rem] rounded-xl bg-card sm:h-28 sm:w-20 sm:rounded-2xl" />
							<ShimmerBone className="h-[4.5rem] w-[3.75rem] rounded-xl bg-card sm:h-28 sm:w-20 sm:rounded-2xl" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
