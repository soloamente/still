import {
	buildFeedbackNotificationHref,
	feedbackIdFromNotificationPayload,
} from "@/lib/feedback-notification-href";
import { buildQuoteSubmissionNotificationHref } from "@/lib/quotes-lobby";
import {
	buildMovieReviewHref,
	parseLegacyReviewPagePath,
} from "@/lib/review-deep-link";

/** Deep link from a notification `payload` when the server stored `href`. */
export function notificationPayloadHref(
	payload: Record<string, unknown> | null | undefined,
): string | undefined {
	if (!payload) return undefined;

	const href = payload.href;
	if (typeof href === "string" && href.startsWith("/")) {
		const legacy = parseLegacyReviewPagePath(href);
		const movieId = payload.movieId;
		if (legacy && typeof movieId === "number" && Number.isFinite(movieId)) {
			return buildMovieReviewHref(movieId, legacy.reviewId);
		}
		return href;
	}

	const reviewId = payload.reviewId;
	const movieId = payload.movieId;
	const commentId = payload.commentId;
	if (
		typeof reviewId === "string" &&
		reviewId.length > 0 &&
		typeof movieId === "number" &&
		Number.isFinite(movieId)
	) {
		return buildMovieReviewHref(
			movieId,
			reviewId,
			typeof commentId === "string" ? commentId : undefined,
		);
	}

	const quoteHref = buildQuoteSubmissionNotificationHref(payload);
	if (quoteHref) return quoteHref;

	const feedbackId = feedbackIdFromNotificationPayload(payload);
	if (feedbackId) return buildFeedbackNotificationHref(feedbackId);

	return undefined;
}

/** Whether the profile URL should auto-open the taste overlap sheet. */
export function profileTasteCompareFromSearch(
	search: string | URLSearchParams,
): boolean {
	const params =
		typeof search === "string" ? new URLSearchParams(search) : search;
	const flag = params.get("tasteCompare");
	return flag === "1" || flag === "true";
}
