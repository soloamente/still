"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME } from "@/lib/home-taste-hero-layout";
import {
	buildTasteHeroStillSlideUrls,
	HOME_TASTE_HERO_STILLS_CROSSFADE_BLUR_PX,
	HOME_TASTE_HERO_STILLS_CROSSFADE_EASE,
	HOME_TASTE_HERO_STILLS_CROSSFADE_MS,
	HOME_TASTE_HERO_STILLS_INTERVAL_MS,
} from "@/lib/home-taste-hero-stills-carousel";
import { fetchMovieReviewStills } from "@/lib/still-api-fetch";

const STILL_OBJECT_POSITION_CLASSNAME =
	"object-cover object-[center_52%] sm:object-[center_42%] min-[2000px]:object-[center_48%]";

/**
 * Rotating TMDb stills for the taste hero when no background trailer is playing.
 * Blur + opacity cross-fade — same technique as the auth backdrop carousel.
 */
export function HomeTasteHeroStillsCarousel({
	tmdbId,
	fallbackBackdropUrl,
}: {
	tmdbId: number;
	fallbackBackdropUrl: string | null;
}) {
	const reduceMotion = useReducedMotion();
	const [slideUrls, setSlideUrls] = useState<string[]>(() =>
		buildTasteHeroStillSlideUrls([], fallbackBackdropUrl),
	);
	const [activeIndex, setActiveIndex] = useState(0);
	const indexRef = useRef(0);

	const dropSlide = useCallback((url: string) => {
		setSlideUrls((current) => {
			const next = current.filter((entry) => entry !== url);
			if (next.length === 0) return current;
			const idx = Math.min(indexRef.current, next.length - 1);
			indexRef.current = idx;
			setActiveIndex(idx);
			return next;
		});
	}, []);

	// Load widescreen stills for the spotlight title; keep fallback visible while fetching.
	useEffect(() => {
		let cancelled = false;
		const fallbackSlides = buildTasteHeroStillSlideUrls(
			[],
			fallbackBackdropUrl,
		);
		indexRef.current = 0;
		setActiveIndex(0);
		setSlideUrls(fallbackSlides);

		void fetchMovieReviewStills(tmdbId).then((screenshots) => {
			if (cancelled) return;
			const srcs = screenshots.map((slide) => slide.src);
			const merged = buildTasteHeroStillSlideUrls(srcs, fallbackBackdropUrl);
			setSlideUrls(merged.length > 0 ? merged : fallbackSlides);
			indexRef.current = 0;
			setActiveIndex(0);
		});

		return () => {
			cancelled = true;
		};
	}, [fallbackBackdropUrl, tmdbId]);

	useEffect(() => {
		if (reduceMotion || slideUrls.length < 2) return;

		const id = window.setInterval(() => {
			setActiveIndex((prev) => {
				const next = (prev + 1) % slideUrls.length;
				indexRef.current = next;
				return next;
			});
		}, HOME_TASTE_HERO_STILLS_INTERVAL_MS);

		return () => window.clearInterval(id);
	}, [reduceMotion, slideUrls.length]);

	if (slideUrls.length === 0) {
		return (
			<div
				className={cn(
					"absolute bg-background",
					HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME,
				)}
			/>
		);
	}

	const crossfade = reduceMotion
		? "none"
		: `opacity ${HOME_TASTE_HERO_STILLS_CROSSFADE_MS}ms ${HOME_TASTE_HERO_STILLS_CROSSFADE_EASE}, filter ${HOME_TASTE_HERO_STILLS_CROSSFADE_MS}ms ${HOME_TASTE_HERO_STILLS_CROSSFADE_EASE}`;

	return (
		<div
			className={cn(
				"absolute isolate",
				HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME,
			)}
			style={{ contain: "paint" }}
		>
			{slideUrls.map((url, index) => {
				const isActive = index === activeIndex;
				return (
					// biome-ignore lint/performance/noImgElement: stacked cross-fade layers; next/image fights opacity transitions
					<img
						key={`${tmdbId}-${url}`}
						alt=""
						className={cn(
							"pointer-events-none absolute inset-0 size-full",
							STILL_OBJECT_POSITION_CLASSNAME,
						)}
						decoding="async"
						fetchPriority={isActive ? "high" : "low"}
						onError={() => dropSlide(url)}
						src={url}
						style={{
							opacity: isActive ? 1 : 0,
							filter: isActive
								? "blur(0px)"
								: `blur(${HOME_TASTE_HERO_STILLS_CROSSFADE_BLUR_PX}px)`,
							zIndex: isActive ? 1 : 0,
							transition: crossfade,
						}}
					/>
				);
			})}
		</div>
	);
}
