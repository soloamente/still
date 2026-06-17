import { env } from "@still/env/server";
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/** Clears the cached Upstash client between unit tests (module mock isolation). */
export function resetRealtimeRedisClientForTests(): void {
	client = null;
}

/** True when Elysia can publish to Upstash Redis Streams after Postgres commits. */
export function isRealtimePublishEnabled(): boolean {
	return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/** Shared Upstash client for realtime publish paths; null when env is unset (local dev). */
export function getRealtimeRedis(): Redis | null {
	if (!isRealtimePublishEnabled()) return null;
	client ??= new Redis({
		url: env.UPSTASH_REDIS_REST_URL!,
		token: env.UPSTASH_REDIS_REST_TOKEN!,
	});
	return client;
}

/** Redis stream key for a logical room id (matches @still/realtime room strings). */
export function realtimeStreamKey(roomId: string): string {
	return `sense:stream:${roomId}`;
}
