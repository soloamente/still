export const DAILY_PICK_POOL = 12;

export type DailyPickSurface = "movie" | "tv" | "watchlist";

/** Unsigned 32-bit djb2. Client and tests share this. */
export function djb2(input: string): number {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
	}
	return hash >>> 0;
}

/** `YYYY-MM-DD` in `timeZone`. Invalid zones fall back to UTC. */
export function formatDayKey(timeZone: string, now: Date = new Date()): string {
	try {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(now);
	} catch {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(now);
	}
}

export function pickDailySpotlight(input: {
	rankedIds: number[];
	dayKey: string;
	userId: string;
	surface: DailyPickSurface;
	skippedIds: number[];
	pinnedId: number | null;
}): number | null {
	const seen = new Set<number>();
	const unique: number[] = [];
	for (const id of input.rankedIds) {
		if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
		seen.add(id);
		unique.push(id);
	}
	const pool = unique.slice(0, DAILY_PICK_POOL);
	if (pool.length === 0) return null;
	const skipped = new Set(input.skippedIds);
	if (
		input.pinnedId != null &&
		pool.includes(input.pinnedId) &&
		!skipped.has(input.pinnedId)
	) {
		return input.pinnedId;
	}
	const start =
		djb2(`${input.userId}:${input.dayKey}:${input.surface}`) % pool.length;
	for (let step = 0; step < pool.length; step++) {
		const id = pool[(start + step) % pool.length] ?? null;
		if (id != null && !skipped.has(id)) return id;
	}
	return null;
}
