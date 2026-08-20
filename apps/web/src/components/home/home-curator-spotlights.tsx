"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useRef } from "react";

import { PatronPortraitWithAura } from "@/components/profile/patron-portrait-with-aura";
import type { CuratorSpotlightPatron } from "@/lib/creator-recognition";
import { HOME_COMMUNITY_FEED_COLUMN_CLASSNAME } from "@/lib/home-community-lobby-layout";
import {
	HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

const CURATOR_CARD_CLASSNAME =
	"flex w-[9.5rem] shrink-0 flex-col items-center rounded-2xl bg-background px-3 py-3 text-center transition-colors [@media(hover:hover)]:hover:bg-background/80";

/**
 * Community lists tab — surfaces patrons earning curator recognition (SN.11).
 * Horizontal rail uses the same Lenis-safe overflow pattern as lobby filter chips.
 */
export function HomeCuratorSpotlights({
	patrons,
	className,
}: {
	patrons: CuratorSpotlightPatron[];
	className?: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const railContentKey = patrons.map((patron) => patron.userId).join("\0");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		patrons.length > 0,
		railContentKey,
	);

	if (patrons.length === 0) return null;

	return (
		<section
			className={cn(
				HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
				"mb-5 min-w-0 px-1 sm:mb-6",
				className,
			)}
			aria-label="Curators on Sense"
		>
			<p className="mb-3 text-center font-medium text-foreground text-sm">
				Curators on Sense
			</p>
			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
						"transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
						"transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				{/* Lenis must not capture wheel events — patrons scroll this rail horizontally. */}
				<div
					ref={scrollRef}
					className={cn(
						HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
						"gap-3 px-0.5",
						!showStartFade && !showEndFade && "justify-center",
					)}
					data-lenis-prevent-wheel
				>
					{patrons.map((patron) => (
						<Link
							key={patron.userId}
							href={`/profile/${patron.handle}`}
							className={CURATOR_CARD_CLASSNAME}
						>
							<PatronPortraitWithAura
								handle={patron.handle}
								avatarUrl={patron.image}
								name={patron.displayName}
								width={56}
								height={56}
								className="size-14 rounded-full"
								isAnimated={inferAnimatedFromProfileUrl(
									patron.image,
									patron.avatarIsAnimated,
								)}
								planTier={patron.planTier}
								staffRole={patron.staffRole}
							/>
							<p className="mt-2 line-clamp-1 w-full font-medium text-foreground text-sm leading-snug">
								{patron.displayName}
							</p>
							<p className="line-clamp-1 w-full text-muted-foreground text-xs">
								@{patron.handle}
							</p>
							<p className="mt-1.5 line-clamp-2 text-balance font-editorial text-[11px] text-muted-foreground leading-relaxed">
								{patron.headline}
							</p>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
