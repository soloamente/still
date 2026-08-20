import { db, profile, user } from "@still/db";
import { and, eq, isNotNull } from "drizzle-orm";

import { cachedRead, cacheRedis, invalidateCache } from "./redis-cache";

/** Short TTL — presence visibility prefs change rarely; invalidated on profile writes. */
export const PRESENCE_PROFILE_META_TTL_SEC = 60;

export type PresenceProfileMetadata = {
	userId: string;
	handle: string;
	preferences: Record<string, unknown> | null | undefined;
	isPrivate: boolean;
	displayName: string | null;
	name: string | null;
	image: string | null;
};

export function presenceProfileByHandleCacheKey(handle: string): string {
	return `cache:presence:profile:handle:${handle.trim().toLowerCase()}`;
}

export function presenceProfileByUserIdCacheKey(userId: string): string {
	return `cache:presence:profile:user:${userId}`;
}

function mapPresenceProfileRow(row: {
	userId: string;
	handle: string | null;
	preferences: unknown;
	isPrivate: boolean;
	displayName: string | null;
	name: string | null;
	image: string | null;
}): PresenceProfileMetadata | null {
	const handle = row.handle?.trim().toLowerCase();
	if (!handle) return null;

	return {
		userId: row.userId,
		handle,
		preferences: row.preferences as Record<string, unknown> | null | undefined,
		isPrivate: row.isPrivate,
		displayName: row.displayName,
		name: row.name,
		image: row.image,
	};
}

async function loadPresenceProfileByHandle(
	handle: string,
): Promise<PresenceProfileMetadata | null> {
	const normalized = handle.trim().toLowerCase();
	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			preferences: profile.preferences,
			isPrivate: profile.isPrivate,
			displayName: profile.displayName,
			name: user.name,
			image: user.image,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(and(eq(profile.handle, normalized), isNotNull(profile.handle)))
		.limit(1);

	const row = rows[0];
	if (!row) return null;
	return mapPresenceProfileRow(row);
}

async function loadPresenceProfileByUserId(
	userId: string,
): Promise<PresenceProfileMetadata | null> {
	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			preferences: profile.preferences,
			isPrivate: profile.isPrivate,
			displayName: profile.displayName,
			name: user.name,
			image: user.image,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(and(eq(profile.userId, userId), isNotNull(profile.handle)))
		.limit(1);

	const row = rows[0];
	if (!row) return null;
	return mapPresenceProfileRow(row);
}

/**
 * Public presence rows keyed by handle — used by `/online` batch resolution.
 * Read-through cache per handle avoids repeated Neon reads on 30s polls.
 */
export async function fetchPublicPresenceProfilesByHandles(
	handles: string[],
): Promise<
	Array<{
		userId: string;
		handle: string;
		preferences: Record<string, unknown> | null | undefined;
	}>
> {
	const normalized = [
		...new Set(handles.map((h) => h.trim().toLowerCase()).filter(Boolean)),
	];
	if (normalized.length === 0) return [];

	const redis = await cacheRedis();
	const loaded = await Promise.all(
		normalized.map((handle) =>
			cachedRead(
				redis,
				presenceProfileByHandleCacheKey(handle),
				PRESENCE_PROFILE_META_TTL_SEC,
				() => loadPresenceProfileByHandle(handle),
			),
		),
	);

	return loaded
		.filter(
			(row): row is PresenceProfileMetadata =>
				row != null && !row.isPrivate && Boolean(row.handle),
		)
		.map(({ userId, handle, preferences }) => ({
			userId,
			handle,
			preferences,
		}));
}

/**
 * Cached profile rows for listing presence chips (by user id).
 * Reuses the same Redis keys as online presence metadata.
 */
export async function fetchListingPresenceProfilesByUserIds(
	userIds: string[],
): Promise<PresenceProfileMetadata[]> {
	const unique = [...new Set(userIds.filter(Boolean))];
	if (unique.length === 0) return [];

	const redis = await cacheRedis();
	const loaded = await Promise.all(
		unique.map((userId) =>
			cachedRead(
				redis,
				presenceProfileByUserIdCacheKey(userId),
				PRESENCE_PROFILE_META_TTL_SEC,
				() => loadPresenceProfileByUserId(userId),
			),
		),
	);

	return loaded.filter((row): row is PresenceProfileMetadata => row != null);
}

/** Invalidate cached presence profile metadata after profile preference/privacy edits. */
export async function invalidatePresenceProfileMetadata(
	userId: string,
	handle?: string | null,
): Promise<void> {
	const keys = [presenceProfileByUserIdCacheKey(userId)];
	const normalized = handle?.trim().toLowerCase();
	if (normalized) keys.push(presenceProfileByHandleCacheKey(normalized));
	await invalidateCache(await cacheRedis(), ...keys);
}
