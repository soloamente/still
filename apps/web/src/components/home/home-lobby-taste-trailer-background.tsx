"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import { useHomeTasteHeroTrailer } from "@/components/home/home-taste-hero-trailer-context";
import {
	HOME_TASTE_HERO_BAND_CLASSNAME,
	HOME_TASTE_HERO_TOP_OFFSET_CLASSNAME,
} from "@/lib/home-taste-hero-layout";

/**
 * Taste-hero media on the Movies lobby card (`bg-card` shell) — trailer when
 * available, still backdrop underneath so production never shows empty card gaps.
 */
export function HomeLobbyTasteTrailerBackground() {
	const { trailer } = useHomeTasteHeroTrailer();
	if (!trailer) return null;

	const { backdropUrl, trailerSrc, tmdbId } = trailer;

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-x-0 z-0 overflow-hidden rounded-t-[2.5rem]",
				HOME_TASTE_HERO_TOP_OFFSET_CLASSNAME,
				HOME_TASTE_HERO_BAND_CLASSNAME,
			)}
			aria-hidden
		>
			{backdropUrl ? (
				<Image
					key={`lobby-backdrop-${tmdbId}`}
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
					key={`lobby-trailer-${tmdbId}`}
					title="Background film trailer"
					tabIndex={-1}
					src={trailerSrc}
					// Cover the band like object-cover: min-w + min-h + 16/9, centered (not vh/vw — that letterboxes).
					className="absolute top-1/2 left-1/2 z-[1] aspect-video h-auto min-h-full w-auto min-w-full -translate-x-1/2 -translate-y-1/2 scale-[1.12] border-0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				/>
			) : null}
			{/* Cinematic scrims — same stack as the nested hero used before shell-level media. */}
			<div className="absolute inset-0 z-[2] bg-linear-to-t from-absolute-black/92 via-absolute-black/45 to-absolute-black/15" />
			<div className="absolute inset-0 z-[2] bg-linear-to-r from-absolute-black/70 via-absolute-black/20 to-absolute-black/55" />
			{/* Fade media into the lobby card — sits above video/still, below hero controls. */}
			<div className="absolute inset-0 z-[3] bg-linear-to-b from-card/0 to-card" />
		</div>
	);
}
