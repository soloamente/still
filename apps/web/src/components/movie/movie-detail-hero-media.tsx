"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { DetailArtworkPasitoStepper } from "@/components/movie/detail-artwork-pasito-stepper";
import { isListCoverProxySrc } from "@/lib/list-cover-image";

export type MovieDetailHeroSlide = {
	key: string;
	src: string;
	/** Full-resolution TMDb backdrop (`original`) when the API exposes download URLs. */
	srcFull?: string | null;
	label: string;
};

/**
 * Hero poster strip — TMDb posters only (no scene backdrops). **Page indicators** match the comp:
 * one elongated white pill for the active slide, short muted pills for the rest, tight `gap`,
 * no outer track (pills sit on the canvas).
 */
export function MovieDetailHeroMedia({
	title,
	posterUrl,
	backdropUrl: _backdropUrl,
	/** When set (film/TV detail API), extra TMDb posters from `hero_artwork` (posters only). */
	artworkSlides,
	className,
}: {
	title: string;
	posterUrl: string | null;
	backdropUrl: string | null;
	artworkSlides?: MovieDetailHeroSlide[];
	className?: string;
}) {
	const slides = useMemo(() => {
		if (artworkSlides?.length) return artworkSlides;
		const out: MovieDetailHeroSlide[] = [];
		if (posterUrl) {
			out.push({ key: "poster", src: posterUrl, label: `${title} poster` });
		}
		return out;
	}, [artworkSlides, posterUrl, title]);

	const slideWaveKey = slides.map((s) => s.key).join("|");

	const [index, setIndex] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset active slide when poster/backdrop composition changes.
	useEffect(() => {
		setIndex(0);
	}, [slideWaveKey]);

	const safeIndex = Math.min(index, Math.max(slides.length - 1, 0));
	const active = slides[safeIndex] ?? null;

	const showDots = slides.length > 1;

	if (!active) {
		return (
			<div
				className={cn(
					"relative mx-auto aspect-2/3 w-full max-w-[min(100%,22rem)] overflow-hidden rounded-[1.25rem] bg-background sm:rounded-[1.5rem]",
					className,
				)}
			>
				<p className="grid size-full place-items-center p-6 text-center text-muted-foreground text-sm">
					<span role="status">No poster yet</span>
				</p>
			</div>
		);
	}

	return (
		<div className={cn("mx-auto w-full max-w-[min(100%,22rem)]", className)}>
			<div className="relative aspect-2/3 overflow-hidden rounded-[1.25rem] bg-muted/20 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem]">
				{/* One <Image> at a time — stacked hidden slides triggered removeChild races on refresh. */}
				<div className="absolute inset-0">
					<Image
						key={active.src}
						src={active.src}
						alt={active.label}
						fill
						className="object-cover"
						sizes="(max-width: 768px) 100vw, 360px"
						priority
						unoptimized={isListCoverProxySrc(active.src)}
					/>
				</div>
			</div>
			{showDots ? (
				<div
					className="mx-auto mt-4 flex justify-center"
					role="tablist"
					aria-label="Artwork slides"
				>
					<DetailArtworkPasitoStepper
						count={slides.length}
						active={safeIndex}
						onStepClick={setIndex}
					/>
				</div>
			) : (
				<div className="mt-4 h-1.5" aria-hidden />
			)}
		</div>
	);
}
