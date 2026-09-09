import { env } from "@still/env/server";

import type { LanyardPresencePayload } from "./discord-activity";

/** Discord presence cache TTL — keeps profile reads from hammering the Worker. */
const DISCORD_PRESENCE_CACHE_TTL_MS = 15_000;

type DiscordPresenceApiResponse = {
	success?: boolean;
	data?: LanyardPresencePayload;
};

type CacheEntry = {
	payload: LanyardPresencePayload | null;
	expiresAt: number;
};

const presenceCache = new Map<string, CacheEntry>();

/** Clears in-process Discord presence cache between tests. */
export function resetDiscordPresenceCacheForTests(): void {
	presenceCache.clear();
}

function discordPresenceUsersUrl(discordUserId: string): string | null {
	const base = env.DISCORD_PRESENCE_WORKER_URL?.replace(/\/$/, "");
	if (!base) return null;
	return `${base}/v1/users/${encodeURIComponent(discordUserId)}`;
}

/** Uncached Worker REST read — returns null when URL/secret unset or request fails. */
export async function fetchDiscordPresence(
	discordUserId: string,
): Promise<LanyardPresencePayload | null> {
	const url = discordPresenceUsersUrl(discordUserId);
	const secret = env.DISCORD_PRESENCE_INTERNAL_SECRET;
	if (!url || !secret) return null;

	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${secret}`,
			},
			signal: AbortSignal.timeout(5_000),
		});
		if (!response.ok) return null;

		const body = (await response.json()) as DiscordPresenceApiResponse;
		if (body.success !== true || body.data == null) return null;

		return body.data;
	} catch {
		return null;
	}
}

/** Cached Worker read keyed by Discord snowflake (~15s TTL). */
export async function getCachedDiscordPresence(
	discordUserId: string,
): Promise<LanyardPresencePayload | null> {
	const key = discordUserId.trim();
	if (!key) return null;

	const now = Date.now();
	const cached = presenceCache.get(key);
	if (cached && cached.expiresAt > now) {
		return cached.payload;
	}

	const payload = await fetchDiscordPresence(key);
	presenceCache.set(key, {
		payload,
		expiresAt: now + DISCORD_PRESENCE_CACHE_TTL_MS,
	});
	return payload;
}
