import { db, log, userStreak } from "@still/db";
import { and, eq, isNull } from "drizzle-orm";

import {
	applyQualifyingDay,
	collectQualifyingDayKeys,
	computeLivingStreakFromDayKeys,
	type StreakSnapshot,
	toStreakSnapshot,
	toUtcDayKey,
	type UserStreakState,
} from "./watch-streak";

const DEFAULT_STATE: UserStreakState = {
	currentStreak: 0,
	longestStreak: 0,
	lastActiveDay: null,
	shieldsRemaining: 2,
	autoGraceAvailable: true,
	freezeCoversDay: null,
};

function rowToState(row: typeof userStreak.$inferSelect): UserStreakState {
	return {
		currentStreak: row.currentStreak,
		longestStreak: row.longestStreak,
		lastActiveDay: row.lastActiveDay ?? null,
		shieldsRemaining: row.shieldsRemaining,
		autoGraceAvailable: row.autoGraceAvailable,
		freezeCoversDay: row.freezeCoversDay ?? null,
	};
}

function stateToRow(userId: string, state: UserStreakState) {
	return {
		userId,
		currentStreak: state.currentStreak,
		longestStreak: state.longestStreak,
		lastActiveDay: state.lastActiveDay,
		shieldsRemaining: state.shieldsRemaining,
		autoGraceAvailable: state.autoGraceAvailable,
		freezeCoversDay: state.freezeCoversDay,
	};
}

export async function loadUserStreakState(
	userId: string,
): Promise<UserStreakState> {
	const [row] = await db
		.select()
		.from(userStreak)
		.where(eq(userStreak.userId, userId))
		.limit(1);
	return row ? rowToState(row) : { ...DEFAULT_STATE };
}

export async function saveUserStreakState(
	userId: string,
	state: UserStreakState,
): Promise<void> {
	await db
		.insert(userStreak)
		.values(stateToRow(userId, state))
		.onConflictDoUpdate({
			target: userStreak.userId,
			set: {
				currentStreak: state.currentStreak,
				longestStreak: state.longestStreak,
				lastActiveDay: state.lastActiveDay,
				shieldsRemaining: state.shieldsRemaining,
				autoGraceAvailable: state.autoGraceAvailable,
				freezeCoversDay: state.freezeCoversDay,
			},
		});
}

/** Call after a diary log is written — advances streak from `watched_at`. */
export async function syncWatchStreakForUser(
	userId: string,
	watchedAt: Date,
): Promise<StreakSnapshot> {
	const prev = await loadUserStreakState(userId);
	const activityDay = toUtcDayKey(watchedAt);
	// Out-of-order `watched_at` (imports, backfills) needs a full diary rebuild.
	if (prev.lastActiveDay && activityDay < prev.lastActiveDay) {
		return backfillWatchStreakFromLogs(userId);
	}
	const next = applyQualifyingDay(prev, activityDay);
	await saveUserStreakState(userId, next);
	return toStreakSnapshot(next);
}

async function loadDiaryQualifyingDayKeys(userId: string): Promise<string[]> {
	const rows = await db
		.select({ watchedAt: log.watchedAt })
		.from(log)
		.where(and(eq(log.userId, userId), isNull(log.removedAt)));
	return collectQualifyingDayKeys(rows.map((row) => row.watchedAt));
}

function streakStateChanged(
	before: UserStreakState,
	after: UserStreakState,
): boolean {
	return (
		before.currentStreak !== after.currentStreak ||
		before.lastActiveDay !== after.lastActiveDay ||
		before.longestStreak !== after.longestStreak
	);
}

/**
 * Derive streak counters from diary day keys — same source as the profile heatmap.
 * Preserves shield / auto-grace metadata from the persisted row.
 */
function mergeStreakFromDiaryDayKeys(
	persisted: UserStreakState,
	dayKeys: string[],
): UserStreakState {
	if (dayKeys.length === 0) return persisted;

	const fromDiary = computeLivingStreakFromDayKeys(dayKeys, {
		shieldsRemaining: persisted.shieldsRemaining,
		autoGraceAvailable: persisted.autoGraceAvailable,
	});

	return {
		...fromDiary,
		freezeCoversDay: persisted.freezeCoversDay,
		shieldsRemaining: persisted.shieldsRemaining,
		autoGraceAvailable: persisted.autoGraceAvailable,
		longestStreak: Math.max(fromDiary.longestStreak, persisted.longestStreak),
	};
}

/**
 * Patron-facing streak — always reconciled against diary logs so imports and
 * backdated edits stay aligned with the activity heatmap.
 */
export async function getWatchStreakSnapshot(
	userId: string,
): Promise<StreakSnapshot> {
	const persisted = await loadUserStreakState(userId);
	const dayKeys = await loadDiaryQualifyingDayKeys(userId);

	if (dayKeys.length === 0) {
		return toStreakSnapshot(persisted);
	}

	const next = mergeStreakFromDiaryDayKeys(persisted, dayKeys);
	if (streakStateChanged(persisted, next)) {
		await saveUserStreakState(userId, next);
	}
	return toStreakSnapshot(next);
}

/** Rebuild from diary — import repair or first-time backfill. */
export async function backfillWatchStreakFromLogs(
	userId: string,
): Promise<StreakSnapshot> {
	const persisted = await loadUserStreakState(userId);
	const dayKeys = await loadDiaryQualifyingDayKeys(userId);
	const next = mergeStreakFromDiaryDayKeys(persisted, dayKeys);
	await saveUserStreakState(userId, next);
	return toStreakSnapshot(next);
}
