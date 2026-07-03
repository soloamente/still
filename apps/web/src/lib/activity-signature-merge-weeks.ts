import type { ActivitySignatureWeek } from "@/lib/activity-signature";

/**
 * Prepend older week columns — dedupe by `weekStart` when chunks overlap at boundaries.
 */
export function mergeActivitySignatureWeeks(
	prepend: ActivitySignatureWeek[],
	current: ActivitySignatureWeek[],
): ActivitySignatureWeek[] {
	const seen = new Set(current.map((week) => week.weekStart));
	const uniqueOlder = prepend.filter((week) => !seen.has(week.weekStart));
	return [...uniqueOlder, ...current];
}
