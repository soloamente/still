/** Voice review attachment limits — mirrors MediaRecorder cap in the composer. */
export const REVIEW_AUDIO_MAX_BYTES = 8 * 1024 * 1024;
export const REVIEW_AUDIO_MAX_DURATION_MS = 90_000;

/** Browser MediaRecorder output types we accept on upload. */
export const REVIEW_AUDIO_ALLOWED_MIME_TYPES = [
	"audio/webm",
	"audio/mp4",
	"audio/ogg",
] as const;

export type ReviewAudioMimeType =
	(typeof REVIEW_AUDIO_ALLOWED_MIME_TYPES)[number];

export type ReviewAudioUploadInput = {
	size: number;
	type: string;
	durationMs: number;
};

export type ReviewAudioUploadCheck =
	| { ok: true; mimeType: ReviewAudioMimeType }
	| { ok: false; code: string; message: string };

/** True when the MIME type is one of the allowed voice-review formats. */
export function isReviewAudioMimeType(
	type: string,
): type is ReviewAudioMimeType {
	return (REVIEW_AUDIO_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

/** Map stored MIME to a stable Blob object extension. */
export function reviewAudioExtensionForMime(mime: ReviewAudioMimeType): string {
	switch (mime) {
		case "audio/webm":
			return "webm";
		case "audio/mp4":
			return "mp4";
		case "audio/ogg":
			return "ogg";
		default: {
			const exhaustive: never = mime;
			return exhaustive;
		}
	}
}

/** Deterministic Vercel Blob key — one voice file per review (overwrite on re-upload). */
export function buildReviewAudioBlobKey(
	userId: string,
	reviewId: string,
	mimeType: ReviewAudioMimeType,
): string {
	const ext = reviewAudioExtensionForMime(mimeType);
	return `reviews/${userId}/${reviewId}.${ext}`;
}

/** Validate size, duration, and MIME before touching Blob storage. */
export function assertReviewAudioUpload(
	input: ReviewAudioUploadInput,
): ReviewAudioUploadCheck {
	if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
		return {
			ok: false,
			code: "INVALID_DURATION",
			message: "Invalid duration",
		};
	}
	if (input.durationMs > REVIEW_AUDIO_MAX_DURATION_MS) {
		return {
			ok: false,
			code: "DURATION_TOO_LONG",
			message: "Audio must be 90 seconds or less",
		};
	}
	if (input.size > REVIEW_AUDIO_MAX_BYTES) {
		return {
			ok: false,
			code: "FILE_TOO_LARGE",
			message: "File too large (max 8MB)",
		};
	}
	if (!isReviewAudioMimeType(input.type)) {
		return {
			ok: false,
			code: "INVALID_MIME",
			message: "Unsupported audio format",
		};
	}
	return { ok: true, mimeType: input.type };
}
