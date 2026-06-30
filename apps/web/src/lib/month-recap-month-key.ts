/** Device IANA timezone for month-recap API `tz` query (matches leaderboard pattern). */
export function resolveClientTimeZone(): string {
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
		return tz && tz.length > 0 ? tz : "UTC";
	} catch {
		return "UTC";
	}
}

function zonedYearMonth(
	date: Date,
	timeZone: string,
): { year: number; month: number } {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "numeric",
	});
	const parts = Object.fromEntries(
		formatter.formatToParts(date).map((part) => [part.type, part.value]),
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
	};
}

function previousCalendarMonth(
	year: number,
	month: number,
): { year: number; month: number } {
	let m = month - 1;
	let y = year;
	if (m < 1) {
		m = 12;
		y -= 1;
	}
	return { year: y, month: m };
}

function formatMonthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

function formatMonthLabel(year: number, month: number): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(year, month - 1, 1, 12, 0, 0));
}

/**
 * Calendar month immediately before `now` in the patron device timezone.
 * Used for localStorage seen keys before the recap API fetch.
 */
export function resolveClientCelebratedMonth(
	now = new Date(),
	timeZone = resolveClientTimeZone(),
): {
	monthKey: string;
	monthLabel: string;
	timeZone: string;
} {
	const current = zonedYearMonth(now, timeZone);
	const celebrated = previousCalendarMonth(current.year, current.month);
	return {
		monthKey: formatMonthKey(celebrated.year, celebrated.month),
		monthLabel: formatMonthLabel(celebrated.year, celebrated.month),
		timeZone,
	};
}
