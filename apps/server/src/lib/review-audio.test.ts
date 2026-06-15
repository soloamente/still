import { describe, expect, test } from "bun:test";

import {
	assertReviewAudioUpload,
	buildReviewAudioBlobKey,
	isReviewAudioMimeType,
	REVIEW_AUDIO_MAX_BYTES,
	REVIEW_AUDIO_MAX_DURATION_MS,
	reviewAudioExtensionForMime,
} from "./review-audio";

describe("assertReviewAudioUpload", () => {
	test("rejects oversize file", () => {
		expect(
			assertReviewAudioUpload({
				size: REVIEW_AUDIO_MAX_BYTES + 1,
				type: "audio/webm",
				durationMs: 30_000,
			}).ok,
		).toBe(false);
	});

	test("rejects duration over 90s", () => {
		expect(
			assertReviewAudioUpload({
				size: 1000,
				type: "audio/webm",
				durationMs: REVIEW_AUDIO_MAX_DURATION_MS + 1,
			}).ok,
		).toBe(false);
	});

	test("rejects unsupported mime", () => {
		const result = assertReviewAudioUpload({
			size: 1000,
			type: "audio/wav",
			durationMs: 30_000,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe("INVALID_MIME");
	});

	test("accepts valid webm", () => {
		expect(
			assertReviewAudioUpload({
				size: 1000,
				type: "audio/webm",
				durationMs: 45_000,
			}).ok,
		).toBe(true);
	});
});

describe("review audio helpers", () => {
	test("isReviewAudioMimeType", () => {
		expect(isReviewAudioMimeType("audio/webm")).toBe(true);
		expect(isReviewAudioMimeType("audio/wav")).toBe(false);
	});

	test("buildReviewAudioBlobKey", () => {
		expect(buildReviewAudioBlobKey("usr_1", "rev_2", "audio/mp4")).toBe(
			"reviews/usr_1/rev_2.mp4",
		);
	});

	test("reviewAudioExtensionForMime", () => {
		expect(reviewAudioExtensionForMime("audio/ogg")).toBe("ogg");
	});
});
