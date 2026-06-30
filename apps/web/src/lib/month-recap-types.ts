import type { DiaryMetalTier } from "@/lib/diary-metal-tier";

export type MonthRecapCategoryId = "films" | "tv" | "reviews";

export type MonthRecapEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	count: number;
};

export type MonthRecapCategory = {
	id: MonthRecapCategoryId;
	title: string;
	entries: MonthRecapEntry[];
};

export type MonthRecapPayload = {
	monthKey: string;
	monthLabel: string;
	tz: string;
	window: { start: string; end: string };
	categories: MonthRecapCategory[];
};
