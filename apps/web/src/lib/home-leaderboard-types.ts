import type { PlanTierId } from "@still/plans";

import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { StaffRole } from "@/lib/staff-role-labels";

export type LeaderboardKind = "films" | "tv" | "episodes";

export type LeaderboardEntry = {
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
};

export type LeaderboardPayload = {
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
	page: number;
	limit: number;
	nextPage: number | null;
	entries: LeaderboardEntry[];
	viewer: { rank: number; count: number } | null;
};

export type LeaderboardLogItem = {
	logId: string;
	watchedAt: string;
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	rating: number | null;
	rewatch: boolean;
	/** TV diary scope — Episodes ledger may include season/show rows. */
	logScope?: "show" | "season" | "episode" | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	/** Episode-equivalent weight when this row expands a season/show log. */
	episodeWeight?: number;
	watchIndexInPeriod: number;
	watchCountInPeriod: number;
	/** All-time watch ordinal for this title (1 = first watch ever). */
	watchIndexLifetime: number;
	/** Total diary logs for this title (all time). */
	watchCountLifetime: number;
};

export type LeaderboardLogsPayload = {
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
		planTier: PlanTierId;
		staffRole: StaffRole | null;
	};
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
	hiddenCount: number;
};
