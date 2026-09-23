const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Spec: notify when release is upcoming within this many UTC calendar days. */
const UPCOMING_NOTIFY_DAYS = 30;
/** Spec: notify when release was within this many UTC calendar days in the past. */
const PAST_NOTIFY_DAYS = 7;

/** Parse TMDb `YYYY-MM-DD` (or ISO) as a UTC calendar day start; null if invalid. */
function utcDayStartFromIso(
	releaseDateIso: string | null | undefined,
): number | null {
	if (releaseDateIso == null) return null;
	const trimmed = releaseDateIso.trim();
	if (!trimmed) return null;
	// Prefer date-only so local TZ does not shift the calendar day.
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
	if (dateOnly) {
		const year = Number(dateOnly[1]);
		const month = Number(dateOnly[2]);
		const day = Number(dateOnly[3]);
		const ms = Date.UTC(year, month - 1, day);
		if (Number.isNaN(ms)) return null;
		return ms;
	}
	const parsed = Date.parse(trimmed);
	if (Number.isNaN(parsed)) return null;
	const d = new Date(parsed);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function utcDayStartFromDate(now: Date): number {
	return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * True when a credit’s theatrical / first-air date is in the notify window:
 * upcoming ≤30 UTC days or past ≤7 UTC days (inclusive).
 */
export function isPersonFavoriteReleaseInNotifyWindow(
	releaseDateIso: string | null | undefined,
	now: Date = new Date(),
): boolean {
	const releaseDay = utcDayStartFromIso(releaseDateIso);
	if (releaseDay == null) return false;
	const today = utcDayStartFromDate(now);
	const deltaDays = Math.round((releaseDay - today) / MS_PER_DAY);
	if (deltaDays >= 0) return deltaDays <= UPCOMING_NOTIFY_DAYS;
	return -deltaDays <= PAST_NOTIFY_DAYS;
}
