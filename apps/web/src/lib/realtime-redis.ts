import "server-only";

import { env } from "@still/env/web";
import { Redis } from "@upstash/redis";

import { shouldUseRealtimeDevBus } from "@/lib/realtime-dev-bus";

let client: Redis | null = null;

/** True when the SSE route can subscribe to Upstash Redis Streams. */
export function isRealtimePublishEnabled(): boolean {
	return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/** True when `/api/realtime/stream` can serve SSE (Upstash or local dev bus). */
export function isRealtimeStreamAvailable(): boolean {
	return isRealtimePublishEnabled() || shouldUseRealtimeDevBus();
}

/** Shared Upstash client for server-side SSE subscribe; null when env is unset. */
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
