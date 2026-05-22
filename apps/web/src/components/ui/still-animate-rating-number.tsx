"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { AnimateNumber } from "motion-plus/react";

import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
	logRatingToDisplay,
} from "@/lib/log-rating";

/** Patron score ticker — layout + digit roll when the value prop updates. */
const PATRON_SCORE_NUMBER_TRANSITION = {
	layout: { duration: 0.3, ease: "easeOut" as const },
	y: { type: "spring" as const, visualDuration: 0.45, bounce: 0.12 },
	opacity: { duration: 0.2, ease: "easeOut" as const },
};

function toPatronDisplayScore(storedOrAverage: number): number {
	const display = logRatingToDisplay(storedOrAverage);
	return clampLogRatingDisplay(display ?? storedOrAverage);
}

/**
 * Still 0–10 patron score with Motion+ digit animation (community average, hero metrics).
 */
export function StillAnimateRatingNumber({
	value,
	className,
	"aria-hidden": ariaHidden,
}: {
	value: number;
	className?: string;
	"aria-hidden"?: boolean;
}) {
	const reducedMotion = useReducedMotion();
	const displayScore = toPatronDisplayScore(value);

	if (reducedMotion) {
		return (
			<span className={className} aria-hidden={ariaHidden}>
				{formatLogRatingDisplay(displayScore)}
			</span>
		);
	}

	return (
		<AnimateNumber
			aria-hidden={ariaHidden}
			className={cn("inline-flex tabular-nums", className)}
			// Patron scores always use a dot decimal (matches formatLogRatingDisplay / toFixed).
			locales="en-US"
			format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
			transition={PATRON_SCORE_NUMBER_TRANSITION}
		>
			{displayScore}
		</AnimateNumber>
	);
}
