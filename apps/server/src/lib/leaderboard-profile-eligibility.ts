import { profile, user } from "@still/db";
import { and, eq, isNotNull, notInArray, type SQL } from "drizzle-orm";

/**
 * Whether a profile may appear on Community Film/TV ranks or the Members directory.
 * Private profile (Settings → Public / Private) is the patron opt-out.
 */
export function isEligibleLeaderboardProfile(isPrivate: boolean): boolean {
	return !isPrivate;
}

/**
 * Shared SQL filters for leaderboard profile rows — callers must `innerJoin(user, …)`.
 * Excludes private profiles, handleless accounts, and banned patrons.
 */
export function leaderboardPublicProfileConditions(
	blockedIds: string[],
): SQL[] {
	const conditions: SQL[] = [
		eq(profile.isPrivate, false),
		isNotNull(profile.handle),
		eq(user.banned, false),
	];
	if (blockedIds.length > 0) {
		conditions.push(notInArray(profile.userId, blockedIds));
	}
	return conditions;
}

/** Combine profile eligibility fragments for drizzle `and(...)`. */
export function leaderboardPublicProfileWhere(blockedIds: string[]) {
	return and(...leaderboardPublicProfileConditions(blockedIds));
}
