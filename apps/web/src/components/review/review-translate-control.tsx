"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	fetchReviewTranslation,
	type ReviewTranslationResult,
} from "@/lib/fetch-review-translation";
import { reviewLanguageDisplayName } from "@/lib/review-translation-language";
import { useReviewTranslationLanguage } from "@/lib/use-review-translation-language";

export type ReviewTranslationView = {
	title: string | null;
	body: string;
};

type Props = {
	reviewId: string;
	/** From GET /api/reviews/:id — engine ready ∧ source known ∧ non-empty body. */
	canTranslate: boolean;
	sourceLanguage: string | null | undefined;
	/** Hide for unsigned patrons and for the review's author. */
	enabled: boolean;
	/** Called when the reader should swap to translated or original copy. */
	onViewChange: (view: ReviewTranslationView | null) => void;
};

/**
 * Full-read translate control for the review drawer.
 * Idle: "Translate to English". After success: "Translated from Japanese · Show original".
 * Failures toast and leave the original text untouched.
 */
export function ReviewTranslateControl({
	reviewId,
	canTranslate,
	sourceLanguage,
	enabled,
	onViewChange,
}: Props) {
	const targetLanguage = useReviewTranslationLanguage(enabled && canTranslate);
	const [busy, setBusy] = useState(false);
	const [showingTranslated, setShowingTranslated] = useState(false);
	const [cached, setCached] = useState<ReviewTranslationView | null>(null);
	// Keep the latest callback without resetting state when the parent re-renders.
	const onViewChangeRef = useRef(onViewChange);
	onViewChangeRef.current = onViewChange;

	const sourceTag = sourceLanguage?.trim().toLowerCase() || null;
	const needsTranslation =
		Boolean(sourceTag) && sourceTag !== targetLanguage && canTranslate;

	// Parent mounts this with `key={reviewId}` so open-review changes remount
	// and clear cached translation without an effect.

	const showOriginal = useEffectEvent(() => {
		setShowingTranslated(false);
		onViewChangeRef.current(null);
	});

	const applyTranslation = useEffectEvent((view: ReviewTranslationView) => {
		setCached(view);
		setShowingTranslated(true);
		onViewChangeRef.current(view);
	});

	async function handleTranslate() {
		if (busy) return;
		// Re-show a cached translation without another model call.
		if (cached) {
			applyTranslation(cached);
			return;
		}

		setBusy(true);
		try {
			const result: ReviewTranslationResult = await fetchReviewTranslation({
				reviewId,
				language: targetLanguage,
			});
			if (result.status === "same_language") {
				// Server says nothing to do — leave the original text alone.
				toast.message("This review is already in your language");
				return;
			}
			applyTranslation({ title: result.title, body: result.body });
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Couldn't translate this review — try again.";
			toast.error(message);
			// Leave original text in place — do not call onViewChange.
		} finally {
			setBusy(false);
		}
	}

	if (!enabled || !needsTranslation) return null;

	const targetName = reviewLanguageDisplayName(targetLanguage, targetLanguage);
	const sourceName = sourceTag
		? reviewLanguageDisplayName(sourceTag, targetLanguage)
		: null;

	if (showingTranslated && sourceName) {
		return (
			<div className="mb-6 flex justify-center">
				<p className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 rounded-full bg-background px-3.5 py-2 text-center text-muted-foreground text-sm">
					<span>Translated from {sourceName}</span>
					<span aria-hidden>·</span>
					<button
						type="button"
						className={cn(
							"rounded-full px-1 font-medium text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						onClick={showOriginal}
					>
						Show original
					</button>
				</p>
			</div>
		);
	}

	return (
		<div className="mb-6 flex justify-center">
			<button
				type="button"
				disabled={busy}
				aria-busy={busy}
				className={cn(
					"inline-flex min-h-10 select-none items-center justify-center gap-2 rounded-full bg-background px-4 font-medium text-foreground text-sm transition-colors duration-200 ease-out disabled:opacity-60 motion-reduce:transition-none",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
				)}
				onClick={() => void handleTranslate()}
			>
				{busy ? (
					<>
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
						Translating…
					</>
				) : cached ? (
					"Show translation"
				) : (
					`Translate to ${targetName}`
				)}
			</button>
		</div>
	);
}
