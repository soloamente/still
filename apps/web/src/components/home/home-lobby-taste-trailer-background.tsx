"use client";

import { cn } from "@still/ui/lib/utils";

import { useHomeTasteHeroTrailer } from "@/components/home/home-taste-hero-trailer-context";
import { HOME_TASTE_HERO_BAND_CLASSNAME } from "@/lib/home-taste-hero-layout";

/**
 * Autoplay trailer layer for the Movies lobby card (`bg-card` shell) — not the
 * nested taste-hero tile (`bg-background`).
 */
export function HomeLobbyTasteTrailerBackground() {
	const { trailer, setTrailer } = useHomeTasteHeroTrailer();
	if (!trailer) return null;

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden rounded-t-[2.5rem]",
				HOME_TASTE_HERO_BAND_CLASSNAME,
			)}
			aria-hidden
		>
			<iframe
				key={`lobby-trailer-${trailer.tmdbId}`}
				title="Background film trailer"
				tabIndex={-1}
				src={trailer.src}
				// Cover the band like object-cover: min-w + min-h + 16/9, centered (not vh/vw — that letterboxes).
				className="absolute top-1/2 left-1/2 aspect-video h-auto min-h-full w-auto min-w-full -translate-x-1/2 -translate-y-1/2 scale-[1.12] border-0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				onError={() => setTrailer(null)}
			/>
			{/* Fades trailer into the lobby card — sits above video, below hero controls. */}
			<div className="absolute inset-0 z-[1] bg-linear-to-b from-card/0 to-card" />
		</div>
	);
}
