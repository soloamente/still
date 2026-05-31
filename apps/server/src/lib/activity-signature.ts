/** Rolling diary window shown on patron profiles (GitHub-style grid). */
export const ACTIVITY_SIGNATURE_WEEKS = 52;
export const ACTIVITY_SIGNATURE_DAYS = ACTIVITY_SIGNATURE_WEEKS * 7;

/** Intensity cap for heatmap color steps (0 = empty … 4 = busiest). */
export const ACTIVITY_SIGNATURE_LEVEL_CAP = 4;

export type ActivitySignatureDay = {
	/** UTC calendar date `YYYY-MM-DD`. */
	date: string;
	/** Raw log rows that day (may exceed level cap). */
	count: number;
	/** Color step 0–4 derived from `count`. */
	level: number;
};

export type ActivitySignatureWeek = {
	/** Monday UTC `YYYY-MM-DD` for column label. */
	weekStart: string;
	days: ActivitySignatureDay[];
};

export type ActivitySignaturePayload = {
	weeks: ActivitySignatureWeek[];
	totalDaysActive: number;
	totalLogs: number;
};

export function activityLevelFromCount(count: number): number {
	if (count <= 0) return 0;
	return Math.min(count, ACTIVITY_SIGNATURE_LEVEL_CAP);
}

/** UTC date key for grouping diary rows. */
export function utcDateKeyFromWatchedAt(value: Date | string): string {
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return "";
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function parseUtcDateKey(key: string): Date {
	return new Date(`${key}T00:00:00.000Z`);
}

function addUtcDays(key: string, days: number): string {
	const d = parseUtcDateKey(key);
	d.setUTCDate(d.getUTCDate() + days);
	return utcDateKeyFromWatchedAt(d);
}

/** Monday (UTC) on or before `dateKey`. */
export function utcWeekStartMonday(dateKey: string): string {
	const d = parseUtcDateKey(dateKey);
	const dow = d.getUTCDay();
	const offset = dow === 0 ? -6 : 1 - dow;
	d.setUTCDate(d.getUTCDate() + offset);
	return utcDateKeyFromWatchedAt(d);
}

/**
 * Build 52×7 UTC grid ending today — one intensity cell per calendar day.
 */
export function buildActivitySignature(
	watchedAtValues: ReadonlyArray<Date | string>,
	now: Date = new Date(),
): ActivitySignaturePayload {
	const endKey = utcDateKeyFromWatchedAt(now);
	const startKey = addUtcDays(endKey, -(ACTIVITY_SIGNATURE_DAYS - 1));

	const counts = new Map<string, number>();
	for (const raw of watchedAtValues) {
		const key = utcDateKeyFromWatchedAt(raw);
		if (!key) continue;
		if (key < startKey || key > endKey) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	let totalLogs = 0;
	let totalDaysActive = 0;
	for (const count of counts.values()) {
		if (count > 0) {
			totalDaysActive += 1;
			totalLogs += count;
		}
	}

	// Anchor the grid on the week that contains `endKey` so the final column is always "now".
	const gridEndMonday = utcWeekStartMonday(endKey);
	const gridStartMonday = addUtcDays(
		gridEndMonday,
		-(ACTIVITY_SIGNATURE_WEEKS - 1) * 7,
	);
	const weeks: ActivitySignatureWeek[] = [];

	for (let w = 0; w < ACTIVITY_SIGNATURE_WEEKS; w += 1) {
		const weekStart = addUtcDays(gridStartMonday, w * 7);
		const days: ActivitySignatureDay[] = [];
		for (let d = 0; d < 7; d += 1) {
			const date = addUtcDays(weekStart, d);
			const count =
				date >= startKey && date <= endKey ? (counts.get(date) ?? 0) : 0;
			days.push({
				date,
				count,
				level: activityLevelFromCount(count),
			});
		}
		weeks.push({ weekStart, days });
	}

	return { weeks, totalDaysActive, totalLogs };
}
