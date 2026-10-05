/** TMDb release types — theatrical limited, theatrical, digital. */
const THEATRICAL_TYPES = new Set([2, 3]);
const DIGITAL_TYPE = 4;

type ReleaseRow = {
	type?: number;
	release_date?: unknown;
};

type ReleaseDatesPayload = {
	results?: Array<{
		iso_3166_1?: string;
		release_dates?: ReleaseRow[];
	}>;
};

function dayStamp(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const day = raw.trim().slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function formatReleaseDay(ymd: string): string {
	const date = new Date(`${ymd}T00:00:00Z`);
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(date);
}

function earliestOnOrAfter(
	rows: ReleaseRow[],
	types: Set<number>,
	todayYmd: string,
): string | null {
	let best: string | null = null;
	for (const row of rows) {
		if (row.type == null || !types.has(row.type)) continue;
		const day = dayStamp(row.release_date);
		if (!day || day < todayYmd) continue;
		if (!best || day < best) best = day;
	}
	return best;
}

function regionReleaseRows(tmdbJson: unknown, region: string): ReleaseRow[] {
	if (!tmdbJson || typeof tmdbJson !== "object") return [];
	const payload = (tmdbJson as { release_dates?: ReleaseDatesPayload })
		.release_dates;
	const code = region.trim().toUpperCase();
	const block = payload?.results?.find(
		(entry) => entry.iso_3166_1?.trim().toUpperCase() === code,
	);
	return block?.release_dates ?? [];
}

/**
 * Poster line for a film that is not streaming yet but has a known opening
 * in the patron region — theatrical first when it is the sooner date.
 */
export function upcomingWatchlistReleaseLabel(
	tmdbJson: unknown,
	region: string,
	todayYmd: string,
): string | null {
	const rows = regionReleaseRows(tmdbJson, region);
	if (rows.length === 0) return null;
	const theatrical = earliestOnOrAfter(rows, THEATRICAL_TYPES, todayYmd);
	const digital = earliestOnOrAfter(rows, new Set([DIGITAL_TYPE]), todayYmd);
	if (!theatrical && !digital) return null;
	if (theatrical && (!digital || theatrical <= digital)) {
		return `In cinemas ${formatReleaseDay(theatrical)}`;
	}
	if (!digital) return null;
	return `Streaming ${formatReleaseDay(digital)}`;
}
