import { env } from "@still/env/server";

import type { LanyardPresencePayload } from "./discord-activity";

/** Lanyard presence cache TTL — keeps profile reads from hammering internal Lanyard. */
const LANYARD_PRESENCE_CACHE_TTL_MS = 15_000;

type LanyardApiResponse = {
	success?: boolean;
	data?: LanyardPresencePayload;
};

type CacheEntry = {
	payload: LanyardPresencePayload | null;
	expiresAt: number;
};

const presenceCache = new Map<string, CacheEntry>();

/** Clears in-process Lanyard cache between tests. */
export function resetLanyardPresenceCacheForTests(): void {
	presenceCache.clear();
}

function lanyardUsersUrl(discordUserId: string): string | null {
	const base = env.LANYARD_INTERNAL_URL?.replace(/\/$/, "");
	if (!base) return null;
	return `${base}/v1/users/${encodeURIComponent(discordUserId)}`;
}

/** Uncached Lanyard REST read — returns null when URL unset or request fails. */
export async function fetchLanyardPresence(
	discordUserId: string,
): Promise<LanyardPresencePayload | null> {
	const url = lanyardUsersUrl(discordUserId);
	if (!url) return null;

	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(5_000),
		});
		if (!response.ok) return null;

		const body = (await response.json()) as LanyardApiResponse;
		if (body.success !== true || body.data == null) return null;

		return body.data;
	} catch {
		return null;
	}
}

/** Cached Lanyard read keyed by Discord snowflake (~15s TTL). */
export async function getCachedLanyardPresence(
	discordUserId: string,
): Promise<LanyardPresencePayload | null> {
	const key = discordUserId.trim();
	if (!key) return null;

	const now = Date.now();
	const cached = presenceCache.get(key);
	if (cached && cached.expiresAt > now) {
		return cached.payload;
	}

	const payload = await fetchLanyardPresence(key);
	presenceCache.set(key, {
		payload,
		expiresAt: now + LANYARD_PRESENCE_CACHE_TTL_MS,
	});
	return payload;
}
