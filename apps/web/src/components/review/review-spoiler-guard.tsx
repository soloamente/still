"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import {
	REVIEW_SPOILER_REVEAL_CTA,
	shouldMaskReviewSpoilers,
} from "@/lib/review-spoiler-mask";

const SPOILER_MASK_POST_CLASS =
	"opacity-65 blur-[var(--page-blur)] motion-reduce:blur-none motion-reduce:opacity-100";

/**
 * Masks spoiler-tagged review copy until the patron reveals it or has already
 * watched the title — reuses review-carousel blur + CTA tokens.
 */
export function ReviewSpoilerGuard({
	containsSpoilers,
	hasWatchedMovie,
	isOwnReview = false,
	revealed,
	onReveal,
	children,
	className,
	ctaLabel = REVIEW_SPOILER_REVEAL_CTA,
}: {
	containsSpoilers: boolean;
	hasWatchedMovie: boolean;
	isOwnReview?: boolean;
	revealed: boolean;
	onReveal: () => void;
	children: ReactNode;
	className?: string;
	ctaLabel?: string;
}) {
	const masked = shouldMaskReviewSpoilers({
		containsSpoilers,
		hasWatchedMovie,
		isOwnReview,
		revealed,
	});

	if (!masked) {
		return <>{children}</>;
	}

	return (
		<div className={cn("relative w-full", className)}>
			<button
				type="button"
				className={cn(
					"t-review-slide t-review-slide--spoiler-masked group/spoiler w-full cursor-pointer select-none border-none bg-transparent p-0 text-center",
					"[-webkit-tap-highlight-color:transparent]",
				)}
				aria-label={ctaLabel}
				onClick={(event) => {
					event.stopPropagation();
					onReveal();
				}}
			>
				<div
					className={cn("t-review-slide__post w-full", SPOILER_MASK_POST_CLASS)}
				>
					{children}
				</div>
				<div aria-hidden className="t-review-slide__cta">
					<span className="t-review-slide__cta-label">{ctaLabel}</span>
				</div>
			</button>
		</div>
	);
}
