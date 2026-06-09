import { db, list, profile, user } from "@still/db";
import { env } from "@still/env/server";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";

/**
 * Only delete blobs we actually host. `user.image` may be an OAuth avatar
 * (e.g. googleusercontent.com) — same idiom as profiles.ts / lists.ts.
 */
function looksLikeVercelBlobUrl(url: string): boolean {
	return url.includes("blob.vercel-storage.com");
}

/**
 * Best-effort Vercel Blob cleanup before account deletion. Collects every
 * blob URL the patron owns (avatar on `user.image`, profile banner, custom
 * list covers) and deletes them in one call. Never throws — a failed blob
 * delete must not block the account deletion itself.
 *
 * Accepted tradeoff: this runs in `beforeDelete`, so if the user-row deletion
 * subsequently fails, the account survives without its images.
 */
export async function deleteUserBlobAssets(userId: string): Promise<void> {
	if (!env.BLOB_READ_WRITE_TOKEN) return;

	const urls: string[] = [];
	try {
		const [userRow] = await db
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, userId));
		if (userRow?.image && looksLikeVercelBlobUrl(userRow.image)) {
			urls.push(userRow.image);
		}

		const [profileRow] = await db
			.select({ bannerUrl: profile.bannerUrl })
			.from(profile)
			.where(eq(profile.userId, userId));
		if (profileRow?.bannerUrl && looksLikeVercelBlobUrl(profileRow.bannerUrl)) {
			urls.push(profileRow.bannerUrl);
		}

		const ownedLists = await db
			.select({ coverImageUrl: list.coverImageUrl })
			.from(list)
			.where(eq(list.userId, userId));
		for (const row of ownedLists) {
			if (row.coverImageUrl && looksLikeVercelBlobUrl(row.coverImageUrl)) {
				urls.push(row.coverImageUrl);
			}
		}

		if (urls.length === 0) return;
		await del(urls, { token: env.BLOB_READ_WRITE_TOKEN });
	} catch (err) {
		console.error("[delete-user-cleanup] blob cleanup failed", err);
	}
}
