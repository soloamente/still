"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DetailArtworkPasitoStepper } from "@/components/movie/detail-artwork-pasito-stepper";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const EDITORIAL_RAIL_MAX_VISIBLE_STEPS = 16;

const RAIL_FOOTER_NAV_BUTTON_CLASS = cn(
	"inline-flex size-11 shrink-0 select-none items-center justify-center rounded-full border-transparent bg-background/90 text-foreground backdrop-blur-sm [-webkit-tap-highlight-color:transparent]",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"disabled:pointer-events-none disabled:opacity-35",
);

/**
 * Editorial rail footer — prev / Pasito / next on one row below the carousel.
 * Keeps controls out of the fixed section-nav gutter (overlay chevrons overlapped the legend).
 */
export function DetailEditorialRailFooterControls({
	totalSlides,
	activeSlideIndex,
	onPrev,
	onNext,
	onGoto,
	ariaLabel,
	className,
}: {
	totalSlides: number;
	activeSlideIndex: number;
	onPrev: () => void;
	onNext: () => void;
	onGoto: (index: number) => void;
	ariaLabel: string;
	className?: string;
}) {
	if (totalSlides <= 1) return null;

	const atStart = activeSlideIndex <= 0;
	const atEnd = activeSlideIndex >= totalSlides - 1;

	return (
		<div
			className={cn(
				"mx-auto mt-4 flex items-center justify-center gap-3",
				className,
			)}
		>
			<DetailMotionButton
				type="button"
				data-rail-nav
				className={RAIL_FOOTER_NAV_BUTTON_CLASS}
				aria-label="Previous slide"
				disabled={atStart}
				onClick={onPrev}
			>
				<ChevronLeft className="size-5" aria-hidden />
			</DetailMotionButton>

			<div role="tablist" aria-label={ariaLabel}>
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

			<DetailMotionButton
				type="button"
				data-rail-nav
				className={RAIL_FOOTER_NAV_BUTTON_CLASS}
				aria-label="Next slide"
				disabled={atEnd}
				onClick={onNext}
			>
				<ChevronRight className="size-5" aria-hidden />
			</DetailMotionButton>
		</div>
	);
}
