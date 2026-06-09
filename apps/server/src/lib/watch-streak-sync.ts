import { db, log, userStreak } from "@still/db";
import { eq } from "drizzle-orm";

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

async function userHasDiaryLogs(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: log.id })
		.from(log)
		.where(eq(log.userId, userId))
		.limit(1);
	return row != null;
}

async function loadDiaryQualifyingDayKeys(userId: string): Promise<string[]> {
	const rows = await db
		.select({ watchedAt: log.watchedAt })
		.from(log)
		.where(eq(log.userId, userId));
	return collectQualifyingDayKeys(rows.map((row) => row.watchedAt));
}

/** True when persisted streak counts lag behind diary history (heatmap still shows a solid run). */
function streakDriftedFromDiary(
	persisted: UserStreakState,
	fromDiary: UserStreakState,
): boolean {
	if (fromDiary.currentStreak > persisted.currentStreak) return true;
	const latestDiaryDay = fromDiary.lastActiveDay;
	const lastPersistedDay = persisted.lastActiveDay;
	if (latestDiaryDay && lastPersistedDay && latestDiaryDay > lastPersistedDay) {
		return true;
	}
	return false;
}

/**
 * Repair `user_streak` when incremental updates diverged from diary day keys.
 * Preserves shield / auto-grace metadata; never lowers a grace-bridged run.
 */
async function reconcileStreakWithDiaryIfNeeded(
	userId: string,
	persisted: UserStreakState,
): Promise<UserStreakState> {
	const dayKeys = await loadDiaryQualifyingDayKeys(userId);
	const fromDiary = computeLivingStreakFromDayKeys(dayKeys, {
		shieldsRemaining: persisted.shieldsRemaining,
		autoGraceAvailable: persisted.autoGraceAvailable,
	});

	if (!streakDriftedFromDiary(persisted, fromDiary)) {
		return persisted;
	}

	const next: UserStreakState = {
		...fromDiary,
		freezeCoversDay: persisted.freezeCoversDay,
		shieldsRemaining: persisted.shieldsRemaining,
		autoGraceAvailable: persisted.autoGraceAvailable,
		longestStreak: Math.max(fromDiary.longestStreak, persisted.longestStreak),
	};
	await saveUserStreakState(userId, next);
	return next;
}

/**
 * Patron-facing streak — backfills from diary when the row is empty but logs exist
 * (feature shipped after patrons already had filmography).
 */
export async function getWatchStreakSnapshot(
	userId: string,
): Promise<StreakSnapshot> {
	let state = await loadUserStreakState(userId);
	const needsBackfill =
		state.lastActiveDay == null ||
		(state.currentStreak === 0 && (await userHasDiaryLogs(userId)));

	if (needsBackfill) {
		return backfillWatchStreakFromLogs(userId);
	}

	state = await reconcileStreakWithDiaryIfNeeded(userId, state);
	return toStreakSnapshot(state);
}

/** Rebuild from diary — import repair or first-time backfill. */
export async function backfillWatchStreakFromLogs(
	userId: string,
): Promise<StreakSnapshot> {
	const rows = await db
		.select({ watchedAt: log.watchedAt })
		.from(log)
		.where(eq(log.userId, userId));
	const prev = await loadUserStreakState(userId);
	const next = computeLivingStreakFromDayKeys(
		collectQualifyingDayKeys(rows.map((r) => r.watchedAt)),
		{
			shieldsRemaining: prev.shieldsRemaining,
			autoGraceAvailable: prev.autoGraceAvailable,
		},
	);
	await saveUserStreakState(userId, next);
	return toStreakSnapshot(next);
}
