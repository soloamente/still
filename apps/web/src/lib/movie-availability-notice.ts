/**
 * Hero copy when a film is not watchable yet in the patron's catalogue region.
 * Festival premieres do not count. Theatrical (limited or wide) and digital do.
 */

type ReleaseDateRow = {
	release_date?: unknown;
	type?: number;
};

type ReleaseDatesPayload = {
	results?: Array<{
		iso_3166_1?: string;
		release_dates?: ReleaseDateRow[];
	}>;
} | null;

const THEATRICAL_TYPES = [2, 3];
const DIGITAL_TYPE = 4;

const UNRELEASED_STATUSES = new Set([
	"Rumored",
	"Planned",
	"In Production",
	"Post Production",
]);

export type MovieNotYetAvailableCopy = {
	/** "Not available yet." */
	lead: string;
	/** "In theaters Jan 14, 2027." — omitted when no date is known. */
	when: string | null;
};

function dayStamp(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		const trimmed = raw.trim();
		return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed || null;
	}
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		return raw.toISOString().slice(0, 10);
	}
	return null;
}

function utcToday(now: Date): string {
	return now.toISOString().slice(0, 10);
}

function formatAvailabilityDate(ymd: string, today: string): string {
	const [year, month, day] = ymd.split("-").map(Number);
	if (!year || !month || !day) return ymd;
	const date = new Date(year, month - 1, day);
	const sameYear = ymd.slice(0, 4) === today.slice(0, 4);
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		...(sameYear ? {} : { year: "numeric" }),
	}).format(date);
}

function earliestFuture(
	rows: ReleaseDateRow[],
	types: number[],
	today: string,
): string | null {
	let best: string | null = null;
	for (const row of rows) {
		if (row.type == null || !types.includes(row.type)) continue;
		const day = dayStamp(row.release_date);
		if (day == null || day <= today) continue;
		if (best == null || day < best) best = day;
	}
	return best;
}

function hasOpened(
	rows: ReleaseDateRow[],
	types: number[],
	today: string,
): boolean {
	for (const row of rows) {
		if (row.type == null || !types.includes(row.type)) continue;
		const day = dayStamp(row.release_date);
		if (day != null && day <= today) return true;
	}
	return false;
}

function whenLine(
	theatrical: string | null,
	digital: string | null,
	today: string,
): string | null {
	if (theatrical && digital) {
		if (theatrical === digital) {
			return `In theaters and at home ${formatAvailabilityDate(theatrical, today)}.`;
		}
		return `In theaters ${formatAvailabilityDate(theatrical, today)}. At home ${formatAvailabilityDate(digital, today)}.`;
	}
	if (theatrical) {
		return `In theaters ${formatAvailabilityDate(theatrical, today)}.`;
	}
	if (digital) {
		return `At home ${formatAvailabilityDate(digital, today)}.`;
	}
	return null;
}

const NOT_YET: MovieNotYetAvailableCopy["lead"] = "Not available yet.";

/**
 * Null when the film can already be seen in theaters or at home in `region`.
 * With no region, only a future primary release date (or an unreleased TMDb
 * status) produces a line — other countries' dates stay out of the sentence.
 */
export function movieNotYetAvailableCopy(input: {
	releaseDates: ReleaseDatesPayload | undefined;
	region: string | null;
	primaryReleaseDate: unknown;
	status: string | null;
	now?: Date;
}): MovieNotYetAvailableCopy | null {
	const today = utcToday(input.now ?? new Date());
	const region = input.region?.trim().toUpperCase() || null;

	if (region) {
		const rows =
			input.releaseDates?.results?.find(
				(block) => block.iso_3166_1?.toUpperCase() === region,
			)?.release_dates ?? [];
		const opened =
			hasOpened(rows, THEATRICAL_TYPES, today) ||
			hasOpened(rows, [DIGITAL_TYPE], today);
		if (opened) return null;
		if (rows.length === 0) {
			return unreleasedWithoutRegion(
				input.primaryReleaseDate,
				input.status,
				today,
			);
		}
		return {
			lead: NOT_YET,
			when: whenLine(
				earliestFuture(rows, THEATRICAL_TYPES, today),
				earliestFuture(rows, [DIGITAL_TYPE], today),
				today,
			),
		};
	}

	return unreleasedWithoutRegion(input.primaryReleaseDate, input.status, today);
}

function unreleasedWithoutRegion(
	primaryReleaseDate: unknown,
	status: string | null,
	today: string,
): MovieNotYetAvailableCopy | null {
	const primary = dayStamp(primaryReleaseDate);
	if (primary && primary > today) {
		return {
			lead: NOT_YET,
			when: `${formatAvailabilityDate(primary, today)}.`,
		};
	}
	if (status && UNRELEASED_STATUSES.has(status)) {
		return { lead: NOT_YET, when: null };
	}
	return null;
}
