"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import {
	HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME,
	HOME_TASTE_HERO_SCRIM_BOTTOM_VERTICAL_CLASSNAME,
	HOME_TASTE_HERO_SCRIM_CARD_FADE_CLASSNAME,
	HOME_TASTE_HERO_SCRIM_SIDE_CLASSNAME,
	HOME_TASTE_HERO_SHELL_MEDIA_CLASSNAME,
	HOME_TASTE_HERO_TRAILER_IFRAME_CLASSNAME,
} from "@/lib/home-taste-hero-layout";

/** Backdrop + optional trailer for the taste hero — colocated with controls (no context sync). */
export function HomeTasteHeroMediaLayer({
	tmdbId,
	backdropUrl,
	trailerSrc,
}: {
	tmdbId: number;
	backdropUrl: string | null;
	trailerSrc: string | null;
}) {
	return (
		<div className={HOME_TASTE_HERO_SHELL_MEDIA_CLASSNAME} aria-hidden>
			<div className="relative size-full">
				{backdropUrl ? (
					<div
						className={cn("absolute", HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME)}
					>
						<Image
							key={`hero-backdrop-${tmdbId}`}
							src={backdropUrl}
							alt=""
							fill
							priority
							sizes="100vw"
							className="object-cover object-[center_32%] sm:object-[center_42%] min-[2000px]:object-[center_48%]"
							unoptimized={backdropUrl.includes("image.tmdb.org")}
						/>
					</div>
				) : (
					<div
						className={cn(
							"absolute bg-background",
							HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME,
						)}
					/>
				)}
				{trailerSrc ? (
					<iframe
						key={`hero-trailer-${tmdbId}`}
						title="Background film trailer"
						tabIndex={-1}
						src={trailerSrc}
						loading="eager"
						referrerPolicy="strict-origin-when-cross-origin"
						className={HOME_TASTE_HERO_TRAILER_IFRAME_CLASSNAME}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					/>
				) : null}
				<div className={HOME_TASTE_HERO_SCRIM_BOTTOM_VERTICAL_CLASSNAME} />
				<div className={HOME_TASTE_HERO_SCRIM_SIDE_CLASSNAME} />
				<div className={HOME_TASTE_HERO_SCRIM_CARD_FADE_CLASSNAME} />
			</div>
		</div>
	);
}
