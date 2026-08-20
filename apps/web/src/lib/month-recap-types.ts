import type { PlanTierId } from "@still/plans";

import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { StaffRole } from "@/lib/staff-role-labels";

export type MonthRecapCategoryId = "films" | "tv" | "reviews";

export type MonthRecapEntry = {
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
