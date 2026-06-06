"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { MouseEvent } from "react";
import { useCallback, useState } from "react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import { useDetailEditorialRailSnap } from "@/lib/detail-editorial-rail-snap";
import {
	downloadTmdbImage,
	tmdbImageDownloadFilename,
} from "@/lib/download-tmdb-image";

/** Inset image edge — pure black/white at 10% (not tinted neutrals). */
const STILL_IMAGE_OUTLINE_CLASS =
	"outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

/** Nav pill depth on `bg-card` about column. */
const STILLS_NAV_PILL_CLASS =
	"shadow-[0_0_0_1px_rgba(255,255,255,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]";

/** One widescreen still per viewport — centered via leading/trailing rail spacers. */
const STILL_SLIDE_WIDTH_CLASS = "w-[min(56rem,92vw)]";
/** Horizontal edge softening — hides harsh clip where peeking slides meet page padding. */
const STILL_RAIL_X_FADE_CLASS =
	"[mask-image:linear-gradient(to_right,transparent_0,black_10rem,black_calc(100%-10rem),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_10rem,black_calc(100%-10rem),transparent_100%)]";

/** Cinematic rail height — 16:9 frame plus vertical breathing room. */
const STILL_RAIL_MIN_HEIGHT_CLASS = "min-h-[min(24rem,52vh)]";

/** Space between still slides — margin on 2+ items only (spacers must stay flush). */
const STILL_SLIDE_GAP_CLASS = "ml-28 sm:ml-36 md:ml-40";

/** Half the leftover scrollport width so the first/last snap targets sit centered. */
const STILL_RAIL_EDGE_SPACER_CLASS =
	"w-[max(1.25rem,calc((100cqw-min(56rem,92vw))/2))]";

function StillsRailEdgeSpacer() {
	return (
		<li
			aria-hidden
			className={cn(
				STILL_RAIL_EDGE_SPACER_CLASS,
				"pointer-events-none shrink-0 list-none",
			)}
		/>
	);
}

/** Inactive carousel slides — same dim/blur treatment as the reviews rail. */
const STILL_SLIDE_INACTIVE_CLASS =
	"opacity-45 blur-[3px] scale-[0.98] motion-reduce:blur-none motion-reduce:scale-100";

/** Show per-slide dots up to this count; larger sets use a page counter instead. */
const STILLS_CAROUSEL_MAX_DOTS = 16;

function StillsCarouselNavigation({
	totalSlides,
	activeSlideIndex,
	onPrev,
	onNext,
	onGoto,
}: {
	totalSlides: number;
	activeSlideIndex: number;
	onPrev: () => void;
	onNext: () => void;
	onGoto: (index: number) => void;
}) {
	const reduceMotion = useReducedMotion();
	const atStart = activeSlideIndex === 0;
	const atEnd = activeSlideIndex === totalSlides - 1;
	const useDotStrip = totalSlides <= STILLS_CAROUSEL_MAX_DOTS;

	return (
		<div
			className={cn(
				"mx-auto mt-4 flex w-fit max-w-full touch-manipulation items-center gap-2 rounded-full bg-background px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2",
				STILLS_NAV_PILL_CLASS,
			)}
			role="toolbar"
			aria-label="Background navigation"
		>
			<DetailMotionButton
				type="button"
				className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-opacity duration-150 ease-out [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-30 [@media(hover:hover)]:hover:opacity-80"
				onClick={onPrev}
				disabled={atStart}
				aria-label="Previous background"
			>
				<ChevronLeft className="size-5 -translate-x-px" aria-hidden />
			</DetailMotionButton>

			{useDotStrip ? (
				<div
					className="scrollbar-none flex max-w-[min(100%,20rem)] items-center justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
					role="tablist"
					aria-label="Background pages"
				>
					{Array.from({ length: totalSlides }, (_, pageIndex) => {
						const isActive = pageIndex === activeSlideIndex;
						return (
							<motion.button
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length pagination dots, order never changes
								key={pageIndex}
								type="button"
								role="tab"
								aria-selected={isActive}
								aria-label={`Background ${pageIndex + 1} of ${totalSlides}`}
								className="relative flex size-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
								whileTap={reduceMotion ? undefined : { scale: 0.96 }}
								onClick={() => onGoto(pageIndex)}
							>
								<motion.span
									aria-hidden
									className={cn(
										"block h-2 rounded-full",
										isActive
											? "bg-foreground"
											: "bg-muted-foreground/40 [@media(hover:hover)]:hover:bg-muted-foreground/60",
									)}
									layout
									transition={
										reduceMotion
											? { duration: 0 }
											: {
													type: "spring",
													stiffness: 400,
													damping: 28,
													bounce: 0,
												}
									}
									animate={{ width: isActive ? 16 : 8 }}
								/>
							</motion.button>
						);
					})}
				</div>
			) : (
				<p className="min-w-[5rem] px-1 text-center font-medium text-foreground text-sm tabular-nums">
					{activeSlideIndex + 1}
					<span className="text-muted-foreground"> / {totalSlides}</span>
				</p>
			)}

			<DetailMotionButton
				type="button"
				className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-opacity duration-150 ease-out [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-30 [@media(hover:hover)]:hover:opacity-80"
				onClick={onNext}
				disabled={atEnd}
				aria-label="Next background"
			>
				<ChevronRight className="size-5 translate-x-px" aria-hidden />
			</DetailMotionButton>
		</div>
	);
}

function MovieDetailStillSlide({
	slide,
	slideIndex,
	titleSlug,
	isActive,
	className,
}: {
	slide: MovieDetailHeroSlide;
	slideIndex: number;
	titleSlug: string;
	isActive: boolean;
	className?: string;
}) {
	const [downloading, setDownloading] = useState(false);
	const downloadUrl = slide.srcFull ?? slide.src;

	const handleDownload = useCallback(
		async (event: MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			if (downloading) return;
			setDownloading(true);
			try {
				await downloadTmdbImage(
					downloadUrl,
					tmdbImageDownloadFilename(titleSlug, slideIndex + 1),
				);
			} finally {
				setDownloading(false);
			}
		},
		[downloadUrl, downloading, slideIndex, titleSlug],
	);

	return (
		<li
			data-still-slide
			className={cn(
				STILL_SLIDE_WIDTH_CLASS,
				"group/still shrink-0 list-none transition-[opacity,filter,transform] duration-(--page-fade-dur) ease-(--page-fade-ease) motion-reduce:transition-none",
				!isActive && STILL_SLIDE_INACTIVE_CLASS,
				className,
			)}
		>
			<figure className="relative aspect-video overflow-hidden rounded-[1.5rem] bg-background shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem] md:rounded-[1.75rem]">
				<Image
					src={slide.src}
					alt={slide.label}
					fill
					className={cn("object-cover", STILL_IMAGE_OUTLINE_CLASS)}
					sizes="(max-width: 768px) 92vw, 56rem"
					draggable={false}
				/>
				{isActive ? (
					<DetailMotionButton
						type="button"
						iconSwapKey={downloading ? "loading" : "idle"}
						className={cn(
							// Overlay on stills — opaque wash; inset from rounded frame (concentric spacing).
							"absolute right-3.5 bottom-3.5 z-10 inline-flex min-h-10 select-none items-center gap-1.5 rounded-full bg-background/92 px-3.5 py-2 font-medium text-foreground text-xs backdrop-blur-sm [-webkit-tap-highlight-color:transparent]",
							"disabled:opacity-70 [@media(hover:hover)]:hover:bg-background",
						)}
						disabled={downloading}
						aria-label="Download full resolution"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={handleDownload}
					>
						{downloading ? (
							<Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
						) : (
							<Download className="size-3.5 shrink-0" aria-hidden />
						)}
						<span className="hidden sm:inline">Full resolution</span>
					</DetailMotionButton>
				) : null}
			</figure>
		</li>
	);
}

/**
 * Movie / TV detail — editorial backgrounds rail (TMDb backdrops).
 * Matches reviews carousel snap, wheel, and inactive-slide treatment.
 */
export function MovieDetailStillsCarousel({
	screenshots,
	titleSlug,
	className,
}: {
	screenshots: MovieDetailHeroSlide[];
	/** Film/show title for download filenames. */
	titleSlug: string;
	className?: string;
}) {
	const {
		railRef,
		activeSlideIndex,
		totalSlides,
		gotoSlide,
		nextSlide,
		prevSlide,
	} = useDetailEditorialRailSnap({
		slideCount: screenshots.length,
		slideSelector: "[data-still-slide]",
	});

	if (screenshots.length === 0) return null;

	const showNavigation = totalSlides > 1;

	return (
		<div className={cn("flex flex-col", className)}>
			<section
				className={cn(
					"relative isolate",
					"-mx-2.5 w-[calc(100%+1.25rem)] sm:-mx-4 sm:w-[calc(100%+2rem)] md:-mx-5 md:w-[calc(100%+2.5rem)]",
					"xl:-mx-28 xl:w-[calc(100%+14rem)] 2xl:-mx-32 2xl:w-[calc(100%+16rem)]",
				)}
				aria-label="Backgrounds"
			>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r from-0% from-card via-30% via-card/90 to-transparent sm:w-32 md:w-40 xl:w-48"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l from-0% from-card via-30% via-card/90 to-transparent sm:w-32 md:w-40 xl:w-48"
				/>

				<div
					ref={railRef}
					className={cn(
						"@container flex min-w-0 overflow-x-auto overscroll-x-contain",
						STILL_RAIL_MIN_HEIGHT_CLASS,
						STILL_RAIL_X_FADE_CLASS,
						"scrollbar-none items-center [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
					)}
				>
					<ul className="flex min-h-full w-max items-stretch">
						<StillsRailEdgeSpacer />
						{screenshots.map((slide, index) => (
							<MovieDetailStillSlide
								key={slide.key}
								slide={slide}
								slideIndex={index}
								titleSlug={titleSlug}
								isActive={index === activeSlideIndex}
								className={index > 0 ? STILL_SLIDE_GAP_CLASS : undefined}
							/>
						))}
						<StillsRailEdgeSpacer />
					</ul>
				</div>
			</section>

			{showNavigation ? (
				<StillsCarouselNavigation
					totalSlides={totalSlides}
					activeSlideIndex={activeSlideIndex}
					onPrev={prevSlide}
					onNext={nextSlide}
					onGoto={gotoSlide}
				/>
			) : null}
		</div>
	);
}

/** About-tab backgrounds rail when TMDb backdrops exist. */
export function MovieDetailStillsSection({
	screenshots,
	title,
	className,
}: {
	screenshots: MovieDetailHeroSlide[];
	title: string;
	className?: string;
}) {
	if (screenshots.length === 0) return null;

	return (
		<MovieDetailStillsCarousel
			screenshots={screenshots}
			titleSlug={title}
			className={className}
		/>
	);
}
