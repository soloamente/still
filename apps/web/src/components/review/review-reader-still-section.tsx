"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

/** Inset still edge — matches movie detail screenshots rail. */
const STILL_IMAGE_OUTLINE_CLASS =
	"outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

/**
 * Review reader hero still — owner picks from TMDb backdrops; visitors see saved choice.
 */
export function ReviewReaderStillSection({
	slides,
	selectedKey,
	isOwner,
	saving,
	onSelect,
}: {
	slides: MovieDetailHeroSlide[];
	selectedKey: string | null;
	isOwner: boolean;
	saving: boolean;
	onSelect: (slideKey: string) => void;
}) {
	const pickerScrollRef = useRef<HTMLDivElement>(null);
	const pickerContentKey = slides.map((slide) => slide.key).join("\0");
	const pickerRailEnabled = isOwner && slides.length > 0;
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		pickerScrollRef,
		pickerRailEnabled,
		pickerContentKey,
	);

	if (slides.length === 0) return null;

	// Visitors only see a still after the author saves a pick.
	if (!isOwner && !selectedKey) return null;

	const activeSlide = selectedKey
		? (slides.find((slide) => slide.key === selectedKey) ?? null)
		: null;

	if (!isOwner && !activeSlide) return null;

	return (
		<section
			className="mb-6 w-full"
			aria-label={isOwner ? "Review movie still" : undefined}
		>
			{activeSlide ? (
				<figure className="relative aspect-video overflow-hidden rounded-[1.5rem] bg-background">
					<Image
						src={activeSlide.src}
						alt={activeSlide.label}
						fill
						sizes="(max-width: 768px) 100vw, 42rem"
						className="object-cover"
						unoptimized
						priority
					/>
					{saving ? (
						<div className="absolute inset-0 grid place-items-center bg-background/40">
							<Loader2
								className="size-6 animate-spin text-muted-foreground"
								aria-label="Saving still"
							/>
						</div>
					) : null}
				</figure>
			) : isOwner ? (
				<figure
					className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[1.5rem] bg-background px-6 text-center"
					aria-label="No still selected"
				>
					<p className="max-w-xs text-balance text-muted-foreground text-sm leading-relaxed">
						Click on a still to set it
					</p>
				</figure>
			) : null}

			{isOwner ? (
				<div className="mt-3">
					<p className="mb-2 text-center text-muted-foreground text-xs">
						Choose a movie still
					</p>
					<div className="relative min-w-0 overflow-hidden">
						<div
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card via-card/80 to-transparent motion-reduce:transition-none",
								showStartFade ? "opacity-100" : "opacity-0",
							)}
						/>
						<div
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-card via-card/85 to-transparent motion-reduce:transition-none",
								showEndFade ? "opacity-100" : "opacity-0",
							)}
						/>
						<div
							ref={pickerScrollRef}
							data-lenis-prevent-wheel
							data-vaul-no-drag
							className={HORIZONTAL_OVERFLOW_RAIL_CLASSNAME}
						>
							{slides.map((slide) => {
								const isSelected = selectedKey === slide.key;
								return (
									<button
										key={slide.key}
										type="button"
										className={cn(
											"relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-background transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100",
											STILL_IMAGE_OUTLINE_CLASS,
											isSelected
												? "opacity-100"
												: "opacity-70 hover:opacity-100",
										)}
										aria-label={`Use still: ${slide.label}`}
										aria-pressed={isSelected}
										disabled={saving}
										onClick={() => onSelect(slide.key)}
									>
										<Image
											src={slide.src}
											alt=""
											fill
											sizes="112px"
											className="object-cover"
											unoptimized
										/>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}
