import type { ListingPresenceRedis } from "./listing-presence";
import { getPresenceDevStoreIfEnabled } from "./presence-dev-store";
import { getRealtimeRedis } from "./realtime-redis";

/**
 * Shared presence storage — Upstash in prod/preview, in-process ZSET in local dev
 * when Upstash env is unset (same pattern as realtime-dev-bus for SSE).
 */
export function getPresenceRedis(): ListingPresenceRedis | null {
	const upstash = getRealtimeRedis();
	if (upstash) return upstash as ListingPresenceRedis;
	return getPresenceDevStoreIfEnabled();
}
