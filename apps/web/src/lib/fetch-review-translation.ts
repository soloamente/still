/**
 * Client helper for `POST /api/reviews/:id/translate`.
 */

import { api } from "@/lib/api";
import {
	normalizeReviewTranslationResult,
	type ReviewTranslationResult,
} from "@/lib/review-translation-result";

export type { ReviewTranslationResult };

/**
 * Request a translation. Throws with a short patron-facing message on failure
 * so the drawer can toast and leave the original text in place.
 */
export async function fetchReviewTranslation(input: {
	reviewId: string;
	language: string;
}): Promise<ReviewTranslationResult> {
	const res = await api.api.reviews({ id: input.reviewId }).translate.post({
		language: input.language,
	});

	if (res.error) {
		const status =
			typeof res.error === "object" &&
			res.error !== null &&
			"status" in res.error
				? Number((res.error as { status?: number }).status)
				: undefined;
		if (status === 429) {
			throw new Error("Slow down — try again in a minute.");
		}
		if (status === 503) {
			throw new Error("Translation is not available right now.");
		}
		if (status === 401) {
			throw new Error("Sign in to translate reviews.");
		}
		throw new Error("Couldn't translate this review — try again.");
	}

	const normalized = normalizeReviewTranslationResult(res.data);
	if (!normalized) {
		throw new Error("Couldn't translate this review — try again.");
	}
	return normalized;
}
