/** Module-level active voice review — only one clip plays at a time across the app. */
let activeReviewAudio: HTMLAudioElement | null = null;

export function claimReviewAudioPlayback(next: HTMLAudioElement): void {
	if (
		activeReviewAudio &&
		activeReviewAudio !== next &&
		!activeReviewAudio.paused
	) {
		activeReviewAudio.pause();
		activeReviewAudio.currentTime = 0;
	}
	activeReviewAudio = next;
}

export function releaseReviewAudioPlayback(audio: HTMLAudioElement): void {
	if (activeReviewAudio === audio) {
		activeReviewAudio = null;
	}
}
