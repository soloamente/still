import type { HomeCommunityActivityItem } from "@/lib/home-community-activity";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";

type LeaderboardPeriod = HomeLeaderboardPeriod;

function normalizeLeaderboardTimeZone(raw: string | undefined): string {
	const tz = raw?.trim();
	if (!tz) return "UTC";
	try {
		Intl.DateTimeFormat(undefined, { timeZone: tz });
		return tz;
	} catch {
		return "UTC";
	}
}

type ZonedParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	const map = Object.fromEntries(
		formatter.formatToParts(date).map((p) => [p.type, p.value]),
	);
	return {
		year: Number(map.year),
		month: Number(map.month),
		day: Number(map.day),
		hour: Number(map.hour),
		minute: Number(map.minute),
		second: Number(map.second),
	};
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
	const utc = date.getTime();
	const p = getZonedParts(date, timeZone);
	const asUtc = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	return asUtc - utc;
}

function wallTimeToUtc(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second: number,
	timeZone: string,
): Date {
	let utc = Date.UTC(year, month - 1, day, hour, minute, second);
	for (let i = 0; i < 4; i++) {
		const offset = getTimeZoneOffsetMs(timeZone, new Date(utc));
		const next = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
		if (next === utc) break;
		utc = next;
	}
	return new Date(utc);
}

function isoWeekday(year: number, month: number, day: number): number {
	const d = new Date(Date.UTC(year, month - 1, day));
	const js = d.getUTCDay();
	return js === 0 ? 7 : js;
}

function addMonths(
	year: number,
	month: number,
	delta: number,
): { year: number; month: number } {
	let m = month + delta;
	let y = year;
	while (m > 12) {
		m -= 12;
		y += 1;
	}
	while (m < 1) {
		m += 12;
		y -= 1;
	}
	return { year: y, month: m };
}

function startOfPeriodInZone(
	period: Exclude<LeaderboardPeriod, "all">,
	parts: ZonedParts,
): { year: number; month: number; day: number } {
	if (period === "month") {
		return { year: parts.year, month: parts.month, day: 1 };
	}
	if (period === "year") {
		return { year: parts.year, month: 1, day: 1 };
	}
	const wd = isoWeekday(parts.year, parts.month, parts.day);
	const day = parts.day - (wd - 1);
	if (day >= 1) return { year: parts.year, month: parts.month, day };
	const prev = addMonths(parts.year, parts.month, -1);
	const daysInPrev = new Date(prev.year, prev.month, 0).getDate();
	return { year: prev.year, month: prev.month, day: daysInPrev + day };
}

function endOfPeriodInZone(
	period: Exclude<LeaderboardPeriod, "all">,
	start: { year: number; month: number; day: number },
): { year: number; month: number; day: number } {
	if (period === "month") {
		const next = addMonths(start.year, start.month, 1);
		return { year: next.year, month: next.month, day: 1 };
	}
	if (period === "year") {
		return { year: start.year + 1, month: 1, day: 1 };
	}
	const wd = isoWeekday(start.year, start.month, start.day);
	const day = start.day + (8 - wd);
	const daysInMonth = new Date(start.year, start.month, 0).getDate();
	if (day <= daysInMonth) {
		return { year: start.year, month: start.month, day };
	}
	const next = addMonths(start.year, start.month, 1);
	return { year: next.year, month: next.month, day: day - daysInMonth };
}

/** Half-open `[start, end)` — mirrors server `resolveLeaderboardWindow`. */
export function resolveCommunityPeriodWindow(
	period: LeaderboardPeriod,
	tzRaw?: string,
	now = new Date(),
): { start: Date; end: Date } {
	const timeZone = normalizeLeaderboardTimeZone(tzRaw ?? readViewerTimeZone());

	if (period === "all") {
		return { start: new Date(0), end: now };
	}

	const parts = getZonedParts(now, timeZone);
	const startWall = startOfPeriodInZone(period, parts);
	const endWall = endOfPeriodInZone(period, startWall);

	const start = wallTimeToUtc(
		startWall.year,
		startWall.month,
		startWall.day,
		0,
		0,
		0,
		timeZone,
	);
	const end = wallTimeToUtc(
		endWall.year,
		endWall.month,
		endWall.day,
		0,
		0,
		0,
		timeZone,
	);

	return { start, end };
}

export function isTimestampInCommunityPeriod(
	raw: string | Date,
	period: LeaderboardPeriod,
	tzRaw?: string,
	now = new Date(),
): boolean {
	const ts = new Date(raw).getTime();
	if (Number.isNaN(ts)) return false;
	const { start, end } = resolveCommunityPeriodWindow(period, tzRaw, now);
	return ts >= start.getTime() && ts < end.getTime();
}

export function filterListSeedsByCommunityPeriod(
	seeds: ListLobbySeed[],
	period: LeaderboardPeriod,
): ListLobbySeed[] {
	return seeds.filter((row) =>
		isTimestampInCommunityPeriod(row.updatedAt, period),
	);
}

export function filterReviewsByCommunityPeriod<
	T extends { publishedAt: string },
>(reviews: T[], period: LeaderboardPeriod): T[] {
	return reviews.filter((row) =>
		isTimestampInCommunityPeriod(row.publishedAt, period),
	);
}

export function filterActivityByCommunityPeriod(
	items: HomeCommunityActivityItem[],
	period: LeaderboardPeriod,
): HomeCommunityActivityItem[] {
	return items.filter((item) => isTimestampInCommunityPeriod(item.at, period));
}
