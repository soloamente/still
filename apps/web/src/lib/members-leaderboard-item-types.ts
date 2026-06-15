import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { MembersLeaderboardSort } from "@/lib/members-leaderboard-types";

export type MembersLeaderboardLedgerReviewItem = {
	itemKind: "review";
	itemKey: string;
	sortAt: string;
	reviewId: string;
	movieId: number;
	listingTitle: string;
	posterPath: string | null;
	reviewTitle: string | null;
	reviewBody: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
	containsSpoilers: boolean;
	userId: string;
};

export type MembersLeaderboardLedgerLogItem = {
	itemKind: "log";
	itemKey: string;
	sortAt: string;
	logId: string;
	movieId: number;
	listingTitle: string;
	posterPath: string | null;
	reviewId: string | null;
	reviewTitle: string | null;
	reviewBody: string | null;
	rating: number | null;
	likesCount: number | null;
	commentsCount: number | null;
	publishedAt: string | null;
	containsSpoilers: boolean;
	userId: string;
};

export type MembersLeaderboardLedgerListItem = {
	itemKind: "list";
	itemKey: string;
	sortAt: string;
	listId: string;
	title: string;
	posterPath: string | null;
	coverImageUrl: string | null;
	createdAt: string;
};

export type MembersLeaderboardLedgerItem =
	| MembersLeaderboardLedgerReviewItem
	| MembersLeaderboardLedgerLogItem
	| MembersLeaderboardLedgerListItem;

export type MembersLeaderboardItemsPayload = {
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	items: MembersLeaderboardLedgerItem[];
};
