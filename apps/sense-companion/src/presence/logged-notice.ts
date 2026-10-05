/** Diary row the helper reports after auto logging. */
export type CompanionLoggedNotice = {
	logId: string;
	title: string;
	kind: "movie" | "tv";
	season: number | null;
	episode: number | null;
	seriesFinale: boolean;
};

function readOptionalCount(value: unknown): number | null {
	if (value == null) return null;
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: null;
}

/** The helper sends this once, after Sense writes a diary row. */
export function readCompanionLoggedNotice(
	value: unknown,
): CompanionLoggedNotice | null {
	if (typeof value !== "object" || value === null) return null;
	const notice = value as {
		type?: unknown;
		logId?: unknown;
		title?: unknown;
		kind?: unknown;
		season?: unknown;
		episode?: unknown;
		seriesFinale?: unknown;
	};
	if (notice.type !== "sense-companion:logged") return null;
	if (typeof notice.logId !== "string" || notice.logId.length === 0)
		return null;
	if (typeof notice.title !== "string" || notice.title.length === 0)
		return null;
	if (notice.kind !== "movie" && notice.kind !== "tv") return null;
	return {
		logId: notice.logId,
		title: notice.title,
		kind: notice.kind,
		season: readOptionalCount(notice.season),
		episode: readOptionalCount(notice.episode),
		seriesFinale: notice.seriesFinale === true,
	};
}

/**
 * Episode logs name the season and episode. The series finale names the show.
 * Films keep the title.
 */
export function companionLoggedCopy(notice: CompanionLoggedNotice): string {
	if (notice.kind === "tv" && notice.seriesFinale && notice.title.length > 0) {
		return `Logged whole show, ${notice.title}`;
	}
	if (notice.kind === "tv" && notice.season != null && notice.episode != null) {
		return `Logged S${notice.season} E${notice.episode}`;
	}
	return `Logged ${notice.title}`;
}

/** 0–10 readout. The top of the scale is `10`, not `10.0`. */
export function formatCompanionRatingLabel(display: number): string {
	const clamped = Math.min(10, Math.max(0, Math.round(display * 10) / 10));
	if (Math.round(clamped * 10) >= 100) return "10";
	return clamped.toFixed(1);
}
