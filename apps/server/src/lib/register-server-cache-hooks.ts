import { registerDiscordMetadataInvalidator } from "@still/auth/lib/discord-oauth-callback";
import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

import { invalidateDiscordActivityMetadata } from "./discord-activity-metadata-cache";

let registered = false;

/**
 * Wire auth-package Discord hooks to server-side Redis cache invalidation.
 * Safe to call multiple times — registers once per process.
 */
export function registerServerCacheHooks(): void {
	if (registered) return;
	registered = true;

	registerDiscordMetadataInvalidator(async (userId) => {
		const [row] = await db
			.select({ handle: profile.handle })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);
		await invalidateDiscordActivityMetadata(userId, row?.handle);
	});
}
