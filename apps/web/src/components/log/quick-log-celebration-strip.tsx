"use client";

import { Button } from "@still/ui/components/button";
import { useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import { SHEET_PRIMARY_PILL_CLASS } from "@/lib/sheet-chrome";

/** Per-character spans for transitions.dev digit pop-in on the logged score. */
function splitRatingLabelDigits(label: string) {
	const chars = label.split("");
	return chars.map((char, index) => ({
		char,
		stagger:
			index === chars.length - 2
				? ("1" as const)
				: index === chars.length - 1
					? ("2" as const)
					: undefined,
	}));
}

function readDigitPopInDurationMs(): number {
	const styles = getComputedStyle(document.documentElement);
	const dur =
		Number.parseFloat(styles.getPropertyValue("--digit-dur").trim()) || 320;
	const stagger =
		Number.parseFloat(styles.getPropertyValue("--digit-stagger").trim()) || 45;
	return dur + stagger * 2 + 32;
}

/**
 * Inline post-log ritual — rating pop-in + optional review CTA (not a modal).
 */
export function QuickLogCelebrationStrip({
	logId,
	title,
	ratingStored,
	canWriteReview,
	onWriteReview,
	onDismiss,
}: {
	logId: string;
	title: string;
	/** Stored diary rating (0–100 tenths); `null` when the log has no score. */
	ratingStored: number | null;
	canWriteReview: boolean;
	onWriteReview: () => void;
	onDismiss: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const digitGroupRef = useRef<HTMLSpanElement>(null);

	const displayRating =
		ratingStored != null ? logRatingToDisplay(ratingStored) : null;
	const ratingLabel =
		displayRating != null ? formatLogRatingDisplay(displayRating) : null;

	useEffect(() => {
		trackSenseProductEvent("post_log.celebrate", {
			logId,
			hasRating: ratingStored != null,
			canWriteReview,
		});
	}, [canWriteReview, logId, ratingStored]);

	useLayoutEffect(() => {
		if (reduceMotion || !ratingLabel) return;
		const group = digitGroupRef.current;
		if (!group) return;

		group.classList.remove("is-animating");
		void group.offsetWidth;
		group.classList.add("is-animating");

		const timer = window.setTimeout(() => {
			group.classList.remove("is-animating");
		}, readDigitPopInDurationMs());

		return () => window.clearTimeout(timer);
	}, [ratingLabel, reduceMotion]);

	const digits =
		ratingLabel != null ? splitRatingLabelDigits(ratingLabel) : null;

	return (
		<section
			className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-4 text-center"
			aria-label="Log saved"
		>
			<div className="space-y-2">
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
					Logged
				</p>
				{title.trim() ? (
					<p className="text-balance font-semibold text-foreground text-lg">
						{title.trim()}
					</p>
				) : null}
			</div>

			{digits ? (
				<span
					ref={digitGroupRef}
					role="img"
					className="t-digit-group font-semibold text-5xl tabular-nums tracking-tight"
					aria-label={`Your rating: ${ratingLabel}`}
				>
					{digits.map((digit, index) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed slots per label length.
							key={index}
							className="t-digit"
							data-stagger={digit.stagger}
						>
							{digit.char}
						</span>
					))}
				</span>
			) : (
				<p className="text-pretty text-muted-foreground text-sm">
					Saved to your diary
				</p>
			)}

			<div className="flex w-full flex-col items-center gap-3">
				{canWriteReview ? (
					<Button
						type="button"
						size="pill"
						className={SHEET_PRIMARY_PILL_CLASS}
						onClick={onWriteReview}
					>
						Write a review
					</Button>
				) : (
					<Button
						type="button"
						size="pill"
						className={SHEET_PRIMARY_PILL_CLASS}
						onClick={onDismiss}
					>
						Done
					</Button>
				)}

				{canWriteReview ? (
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className="text-muted-foreground"
						onClick={onDismiss}
					>
						Not now
					</Button>
				) : null}
			</div>
		</section>
	);
}
