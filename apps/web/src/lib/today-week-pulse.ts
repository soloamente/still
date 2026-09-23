/** Mirrors server `TodayWeekPulse` (`GET /api/today/week`). Pure — no env / fetch. */
export type TodayWeekPulse = {
	titlesLogged: number;
	titlesRated: number;
	/** Mon→Sun in the patron timezone. */
	dayMarks: boolean[];
	empty: boolean;
};

/**
 * Device IANA timezone cookie so the RSC seed uses the patron's week, not UTC.
 * Written by the client card after the first mismatch refetch.
 */
export const TODAY_TZ_COOKIE = "still-tz";

/** Fire after a diary log is created/removed so the week card refetches. */
export const TODAY_WEEK_REFRESH_EVENT = "still:today-week-refresh";

/** Stable ids — single-letter labels repeat (T/S), so never key by label. */
export const TODAY_WEEK_DAYS = [
	{ id: "mon", short: "M", long: "Monday" },
	{ id: "tue", short: "T", long: "Tuesday" },
	{ id: "wed", short: "W", long: "Wednesday" },
	{ id: "thu", short: "T", long: "Thursday" },
	{ id: "fri", short: "F", long: "Friday" },
	{ id: "sat", short: "S", long: "Saturday" },
	{ id: "sun", short: "S", long: "Sunday" },
] as const;

export function todayWeekPulseHeadline(pulse: TodayWeekPulse): string {
	if (pulse.empty) return "Your week starts with one log.";
	const logged = `${pulse.titlesLogged} ${pulse.titlesLogged === 1 ? "title" : "titles"} logged`;
	// Calm tone: omit the rated segment instead of showing "0 rated".
	return pulse.titlesRated > 0
		? `${logged} · ${pulse.titlesRated} rated`
		: logged;
}

/** Screen-reader summary for the seven day marks. */
export function todayWeekPulseMarksLabel(dayMarks: readonly boolean[]): string {
	const days = TODAY_WEEK_DAYS.filter((_, i) => dayMarks[i]).map((d) => d.long);
	if (days.length === 0) return "No watches yet this week";
	if (days.length === 1) return `Watched on ${days[0]}`;
	return `Watched on ${days.slice(0, -1).join(", ")} and ${days.at(-1)}`;
}

export function dispatchTodayWeekRefresh(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(TODAY_WEEK_REFRESH_EVENT));
}
