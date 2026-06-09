"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DetailArtworkPasitoStepper } from "@/components/movie/detail-artwork-pasito-stepper";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const EDITORIAL_RAIL_MAX_VISIBLE_STEPS = 16;

const RAIL_NAV_BUTTON_CLASS = cn(
	"absolute top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border-transparent bg-background/90 text-foreground shadow-sm backdrop-blur-sm [-webkit-tap-highlight-color:transparent]",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"disabled:pointer-events-none disabled:opacity-35",
);

/** Overlay chevrons — grab the rail for drag scroll; use buttons for stepped prev/next. */
export function DetailEditorialRailArrowButtons({
	totalSlides,
	activeSlideIndex,
	onPrev,
	onNext,
}: {
	totalSlides: number;
	activeSlideIndex: number;
	onPrev: () => void;
	onNext: () => void;
}) {
	if (totalSlides <= 1) return null;

	const atStart = activeSlideIndex <= 0;
	const atEnd = activeSlideIndex >= totalSlides - 1;

	return (
		<>
			<DetailMotionButton
				type="button"
				data-rail-nav
				className={cn(
					RAIL_NAV_BUTTON_CLASS,
					"left-3 sm:left-4 md:left-5 xl:left-8",
				)}
				aria-label="Previous slide"
				disabled={atStart}
				onClick={onPrev}
			>
				<ChevronLeft className="size-5" aria-hidden />
			</DetailMotionButton>
			<DetailMotionButton
				type="button"
				data-rail-nav
				className={cn(
					RAIL_NAV_BUTTON_CLASS,
					"right-3 sm:right-4 md:right-5 xl:right-8",
				)}
				aria-label="Next slide"
				disabled={atEnd}
				onClick={onNext}
			>
				<ChevronRight className="size-5" aria-hidden />
			</DetailMotionButton>
		</>
	);
}

/** Pasito stepper row under the rail — click any dot to jump. */
export function DetailEditorialRailPasito({
	totalSlides,
	activeSlideIndex,
	onGoto,
	ariaLabel,
	className,
}: {
	totalSlides: number;
	activeSlideIndex: number;
	onGoto: (index: number) => void;
	ariaLabel: string;
	className?: string;
}) {
	if (totalSlides <= 1) return null;

	return (
		<div
			className={cn("mx-auto mt-4 flex justify-center", className)}
			role="tablist"
			aria-label={ariaLabel}
		>
			<DetailArtworkPasitoStepper
				count={totalSlides}
				active={activeSlideIndex}
				onStepClick={onGoto}
				maxVisible={
					totalSlides > EDITORIAL_RAIL_MAX_VISIBLE_STEPS
						? EDITORIAL_RAIL_MAX_VISIBLE_STEPS
						: undefined
				}
			/>
		</div>
	);
}
