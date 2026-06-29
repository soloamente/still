import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";

export type LeaderboardKind = "films" | "tv";

export type LeaderboardEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	count: number;
};

export type LeaderboardPayload = {
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
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
	watchIndexInPeriod: number;
	watchCountInPeriod: number;
};

export type LeaderboardLogsPayload = {
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
	hiddenCount: number;
};
