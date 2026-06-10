/**
 * Client types + mirrors for Sense creator recognition (SN.11).
 * Server logic lives in `apps/server/src/lib/creator-recognition.ts`.
 */

import type { DiaryMetalTier } from "@/lib/diary-metal-tier";

export const REVIEW_ENGAGEMENT_LIKE_WEIGHT = 2;
export const REVIEW_ENGAGEMENT_COMMENT_WEIGHT = 3;

export interface CuratorSpotlightPatron {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	headline: string;
	spotlightScore: number;
}

export interface ProfileCreatorRecognition {
	isCurator: boolean;
	headline: string | null;
}

export function reviewEngagementScore(
	likesCount: number,
	commentsCount: number,
): number {
	return (
		likesCount * REVIEW_ENGAGEMENT_LIKE_WEIGHT +
		commentsCount * REVIEW_ENGAGEMENT_COMMENT_WEIGHT
	);
}
