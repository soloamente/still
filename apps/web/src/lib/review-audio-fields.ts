/** Optional voice attachment fields on review API payloads (camelCase). */
export type ReviewAudioFields = {
	audioUrl?: string | null;
	audioDurationMs?: number | null;
};

export function hasReviewVoiceAudio(review: ReviewAudioFields): boolean {
	return Boolean(review.audioUrl?.trim());
}

/** Hide empty body blocks on voice-only reviews while keeping text+voice reviews readable. */
export function shouldShowReviewBody(review: { body: string }): boolean {
	return review.body.trim().length > 0;
}

export function resolveReviewAudioDurationMs(
	durationMs: number | null | undefined,
): number {
	return typeof durationMs === "number" && durationMs > 0 ? durationMs : 0;
}
