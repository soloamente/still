import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

import { readShowAdultContentPref } from "./adult-content-policy";

/** Loads show-adult pref from the signed-in patron profile row. */
export async function getShowAdultContentForUser(
	userId: string | null | undefined,
): Promise<boolean> {
	if (!userId) return false;
	try {
		const [row] = await db
			.select({ preferences: profile.preferences })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);
		return readShowAdultContentPref(
			(row?.preferences as Record<string, unknown>) ?? null,
		);
	} catch (err) {
		console.error("[adult-content-policy] prefs unavailable, default off", err);
		return false;
	}
}
