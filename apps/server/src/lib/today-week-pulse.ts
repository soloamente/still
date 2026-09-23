/**
 * Patron-timezone week window for Today "Your week" pulse (Monday-start ISO week).
 * Pure date helpers — no DB in this module.
 */

type ZonedParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

/** Normalize client `tz` — IANA name or `UTC`. */
function normalizePatronTimeZone(raw: string): string {
	const tz = raw.trim();
	if (!tz) return "UTC";
	try {
		Intl.DateTimeFormat(undefined, { timeZone: tz });
		return tz;
	} catch {
		return "UTC";
	}
}

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

/** Monday 00:00:00 in patron TZ for the week containing `now`. */
function startOfIsoWeekInZone(parts: ZonedParts): {
	year: number;
	month: number;
	day: number;
} {
	const wd = isoWeekday(parts.year, parts.month, parts.day);
	const day = parts.day - (wd - 1);
	if (day >= 1) return { year: parts.year, month: parts.month, day };
	const prev = addMonths(parts.year, parts.month, -1);
	const daysInPrev = new Date(prev.year, prev.month, 0).getDate();
	return { year: prev.year, month: prev.month, day: daysInPrev + day };
}

function addCalendarDays(
	year: number,
	month: number,
	day: number,
	delta: number,
): { year: number; month: number; day: number } {
	const d = new Date(Date.UTC(year, month - 1, day + delta));
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
	};
}

function zonedDayKey(date: Date, timeZone: string): string {
	const p = getZonedParts(date, timeZone);
	const month = String(p.month).padStart(2, "0");
	const day = String(p.day).padStart(2, "0");
	return `${p.year}-${month}-${day}`;
}

/** Monday 00:00 in the patron's IANA timezone for the ISO week containing `now`. */
export function startOfPatronWeek(now: Date, timeZone: string): Date {
	const tz = normalizePatronTimeZone(timeZone);
	const parts = getZonedParts(now, tz);
	const startWall = startOfIsoWeekInZone(parts);
	return wallTimeToUtc(
		startWall.year,
		startWall.month,
		startWall.day,
		0,
		0,
		0,
		tz,
	);
}

/** `YYYY-MM-DD` keys for Mon→Sun of the patron week containing `now` (normalized `tz`). */
function patronWeekDayKeys(now: Date, tz: string): string[] {
	const weekStart = startOfPatronWeek(now, tz);
	const startParts = getZonedParts(weekStart, tz);

	const dayKeysInWeek: string[] = [];
	for (let i = 0; i < 7; i++) {
		const wall = addCalendarDays(
			startParts.year,
			startParts.month,
			startParts.day,
			i,
		);
		const month = String(wall.month).padStart(2, "0");
		const day = String(wall.day).padStart(2, "0");
		dayKeysInWeek.push(`${wall.year}-${month}-${day}`);
	}
	return dayKeysInWeek;
}

/**
 * Seven booleans for Mon→Sun of the current patron week: true when any watch
 * falls on that calendar day in `timeZone`.
 */
export function patronWeekDayMarks(
	watchedAtIsoList: readonly string[],
	timeZone: string,
	now = new Date(),
): boolean[] {
	const tz = normalizePatronTimeZone(timeZone);
	const dayKeysInWeek = patronWeekDayKeys(now, tz);

	const watchedDayKeys = new Set<string>();
	for (const iso of watchedAtIsoList) {
		const parsed = Date.parse(iso);
		if (!Number.isFinite(parsed)) continue;
		watchedDayKeys.add(zonedDayKey(new Date(parsed), tz));
	}

	return dayKeysInWeek.map((key) => watchedDayKeys.has(key));
}

/** Diary log columns the week pulse needs (`rating` in tenths; 0 is a real score). */
export type TodayWeekLogRow = {
	watchedAt: Date | string;
	rating: number | null;
	movieId: number | null;
	tvId: number | null;
};

/** `GET /api/today/week` payload — viewer's own stats only. */
export type TodayWeekPulse = {
	/** Distinct titles (rewatches and TV episode logs of one show collapse). */
	titlesLogged: number;
	/** Distinct titles with at least one scored log this week. */
	titlesRated: number;
	/** Mon→Sun in patron TZ. */
	dayMarks: boolean[];
	empty: boolean;
};

/**
 * Aggregate diary rows into the week pulse. Rows outside the patron week are
 * ignored, so callers may over-fetch around the UTC window.
 */
export function summarizeTodayWeekPulse(
	rows: readonly TodayWeekLogRow[],
	timeZone: string,
	now = new Date(),
): TodayWeekPulse {
	const tz = normalizePatronTimeZone(timeZone);
	const dayKeysInWeek = patronWeekDayKeys(now, tz);
	const weekDaySet = new Set(dayKeysInWeek);

	const watchedDayKeys = new Set<string>();
	const loggedTitles = new Set<string>();
	const ratedTitles = new Set<string>();

	for (const row of rows) {
		const at =
			row.watchedAt instanceof Date
				? row.watchedAt
				: new Date(Date.parse(row.watchedAt));
		if (!Number.isFinite(at.getTime())) continue;
		const dayKey = zonedDayKey(at, tz);
		if (!weekDaySet.has(dayKey)) continue;

		const titleKey =
			row.movieId != null ? `movie:${row.movieId}` : `tv:${row.tvId}`;
		watchedDayKeys.add(dayKey);
		loggedTitles.add(titleKey);
		if (row.rating != null) ratedTitles.add(titleKey);
	}

	return {
		titlesLogged: loggedTitles.size,
		titlesRated: ratedTitles.size,
		dayMarks: dayKeysInWeek.map((key) => watchedDayKeys.has(key)),
		empty: loggedTitles.size === 0,
	};
}
