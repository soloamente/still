import { db, profile, user } from "@still/db";
import { eq } from "drizzle-orm";

/**
 * Public logs require a verified email. An unverified account still gets the
 * diary row, saved as private, so the heartbeat is never rejected.
 * Shared by Companion auto-log and TV season/series auto-completion logs.
 */
export async function visibilityForAutoLog(
	userId: string,
): Promise<"public" | "followers" | "friends" | "private"> {
	const [own] = await db
		.select({ visibility: profile.defaultVisibility })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	const visibility = own?.visibility ?? "public";
	if (visibility !== "public") return visibility;
	if (process.env.NODE_ENV === "development") return visibility;
	const [account] = await db
		.select({ emailVerified: user.emailVerified })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (account?.emailVerified === true) return visibility;
	return "private";
}
