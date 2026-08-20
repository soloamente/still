import { account, db, profile } from "@still/db";
import { and, eq } from "drizzle-orm";

import { cachedRead, cacheRedis, invalidateCache } from "./redis-cache";

/** Stable Discord row metadata — Lanyard activity stays on its own short cache. */
export const DISCORD_ACTIVITY_META_TTL_SEC = 300;

export type DiscordActivityProfileMetadata = {
	userId: string;
	isPrivate: boolean;
	preferences: Record<string, unknown> | null;
	discordAccountId: string | null;
};

export type ProfileAccessByHandle = {
	userId: string;
	isPrivate: boolean;
};

export function discordActivityMetaCacheKey(userId: string): string {
	return `cache:discord-activity:meta:${userId}`;
}

export function profileAccessByHandleCacheKey(handle: string): string {
	return `cache:profile:access:handle:${handle.trim().toLowerCase()}`;
}

async function loadProfileAccessByHandle(
	handle: string,
): Promise<ProfileAccessByHandle | null> {
	const normalized = handle.toLowerCase();
	const [row] = await db
		.select({ userId: profile.userId, isPrivate: profile.isPrivate })
		.from(profile)
		.where(eq(profile.handle, normalized))
		.limit(1);
	if (!row) return null;
	return { userId: row.userId, isPrivate: row.isPrivate };
}

/** Cached profile access gate used before Lanyard reads. */
export async function fetchProfileAccessByHandle(
	handle: string,
): Promise<ProfileAccessByHandle | null> {
	const normalized = handle.trim().toLowerCase();
	if (!normalized) return null;

	return cachedRead(
		await cacheRedis(),
		profileAccessByHandleCacheKey(normalized),
		DISCORD_ACTIVITY_META_TTL_SEC,
		() => loadProfileAccessByHandle(normalized),
	);
}

async function loadDiscordActivityProfileMetadata(
	userId: string,
): Promise<DiscordActivityProfileMetadata> {
	const [profileRow] = await db
		.select({
			preferences: profile.preferences,
			isPrivate: profile.isPrivate,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const [accountRow] = await db
		.select({ accountId: account.accountId })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "discord")))
		.limit(1);

	const prefs = profileRow?.preferences;
	const preferences =
		prefs && typeof prefs === "object" && !Array.isArray(prefs)
			? (prefs as Record<string, unknown>)
			: null;

	const accountId = accountRow?.accountId?.trim();

	return {
		userId,
		isPrivate: profileRow?.isPrivate ?? false,
		preferences,
		discordAccountId: accountId ? accountId : null,
	};
}

/** Cached stable metadata for Discord activity polling (not live Lanyard state). */
export async function fetchDiscordActivityProfileMetadata(
	userId: string,
): Promise<DiscordActivityProfileMetadata> {
	return cachedRead(
		await cacheRedis(),
		discordActivityMetaCacheKey(userId),
		DISCORD_ACTIVITY_META_TTL_SEC,
		() => loadDiscordActivityProfileMetadata(userId),
	);
}

/** Drop Discord/profile access caches after link, unlink, or preference edits. */
export async function invalidateDiscordActivityMetadata(
	userId: string,
	handle?: string | null,
): Promise<void> {
	const keys = [discordActivityMetaCacheKey(userId)];
	const normalized = handle?.trim().toLowerCase();
	if (normalized) keys.push(profileAccessByHandleCacheKey(normalized));
	await invalidateCache(await cacheRedis(), ...keys);
}
