"use client";

import { cn } from "@still/ui/lib/utils";
import { Download, Loader2 } from "lucide-react";
import Image from "next/image";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";

import { DetailEditorialRailFooterControls } from "@/components/movie/detail-editorial-rail-controls";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import {
	DETAIL_EDITORIAL_RAIL_EDGE_SCRIM_LEFT_CLASS,
	DETAIL_EDITORIAL_RAIL_EDGE_SCRIM_RIGHT_CLASS,
	DETAIL_EDITORIAL_RAIL_SCROLLPORT_CLASS,
	DETAIL_EDITORIAL_RAIL_SLIDE_SNAP_CLASS,
	DETAIL_EDITORIAL_RAIL_X_FADE_CLASS,
	DETAIL_EDITORIAL_STILL_PORTRAIT_RAIL_EDGE_SPACER_CLASS,
	DETAIL_EDITORIAL_STILL_PORTRAIT_SLIDE_WIDTH_CLASS,
	DETAIL_EDITORIAL_STILL_RAIL_EDGE_SPACER_CLASS,
	DETAIL_EDITORIAL_STILL_SLIDE_GAP_CLASS,
	DETAIL_EDITORIAL_STILL_SLIDE_WIDTH_CLASS,
} from "@/lib/detail-editorial-rail-chrome";
import { useDetailEditorialRailSnap } from "@/lib/detail-editorial-rail-snap";
import {
	downloadTmdbImage,
	tmdbImageDownloadFilename,
} from "@/lib/download-tmdb-image";
import { isTmdbCdnUrl } from "@/lib/tmdb-poster-url";

/** Inset image edge — pure black/white at 10% (not tinted neutrals). */
const STILL_IMAGE_OUTLINE_CLASS =
	"outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

/** Cinematic rail height — 16:9 frame plus vertical breathing room. */
const STILL_RAIL_MIN_HEIGHT_CLASS = "min-h-[min(24rem,52vh)]";

function isPortraitStillSlide(slide: MovieDetailHeroSlide): boolean {
	return (
		typeof slide.aspectRatio === "number" &&
		Number.isFinite(slide.aspectRatio) &&
		slide.aspectRatio > 0 &&
		slide.aspectRatio < 1
	);
}

function StillsRailEdgeSpacer({ portrait }: { portrait?: boolean }) {
	return (
		<li
			aria-hidden
			className={cn(
				portrait
					? DETAIL_EDITORIAL_STILL_PORTRAIT_RAIL_EDGE_SPACER_CLASS
					: DETAIL_EDITORIAL_STILL_RAIL_EDGE_SPACER_CLASS,
				"pointer-events-none shrink-0 list-none",
			)}
		/>
	);
}

/** Inactive carousel slides — same dim/blur treatment as the reviews rail. */
const STILL_SLIDE_INACTIVE_CLASS =
	"opacity-45 blur-[3px] scale-[0.98] motion-reduce:blur-none motion-reduce:scale-100";

/** `cover` = cinematic crop (movie/TV backdrops); `contain` = full frame (mixed person gallery). */
export type DetailStillsImageFit = "cover" | "contain";

function MovieDetailStillSlide({
	slide,
	slideIndex,
	titleSlug,
	isActive,
	onSelect,
	shouldSuppressRailClick,
	imageFit = "cover",
	className,
}: {
	slide: MovieDetailHeroSlide;
	slideIndex: number;
	titleSlug: string;
	isActive: boolean;
	onSelect: () => void;
	shouldSuppressRailClick: () => boolean;
	imageFit?: DetailStillsImageFit;
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

	const handleSlideClick = (event: MouseEvent<HTMLLIElement>) => {
		if (isActive || shouldSuppressRailClick()) return;
		if ((event.target as HTMLElement).closest("button")) return;
		onSelect();
	};

	const handleSlideKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
		if (isActive) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		onSelect();
	};

	// Person gallery sends TMDb aspect_ratio so each card matches the image format.
	const aspectRatio =
		typeof slide.aspectRatio === "number" &&
		Number.isFinite(slide.aspectRatio) &&
		slide.aspectRatio > 0
			? slide.aspectRatio
			: null;
	const isPortraitCard = aspectRatio != null && aspectRatio < 1;
	// When the card ratio matches the asset, cover fills cleanly; otherwise contain.
	const objectFitClass =
		aspectRatio != null || imageFit === "cover"
			? "object-cover"
			: "object-contain";

	return (
		<li
			data-still-slide
			className={cn(
				isPortraitCard
					? DETAIL_EDITORIAL_STILL_PORTRAIT_SLIDE_WIDTH_CLASS
					: DETAIL_EDITORIAL_STILL_SLIDE_WIDTH_CLASS,
				DETAIL_EDITORIAL_RAIL_SLIDE_SNAP_CLASS,
				"group/still shrink-0 list-none transition-[opacity,filter,transform] duration-(--page-fade-dur) ease-(--page-fade-ease) motion-reduce:transition-none",
				!isActive && STILL_SLIDE_INACTIVE_CLASS,
				!isActive && "cursor-pointer",
				className,
			)}
			tabIndex={isActive ? -1 : 0}
			aria-label={isActive ? undefined : `Show still: ${slide.label}`}
			onClick={handleSlideClick}
			onKeyDown={handleSlideKeyDown}
		>
			<figure
				className={cn(
					"relative overflow-hidden rounded-[1.5rem] bg-background shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem] md:rounded-[1.75rem]",
					aspectRatio == null && "aspect-video",
				)}
				style={
					aspectRatio != null ? { aspectRatio: String(aspectRatio) } : undefined
				}
			>
				<Image
					src={slide.src}
					alt={slide.label}
					fill
					className={cn(objectFitClass, STILL_IMAGE_OUTLINE_CLASS)}
					sizes={
						isPortraitCard
							? "(max-width: 768px) 70vw, 20rem"
							: "(max-width: 768px) 92vw, 56rem"
					}
					draggable={false}
					// TMDb stills/backdrops — skip Vercel Image Optimization.
					unoptimized={isTmdbCdnUrl(slide.src)}
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
	imageFit = "cover",
	className,
}: {
	screenshots: MovieDetailHeroSlide[];
	/** Film/show title for download filenames. */
	titleSlug: string;
	imageFit?: DetailStillsImageFit;
	className?: string;
}) {
	const {
		railRef,
		activeSlideIndex,
		totalSlides,
		isDragging,
		gotoSlide,
		nextSlide,
		prevSlide,
		shouldSuppressRailClick,
	} = useDetailEditorialRailSnap({
		slideCount: screenshots.length,
		slideSelector: "[data-still-slide]",
	});

	if (screenshots.length === 0) return null;

	const firstSlide = screenshots[0];
	const lastSlide = screenshots[screenshots.length - 1];
	if (!firstSlide || !lastSlide) return null;

	const firstIsPortrait = isPortraitStillSlide(firstSlide);
	const lastIsPortrait = isPortraitStillSlide(lastSlide);

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
					className={DETAIL_EDITORIAL_RAIL_EDGE_SCRIM_LEFT_CLASS}
				/>
				<div
					aria-hidden
					className={DETAIL_EDITORIAL_RAIL_EDGE_SCRIM_RIGHT_CLASS}
				/>

				<div
					ref={railRef}
					className={cn(
						DETAIL_EDITORIAL_RAIL_SCROLLPORT_CLASS,
						isDragging && "cursor-grabbing",
						STILL_RAIL_MIN_HEIGHT_CLASS,
						DETAIL_EDITORIAL_RAIL_X_FADE_CLASS,
					)}
				>
					{/* items-center: mixed portrait/landscape cards share a mid-line, not stretch. */}
					<ul className="flex min-h-full w-max items-center">
						<StillsRailEdgeSpacer portrait={firstIsPortrait} />
						{screenshots.map((slide, index) => (
							<MovieDetailStillSlide
								key={slide.key}
								slide={slide}
								slideIndex={index}
								titleSlug={titleSlug}
								isActive={index === activeSlideIndex}
								onSelect={() => gotoSlide(index)}
								shouldSuppressRailClick={shouldSuppressRailClick}
								imageFit={imageFit}
								className={
									index > 0 ? DETAIL_EDITORIAL_STILL_SLIDE_GAP_CLASS : undefined
								}
							/>
						))}
						<StillsRailEdgeSpacer portrait={lastIsPortrait} />
					</ul>
				</div>
			</section>

			<DetailEditorialRailFooterControls
				totalSlides={totalSlides}
				activeSlideIndex={activeSlideIndex}
				onPrev={prevSlide}
				onNext={nextSlide}
				onGoto={gotoSlide}
				ariaLabel="Background slides"
			/>
		</div>
	);
}

/** About-tab backgrounds rail when TMDb backdrops exist. */
export function MovieDetailStillsSection({
	screenshots,
	title,
	imageFit = "cover",
	className,
}: {
	screenshots: MovieDetailHeroSlide[];
	title: string;
	/** Person galleries pass `contain` so portrait/poster tags are not cropped. */
	imageFit?: DetailStillsImageFit;
	className?: string;
}) {
	if (screenshots.length === 0) return null;

	return (
		<MovieDetailStillsCarousel
			screenshots={screenshots}
			titleSlug={title}
			imageFit={imageFit}
			className={className}
		/>
	);
}
