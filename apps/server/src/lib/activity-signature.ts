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

/** Paginated chunk — includes grid bounds for infinite scroll API. */
export type ActivitySignatureChunkPayload = ActivitySignaturePayload & {
	rangeStart: string;
	rangeEnd: string;
};

export type BuildActivitySignatureChunkOptions = {
	watchedAtValues: ReadonlyArray<Date | string>;
	/** UTC date key — chunk covers days strictly before this date. */
	beforeExclusive?: string;
	weeks?: number;
	now?: Date;
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

/** Shift a UTC calendar day key by `days` (negative = earlier). */
export function addUtcDays(key: string, days: number): string {
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
 * Build a UTC week-column grid ending before `beforeExclusive`.
 * Used for paginated profile diary rhythm (infinite horizontal scroll).
 */
export function buildActivitySignatureChunk({
	watchedAtValues,
	beforeExclusive,
	weeks = ACTIVITY_SIGNATURE_WEEKS,
	now = new Date(),
}: BuildActivitySignatureChunkOptions): ActivitySignatureChunkPayload {
	const weekCount = Math.min(
		ACTIVITY_SIGNATURE_WEEKS,
		Math.max(1, Math.floor(weeks)),
	);
	const endKey = utcDateKeyFromWatchedAt(now);
	const beforeKey = beforeExclusive ?? addUtcDays(endKey, 1);
	const rangeEnd = addUtcDays(beforeKey, -1);

	const counts = new Map<string, number>();
	for (const raw of watchedAtValues) {
		const key = utcDateKeyFromWatchedAt(raw);
		if (!key) continue;
		if (key > rangeEnd) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	// Anchor the grid on the week that contains `rangeEnd`.
	const gridEndMonday = utcWeekStartMonday(rangeEnd);
	const gridStartMonday = addUtcDays(gridEndMonday, -(weekCount - 1) * 7);
	const rangeStart = gridStartMonday;

	let totalLogs = 0;
	let totalDaysActive = 0;
	for (const [dateKey, count] of counts.entries()) {
		if (dateKey < rangeStart || dateKey > rangeEnd) continue;
		if (count > 0) {
			totalDaysActive += 1;
			totalLogs += count;
		}
	}

	const weeksOut: ActivitySignatureWeek[] = [];

	for (let w = 0; w < weekCount; w += 1) {
		const weekStart = addUtcDays(gridStartMonday, w * 7);
		const days: ActivitySignatureDay[] = [];
		for (let d = 0; d < 7; d += 1) {
			const date = addUtcDays(weekStart, d);
			const count =
				date >= rangeStart && date <= rangeEnd ? (counts.get(date) ?? 0) : 0;
			days.push({
				date,
				count,
				level: activityLevelFromCount(count),
			});
		}
		weeksOut.push({ weekStart, days });
	}

	return {
		weeks: weeksOut,
		totalDaysActive,
		totalLogs,
		rangeStart,
		rangeEnd,
	};
}

/**
 * Build 52×7 UTC grid ending today — one intensity cell per calendar day.
 */
export function buildActivitySignature(
	watchedAtValues: ReadonlyArray<Date | string>,
	now: Date = new Date(),
): ActivitySignaturePayload {
	const chunk = buildActivitySignatureChunk({
		watchedAtValues,
		weeks: ACTIVITY_SIGNATURE_WEEKS,
		now,
	});
	return {
		weeks: chunk.weeks,
		totalDaysActive: chunk.totalDaysActive,
		totalLogs: chunk.totalLogs,
	};
}
