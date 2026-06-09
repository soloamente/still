"use client";

import { cn } from "@still/ui/lib/utils";
import { Download, Loader2 } from "lucide-react";
import Image from "next/image";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";

import {
	DetailEditorialRailArrowButtons,
	DetailEditorialRailPasito,
} from "@/components/movie/detail-editorial-rail-controls";
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

function MovieDetailStillSlide({
	slide,
	slideIndex,
	titleSlug,
	isActive,
	onSelect,
	shouldSuppressRailClick,
	className,
}: {
	slide: MovieDetailHeroSlide;
	slideIndex: number;
	titleSlug: string;
	isActive: boolean;
	onSelect: () => void;
	shouldSuppressRailClick: () => boolean;
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

	return (
		<li
			data-still-slide
			className={cn(
				STILL_SLIDE_WIDTH_CLASS,
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

				<DetailEditorialRailArrowButtons
					totalSlides={totalSlides}
					activeSlideIndex={activeSlideIndex}
					onPrev={prevSlide}
					onNext={nextSlide}
				/>

				<div
					ref={railRef}
					className={cn(
						"@container flex min-w-0 cursor-grab touch-pan-x overflow-x-auto overscroll-x-contain",
						isDragging && "cursor-grabbing",
						STILL_RAIL_MIN_HEIGHT_CLASS,
						STILL_RAIL_X_FADE_CLASS,
						"scrollbar-none select-none items-center [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
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
								onSelect={() => gotoSlide(index)}
								shouldSuppressRailClick={shouldSuppressRailClick}
								className={index > 0 ? STILL_SLIDE_GAP_CLASS : undefined}
							/>
						))}
						<StillsRailEdgeSpacer />
					</ul>
				</div>
			</section>

			<DetailEditorialRailPasito
				totalSlides={totalSlides}
				activeSlideIndex={activeSlideIndex}
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
