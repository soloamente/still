/** Voice review duration limits — keep in sync with server `review-audio.ts`. */
export const REVIEW_AUDIO_MAX_DURATION_MS = 90_000;
export const REVIEW_AUDIO_MIN_DURATION_MS = 3_000;

/** Format milliseconds as `m:ss` for player and recorder labels. */
export function formatReviewAudioDurationLabel(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
