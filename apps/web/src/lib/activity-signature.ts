/** Mirrors `apps/server/src/lib/activity-signature.ts` for profile UI. */

export type ActivitySignatureDay = {
	date: string;
	count: number;
	level: number;
};

export type ActivitySignatureWeek = {
	weekStart: string;
	days: ActivitySignatureDay[];
};

export type ActivitySignaturePayload = {
	weeks: ActivitySignatureWeek[];
	totalDaysActive: number;
	totalLogs: number;
};

/** Coerce API / RSC date shapes to UTC `YYYY-MM-DD` keys. */
export function activityDateKeyFromUnknown(value: unknown): string {
	if (typeof value === "string") {
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.toISOString().slice(0, 10);
		}
		return "";
	}
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	return "";
}

/** Coerce week.day payloads from JSON arrays or numeric-key objects. */
function coerceActivitySignatureDays(days: unknown): ActivitySignatureDay[] {
	if (Array.isArray(days)) return days as ActivitySignatureDay[];
	if (days && typeof days === "object") {
		return Object.values(days as Record<string, ActivitySignatureDay>);
	}
	return [];
}

/** Eden / JSON may return `Date` objects for keys — normalize before client render. */
export function normalizeActivitySignaturePayload(
	raw: ActivitySignaturePayload | null | undefined,
): ActivitySignaturePayload | null {
	if (!raw?.weeks?.length) return null;

	return {
		totalLogs: Number(raw.totalLogs ?? 0),
		totalDaysActive: Number(raw.totalDaysActive ?? 0),
		weeks: raw.weeks.map((week) => {
			const dayRows = coerceActivitySignatureDays(week.days);
			return {
				weekStart: activityDateKeyFromUnknown(week.weekStart),
				days: dayRows.map((day) => ({
					date: activityDateKeyFromUnknown(day.date),
					count: Number(day.count ?? 0),
					level: Number(day.level ?? 0),
				})),
			};
		}),
	};
}

/** Emerald quartile fills — keep in sync with profile heatmap cells. */
export const ACTIVITY_SIGNATURE_LEVEL_CLASS: Record<number, string> = {
	0: "bg-muted/50",
	1: "bg-emerald-900/80",
	2: "bg-emerald-700",
	3: "bg-emerald-500",
	4: "bg-emerald-400",
};

/** Row labels — one letter per weekday, aligned to each heatmap row. */
export const ACTIVITY_SIGNATURE_ROW_LABELS = [
	"M",
	"T",
	"W",
	"T",
	"F",
	"S",
	"S",
] as const;

/** Stable row keys for heatmap layout (Mon–Sun). */
export const ACTIVITY_SIGNATURE_WEEKDAY_ROW_KEYS = [
	"mon",
	"tue",
	"wed",
	"thu",
	"fri",
	"sat",
	"sun",
] as const;

export function formatActivitySignatureTooltip(
	dateKey: string,
	count: number,
): string {
	const label = new Date(`${dateKey}T12:00:00.000Z`).toLocaleDateString(
		undefined,
		{
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		},
	);
	if (count <= 0) return `No logs · ${label}`;
	if (count === 1) return `1 log · ${label}`;
	return `${count} logs · ${label}`;
}
