import { account, db, profile } from "@still/db";
import { and, eq } from "drizzle-orm";

/** Loads the owner's linked Discord snowflake when present. */
export async function fetchDiscordAccountIdForUser(
	userId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ accountId: account.accountId })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "discord")))
		.limit(1);

	const accountId = row?.accountId?.trim();
	return accountId ? accountId : null;
}

/** Reads profile preferences for visibility + integration toggles. */
export async function fetchProfilePreferencesForUser(
	userId: string,
): Promise<Record<string, unknown> | null> {
	const [row] = await db
		.select({ preferences: profile.preferences })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const prefs = row?.preferences;
	if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
		return null;
	}
	return prefs as Record<string, unknown>;
}
