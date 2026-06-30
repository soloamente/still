/**
 * Leaderboard period windows — half-open [start, end) in UTC for SQL filters.
 * Uses IANA zones via Intl; invalid zones fall back to UTC.
 */

export type LeaderboardPeriod = "week" | "month" | "year" | "all";

export function parseLeaderboardPeriod(
	raw: string | undefined,
): LeaderboardPeriod {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "week" || s === "month" || s === "year" || s === "all") return s;
	return "month";
}

/** Normalize client `tz` — IANA name or `UTC`. */
export function normalizeLeaderboardTimeZone(raw: string | undefined): string {
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

/** Offset of `timeZone` at `date`: local instant minus UTC (ms). */
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

/** Wall-clock in `timeZone` → UTC Date. */
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

/** ISO weekday: Mon=1 … Sun=7 from calendar y-m-d. */
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
	// ISO week — Monday 00:00
	const wd = isoWeekday(parts.year, parts.month, parts.day);
	const day = parts.day - (wd - 1);
	if (day >= 1) return { year: parts.year, month: parts.month, day };
	// Previous month spill
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
	// Next Monday
	const wd = isoWeekday(start.year, start.month, start.day);
	const day = start.day + (8 - wd);
	const daysInMonth = new Date(start.year, start.month, 0).getDate();
	if (day <= daysInMonth) {
		return { year: start.year, month: start.month, day };
	}
	const next = addMonths(start.year, start.month, 1);
	return { year: next.year, month: next.month, day: day - daysInMonth };
}

/** Half-open [start, end) for SQL `watched_at >= start AND watched_at < end`. */
export function resolveLeaderboardWindow(
	period: LeaderboardPeriod,
	tzRaw: string | undefined,
	now = new Date(),
): { start: Date; end: Date } {
	const timeZone = normalizeLeaderboardTimeZone(tzRaw);

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

/**
 * Half-open window for the calendar month immediately before `now` in `tz`.
 * Used by the month-recap dialog (e.g. first July visit → celebrate all of June).
 */
export function resolvePreviousCalendarMonthWindow(
	tzRaw: string | undefined,
	now = new Date(),
): { start: Date; end: Date } {
	const timeZone = normalizeLeaderboardTimeZone(tzRaw);
	const parts = getZonedParts(now, timeZone);
	const celebrated = addMonths(parts.year, parts.month, -1);
	const startWall = {
		year: celebrated.year,
		month: celebrated.month,
		day: 1,
	};
	const endWall = endOfPeriodInZone("month", startWall);

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

/** `YYYY-MM` key for the celebrated month (from window start in `tz`). */
export function celebratedMonthKeyFromWindow(
	start: Date,
	tzRaw: string | undefined,
): string {
	const timeZone = normalizeLeaderboardTimeZone(tzRaw);
	const parts = getZonedParts(start, timeZone);
	const month = String(parts.month).padStart(2, "0");
	return `${parts.year}-${month}`;
}

/** Human label for a `YYYY-MM` month key — e.g. `June 2026`. */
export function celebratedMonthLabel(monthKey: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
	if (!match) return monthKey;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		month < 1 ||
		month > 12
	) {
		return monthKey;
	}
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(year, month - 1, 1, 12, 0, 0));
}
