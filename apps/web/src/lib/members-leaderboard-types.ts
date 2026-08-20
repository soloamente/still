import type { PlanTierId } from "@still/plans";

import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { StaffRole } from "@/lib/staff-role-labels";

/** Mirrors `MembersLeaderboardSort` on the server — keep in sync with API query. */
export type MembersLeaderboardSort = "popular" | "reviews" | "lists" | "likes";

export type MembersLeaderboardEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	planTier: PlanTierId;
	staffRole: StaffRole | null;
	count: number;
	viewerFollows: boolean;
};

export type MembersLeaderboardPayload = {
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
	page: number;
	limit: number;
	nextPage: number | null;
	items: MembersLeaderboardEntry[];
};
