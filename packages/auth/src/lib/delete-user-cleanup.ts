import { db, list, profile, user } from "@still/db";
import { env } from "@still/env/server";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";

/**
 * Best-effort Vercel Blob cleanup before account deletion. Collects every
 * blob URL the patron owns (avatar on `user.image`, profile banner, custom
 * list covers) and deletes them in one call. Never throws — a failed blob
 * delete must not block the account deletion itself.
 */
export async function deleteUserBlobAssets(userId: string): Promise<void> {
	if (!env.BLOB_READ_WRITE_TOKEN) return;

	const urls: string[] = [];
	try {
		const [userRow] = await db
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, userId));
		if (userRow?.image?.startsWith("https://")) urls.push(userRow.image);

		const [profileRow] = await db
			.select({ bannerUrl: profile.bannerUrl })
			.from(profile)
			.where(eq(profile.userId, userId));
		if (profileRow?.bannerUrl?.startsWith("https://")) {
			urls.push(profileRow.bannerUrl);
		}

		const ownedLists = await db
			.select({ coverImageUrl: list.coverImageUrl })
			.from(list)
			.where(eq(list.userId, userId));
		for (const row of ownedLists) {
			if (row.coverImageUrl?.startsWith("https://")) {
				urls.push(row.coverImageUrl);
			}
		}

		if (urls.length === 0) return;
		await del(urls, { token: env.BLOB_READ_WRITE_TOKEN });
	} catch (err) {
		console.error("[delete-user-cleanup] blob cleanup failed", err);
	}
}
