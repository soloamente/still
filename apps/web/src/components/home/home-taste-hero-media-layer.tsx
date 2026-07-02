"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import {
	HOME_TASTE_HERO_BAND_CLASSNAME,
	HOME_TASTE_HERO_SHELL_MEDIA_CLASSNAME,
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
		<div
			className={cn(
				HOME_TASTE_HERO_SHELL_MEDIA_CLASSNAME,
				HOME_TASTE_HERO_BAND_CLASSNAME,
			)}
			aria-hidden
		>
			<div className="relative size-full overflow-hidden rounded-t-[2.5rem]">
				{backdropUrl ? (
					<Image
						key={`hero-backdrop-${tmdbId}`}
						src={backdropUrl}
						alt=""
						fill
						priority
						sizes="100vw"
						className="object-cover object-center"
						unoptimized={backdropUrl.includes("image.tmdb.org")}
					/>
				) : (
					<div className="absolute inset-0 bg-background" />
				)}
				{trailerSrc ? (
					<iframe
						key={`hero-trailer-${tmdbId}`}
						title="Background film trailer"
						tabIndex={-1}
						src={trailerSrc}
						loading="eager"
						referrerPolicy="strict-origin-when-cross-origin"
						className="absolute top-1/2 left-1/2 z-1 aspect-video h-auto min-h-full w-auto min-w-full -translate-x-1/2 -translate-y-1/2 scale-[1.12] border-0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					/>
				) : null}
				<div className="absolute inset-0 z-2 bg-linear-to-t from-absolute-black/92 via-absolute-black/45 to-absolute-black/15" />
				<div className="absolute inset-0 z-2 bg-linear-to-r from-absolute-black/70 via-absolute-black/20 to-absolute-black/55" />
				<div className="absolute inset-0 z-3 bg-linear-to-b from-card/0 to-card" />
			</div>
		</div>
	);
}
