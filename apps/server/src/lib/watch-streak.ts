/**
 * Diary streak math (UTC calendar days) — Sense Tier 1.
 * Qualifying activity: at least one log on a day (`watched_at`).
 */

export type StreakStatus = "active" | "at_risk" | "idle" | "broken";

export interface UserStreakState {
	currentStreak: number;
	longestStreak: number;
	lastActiveDay: string | null;
	shieldsRemaining: number;
	autoGraceAvailable: boolean;
	freezeCoversDay: string | null;
}

export interface StreakSnapshot extends UserStreakState {
	status: StreakStatus;
	/** UTC day key for “today” — used for at-risk copy. */
	todayDay: string;
}

/** UTC calendar day key `YYYY-MM-DD`. */
export function toUtcDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function utcDayDiff(laterDay: string, earlierDay: string): number {
	const a = Date.parse(`${laterDay}T00:00:00.000Z`);
	const b = Date.parse(`${earlierDay}T00:00:00.000Z`);
	return Math.round((a - b) / 86_400_000);
}

function addUtcDays(day: string, delta: number): string {
	const d = new Date(`${day}T12:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return toUtcDayKey(d);
}

export function deriveStreakStatus(
	state: UserStreakState,
	now = new Date(),
): StreakStatus {
	const today = toUtcDayKey(now);
	const last = state.lastActiveDay;
	if (!last || state.currentStreak <= 0) return "idle";
	if (state.freezeCoversDay === today) return "active";
	const gap = utcDayDiff(today, last);
	if (gap <= 0) return "active";
	if (gap === 1) return "at_risk";
	return "broken";
}

export function toStreakSnapshot(
	state: UserStreakState,
	now = new Date(),
): StreakSnapshot {
	return {
		...state,
		status: deriveStreakStatus(state, now),
		todayDay: toUtcDayKey(now),
	};
}

/**
 * Apply a new qualifying log day to streak state (pure — no I/O).
 * `activityDay` must be a UTC day key.
 */
export function applyQualifyingDay(
	prev: UserStreakState,
	activityDay: string,
	now = new Date(),
): UserStreakState {
	const today = toUtcDayKey(now);
	if (activityDay > today) {
		// Future-dated diary entries do not advance streak clocks.
		return prev;
	}

	const last = prev.lastActiveDay;
	if (!last) {
		const current = 1;
		return {
			...prev,
			currentStreak: current,
			longestStreak: Math.max(prev.longestStreak, current),
			lastActiveDay: activityDay,
			freezeCoversDay: null,
		};
	}

	if (activityDay === last) {
		return {
			...prev,
			freezeCoversDay:
				prev.freezeCoversDay === activityDay ? null : prev.freezeCoversDay,
		};
	}

	const gap = utcDayDiff(activityDay, last);
	if (gap === 1) {
		const current = prev.currentStreak + 1;
		return {
			...prev,
			currentStreak: current,
			longestStreak: Math.max(prev.longestStreak, current),
			lastActiveDay: activityDay,
			freezeCoversDay: null,
		};
	}

	// Single missed day between last log and this log — auto-grace once.
	if (gap === 2 && prev.autoGraceAvailable) {
		const current = prev.currentStreak + 1;
		return {
			...prev,
			currentStreak: current,
			longestStreak: Math.max(prev.longestStreak, current),
			lastActiveDay: activityDay,
			autoGraceAvailable: false,
			freezeCoversDay: null,
		};
	}

	// Fresh start — recoverable, not a hard zero while browsing.
	const current = 1;
	return {
		...prev,
		currentStreak: current,
		longestStreak: Math.max(prev.longestStreak, current),
		lastActiveDay: activityDay,
		freezeCoversDay: null,
	};
}

/**
 * Spend one shield to protect today while at risk (no log required until tomorrow).
 */
export function applyStreakShield(
	prev: UserStreakState,
	now = new Date(),
): { next: UserStreakState; ok: true } | { ok: false; reason: string } {
	if (prev.shieldsRemaining <= 0) {
		return { ok: false, reason: "No streak shields left" };
	}

	const today = toUtcDayKey(now);
	const status = deriveStreakStatus(prev, now);
	if (status !== "at_risk") {
		return {
			ok: false,
			reason:
				"Shields are for days you have not logged yet — log a film or wait until tomorrow",
		};
	}

	if (prev.freezeCoversDay === today) {
		return { ok: false, reason: "Today is already protected" };
	}

	return {
		ok: true,
		next: {
			...prev,
			shieldsRemaining: prev.shieldsRemaining - 1,
			freezeCoversDay: today,
		},
	};
}

/** Sorted unique UTC day keys from log `watched_at` timestamps. */
export function collectQualifyingDayKeys(watchedAtDates: Date[]): string[] {
	const keys = new Set<string>();
	for (const d of watchedAtDates) {
		if (!Number.isNaN(d.getTime())) keys.add(toUtcDayKey(d));
	}
	return [...keys].sort();
}

/** Longest run of consecutive UTC days in a sorted day list. */
export function longestStreakFromDayKeys(dayKeys: string[]): number {
	const sorted = [...new Set(dayKeys)].sort();
	if (sorted.length === 0) return 0;
	let longest = 1;
	let run = 1;
	for (let i = 1; i < sorted.length; i++) {
		const prev = sorted.at(i - 1);
		const cur = sorted.at(i);
		if (prev === undefined || cur === undefined) continue;
		if (utcDayDiff(cur, prev) === 1) {
			run += 1;
		} else {
			run = 1;
		}
		longest = Math.max(longest, run);
	}
	return longest;
}

/**
 * Living streak ending on the patron's latest diary day — used for backfill / GET /me.
 */
export function computeLivingStreakFromDayKeys(
	dayKeys: string[],
	opts?: { shieldsRemaining?: number; autoGraceAvailable?: boolean },
	_now = new Date(),
): UserStreakState {
	const sorted = [...new Set(dayKeys)].sort();
	if (sorted.length === 0) {
		return {
			currentStreak: 0,
			longestStreak: 0,
			lastActiveDay: null,
			shieldsRemaining: opts?.shieldsRemaining ?? 2,
			autoGraceAvailable: opts?.autoGraceAvailable ?? true,
			freezeCoversDay: null,
		};
	}

	const lastActiveDay = sorted.at(-1);
	if (lastActiveDay === undefined) {
		return {
			currentStreak: 0,
			longestStreak: 0,
			lastActiveDay: null,
			shieldsRemaining: opts?.shieldsRemaining ?? 2,
			autoGraceAvailable: opts?.autoGraceAvailable ?? true,
			freezeCoversDay: null,
		};
	}
	let currentStreak = 0;
	let cursor = lastActiveDay;
	const set = new Set(sorted);
	while (set.has(cursor)) {
		currentStreak += 1;
		cursor = addUtcDays(cursor, -1);
	}

	return {
		currentStreak,
		longestStreak: Math.max(longestStreakFromDayKeys(sorted), currentStreak),
		lastActiveDay,
		shieldsRemaining: opts?.shieldsRemaining ?? 2,
		autoGraceAvailable: opts?.autoGraceAvailable ?? true,
		freezeCoversDay: null,
	};
}

/** Rebuild streak state from diary history (import backfill / repair). */
export function computeStreakFromDayKeys(
	dayKeys: string[],
	opts?: { shieldsRemaining?: number; autoGraceAvailable?: boolean },
): UserStreakState {
	return computeLivingStreakFromDayKeys(dayKeys, opts);
}
