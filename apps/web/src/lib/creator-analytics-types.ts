/** Mirrors `GET /api/profiles/me/creator-analytics` payload. */
export interface CreatorContributionStats {
	publicListsCount: number;
	describedPublicListsCount: number;
	totalListLikes: number;
	publicReviewsCount: number;
	totalReviewLikes: number;
}

export interface CreatorListHighlight {
	id: string;
	title: string;
	likesCount: number;
	updatedAt: string;
	hasDescription: boolean;
}

export interface CreatorAnalyticsPayload {
	headline: string;
	stats: CreatorContributionStats;
	topLists: CreatorListHighlight[];
}
