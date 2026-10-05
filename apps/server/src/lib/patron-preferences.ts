import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

/** Patron `profile.preferences` blob (null when the profile row is missing). */
export async function loadPatronPreferences(
	userId: string,
): Promise<Record<string, unknown> | null> {
	const [prefRow] = await db
		.select({ preferences: profile.preferences })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	return (prefRow?.preferences as Record<string, unknown> | null) ?? null;
}
