import { env } from "@still/env/server";

/**
 * Local / QA thresholds for SN.11 — production stays strict.
 * Set `CREATOR_RECOGNITION_STRICT=true` in dev to exercise production gates.
 */
export function creatorRecognitionRelaxed(): boolean {
	if (process.env.CREATOR_RECOGNITION_STRICT === "true") {
		return false;
	}
	if (env.NODE_ENV === "development") {
		return true;
	}
	return process.env.CREATOR_RECOGNITION_RELAXED === "true";
}

export interface CreatorRecognitionThresholds {
	minPublicLists: number;
	minDescribedPublicLists: number;
	minTotalListLikes: number;
	minPublicReviews: number;
	minTotalReviewLikes: number;
	minPublicListsForSpotlightAgg: number;
}

export function creatorRecognitionThresholds(): CreatorRecognitionThresholds {
	if (creatorRecognitionRelaxed()) {
		return {
			minPublicLists: 1,
			minDescribedPublicLists: 1,
			minTotalListLikes: 1,
			minPublicReviews: 1,
			minTotalReviewLikes: 2,
			minPublicListsForSpotlightAgg: 1,
		};
	}
	return {
		minPublicLists: 3,
		minDescribedPublicLists: 2,
		minTotalListLikes: 25,
		minPublicReviews: 5,
		minTotalReviewLikes: 15,
		minPublicListsForSpotlightAgg: 2,
	};
}
