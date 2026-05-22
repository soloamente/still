"use client";

import { cn } from "@still/ui/lib/utils";
import {
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { useEffect } from "react";

import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
	logRatingToDisplay,
} from "@/lib/log-rating";

/** Patron score spring — matches prior Motion+ ticker feel without motion-plus. */
const PATRON_SCORE_SPRING = {
	type: "spring" as const,
	visualDuration: 0.45,
	bounce: 0.12,
};

function toPatronDisplayScore(storedOrAverage: number): number {
	const display = logRatingToDisplay(storedOrAverage);
	return clampLogRatingDisplay(display ?? storedOrAverage);
}

/**
 * Still 0–10 patron score with a smooth numeric tween (community average, hero metrics).
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
	const motionScore = useMotionValue(displayScore);
	const label = useTransform(motionScore, (current) =>
		formatLogRatingDisplay(clampLogRatingDisplay(current)),
	);

	useEffect(() => {
		if (reducedMotion) {
			return;
		}
		const controls = animate(motionScore, displayScore, PATRON_SCORE_SPRING);
		return () => controls.stop();
	}, [displayScore, motionScore, reducedMotion]);

	if (reducedMotion) {
		return (
			<span className={className} aria-hidden={ariaHidden}>
				{formatLogRatingDisplay(displayScore)}
			</span>
		);
	}

	return (
		<motion.span
			aria-hidden={ariaHidden}
			className={cn("inline-flex tabular-nums", className)}
		>
			{label}
		</motion.span>
	);
}
