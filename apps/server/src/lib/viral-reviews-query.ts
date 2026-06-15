import { review } from "@still/db";
import { type SQL, sql } from "drizzle-orm";

/** Wit-sized reviews — body ≤280 chars or title-only one-liners. */
export const VIRAL_REVIEW_MAX_BODY_LENGTH = 280;

export const VIRAL_REVIEWS_DEFAULT_LIMIT = 6;
export const VIRAL_REVIEWS_MAX_LIMIT = 12;

export function isViralReviewCandidate(input: {
	body: string | null | undefined;
	title: string | null | undefined;
}): boolean {
	const body = input.body?.trim() ?? "";
	const title = input.title?.trim() ?? "";
	if (body.length > VIRAL_REVIEW_MAX_BODY_LENGTH) return false;
	if (body.length > 0) return true;
	return title.length > 0;
}

/** SQL predicate matching {@link isViralReviewCandidate} for `review` rows. */
export function viralReviewCandidateSql(): SQL {
	return sql`(
		length(trim(coalesce(${review.body}, ''))) <= ${VIRAL_REVIEW_MAX_BODY_LENGTH}
		AND (
			length(trim(coalesce(${review.body}, ''))) > 0
			OR length(trim(coalesce(${review.title}, ''))) > 0
		)
	)`;
}

export function parseViralReviewsLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return VIRAL_REVIEWS_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), VIRAL_REVIEWS_MAX_LIMIT);
}
