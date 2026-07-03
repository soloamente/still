"use client";

import { cn } from "@still/ui/lib/utils";
import type { KeyboardEvent, ReactNode } from "react";

import {
	REVIEW_SPOILER_REVEAL_CTA,
	shouldMaskReviewSpoilers,
} from "@/lib/review-spoiler-mask";

/** Shared blur token for masked spoiler copy — carousel + feed previews. */
export const SPOILER_MASK_POST_CLASS =
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
	align = "center",
	nestedInInteractive = false,
}: {
	containsSpoilers: boolean;
	hasWatchedMovie: boolean;
	isOwnReview?: boolean;
	revealed: boolean;
	onReveal: () => void;
	children: ReactNode;
	className?: string;
	ctaLabel?: string;
	align?: "start" | "center";
	/** Parent is already a button/link — use a plain div tap target (no nested button). */
	nestedInInteractive?: boolean;
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

	const handleReveal = (event: { stopPropagation: () => void }) => {
		event.stopPropagation();
		onReveal();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		handleReveal(event);
	};

	const maskShellClass = cn(
		"t-review-slide t-review-slide--spoiler-masked group/spoiler w-full cursor-pointer select-none p-0",
		align === "center" ? "text-center" : "text-left",
		"[-webkit-tap-highlight-color:transparent]",
	);

	const maskContent = (
		<>
			<div
				className={cn("t-review-slide__post w-full", SPOILER_MASK_POST_CLASS)}
			>
				{children}
			</div>
			<div aria-hidden className="t-review-slide__cta">
				<span className="t-review-slide__cta-label">{ctaLabel}</span>
			</div>
		</>
	);

	return (
		<div className={cn("relative w-full", className)}>
			{nestedInInteractive ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: parent card button owns keyboard activation
				// biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only reveal inside card buttons
				<div className={maskShellClass} onClick={handleReveal}>
					{maskContent}
				</div>
			) : (
				// biome-ignore lint/a11y/useSemanticElements: standalone feed rows — not nested in buttons
				<div
					role="button"
					tabIndex={0}
					className={maskShellClass}
					aria-label={ctaLabel}
					onClick={handleReveal}
					onKeyDown={handleKeyDown}
				>
					{maskContent}
				</div>
			)}
		</div>
	);
}
