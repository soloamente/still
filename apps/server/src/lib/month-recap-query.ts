import type { DiaryMetalTier } from "./diary-metal-tier";
import {
	celebratedMonthKeyFromWindow,
	celebratedMonthLabel,
	normalizeLeaderboardTimeZone,
	resolvePreviousCalendarMonthWindow,
} from "./leaderboard-period";
import { fetchLeaderboard, type LeaderboardEntry } from "./leaderboard-query";
import {
	fetchMembersLeaderboard,
	type MembersLeaderboardEntry,
} from "./members-leaderboard-query";

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

type MonthRecapCategoryInput = {
	id: MonthRecapCategoryId;
	title: string;
	entries: MonthRecapEntry[];
};

/** Drop empty leaderboards — month recap skips slides with no qualifying patrons. */
export function buildMonthRecapCategories(
	inputs: MonthRecapCategoryInput[],
): MonthRecapCategory[] {
	return inputs
		.filter((category) => category.entries.length > 0)
		.map(({ id, title, entries }) => ({ id, title, entries }));
}

function mapLeaderboardEntries(
	entries: LeaderboardEntry[] | MembersLeaderboardEntry[],
): MonthRecapEntry[] {
	return entries.map((entry) => ({
		rank: entry.rank,
		userId: entry.userId,
		handle: entry.handle,
		displayName: entry.displayName,
		image: entry.image,
		avatarIsAnimated: entry.avatarIsAnimated,
		diaryMetalTier: entry.diaryMetalTier,
		count: entry.count,
	}));
}

const MONTH_RECAP_TOP_N = 3;

/**
 * Global winners for the calendar month before `now` in the patron timezone.
 */
export async function fetchMonthRecap(opts: {
	tz: string | undefined;
	viewerId: string | null;
	now?: Date;
}): Promise<MonthRecapPayload> {
	const tz = normalizeLeaderboardTimeZone(opts.tz);
	const { start, end } = resolvePreviousCalendarMonthWindow(tz, opts.now);
	const monthKey = celebratedMonthKeyFromWindow(start, tz);
	const monthLabel = celebratedMonthLabel(monthKey);
	const window = { start, end };
	const fetchBase = {
		period: "month" as const,
		tz,
		viewerId: opts.viewerId,
		window,
		limit: MONTH_RECAP_TOP_N,
		now: opts.now,
	};

	const [films, tv, reviews] = await Promise.all([
		fetchLeaderboard({ kind: "films", ...fetchBase }),
		fetchLeaderboard({ kind: "tv", ...fetchBase }),
		fetchMembersLeaderboard({
			sort: "reviews",
			...fetchBase,
			page: 1,
		}),
	]);

	const categories = buildMonthRecapCategories([
		{
			id: "films",
			title: "Most films watched",
			entries: mapLeaderboardEntries(films.entries),
		},
		{
			id: "tv",
			title: "Most TV watched",
			entries: mapLeaderboardEntries(tv.entries),
		},
		{
			id: "reviews",
			title: "Most reviews published",
			entries: mapLeaderboardEntries(reviews.items),
		},
	]);

	return {
		monthKey,
		monthLabel,
		tz,
		window: { start: start.toISOString(), end: end.toISOString() },
		categories,
	};
}
