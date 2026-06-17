import { env } from "@still/env/server";
import type { RealtimeEvent } from "@still/realtime";

import { getRealtimeRedis, realtimeStreamKey } from "./realtime-redis";

export { isRealtimePublishEnabled } from "./realtime-redis";

/** POST dev events to the Next.js in-process bus when Upstash is unset locally. */
async function publishViaDevRelay(
	roomId: string,
	event: RealtimeEvent,
): Promise<void> {
	const origin = env.CORS_ORIGIN.replace(/\/$/, "");
	try {
		const res = await fetch(`${origin}/api/realtime/dev-relay`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ roomId, event }),
		});
		if (!res.ok) {
			console.error("[realtime] dev relay rejected", {
				roomId,
				type: event.type,
				status: res.status,
			});
		}
	} catch (err) {
		console.error("[realtime] dev relay failed", {
			roomId,
			type: event.type,
			err,
		});
	}
}

/** Fan out after Postgres commit via Redis Streams. Never throws to callers. */
export async function publishRealtimeEvent(
	roomId: string,
	event: RealtimeEvent,
): Promise<void> {
	const redis = getRealtimeRedis();
	if (!redis) {
		if (process.env.NODE_ENV === "development") {
			await publishViaDevRelay(roomId, event);
		}
		return;
	}
	try {
		const key = realtimeStreamKey(roomId);
		// XADD with auto-id; SSE consumers XREAD from the same stream key.
		await redis.xadd(key, "*", { data: JSON.stringify(event) });
		// Trim retention so dev/staging streams do not grow without bound.
		await redis.expire(key, 86_400);
	} catch (err) {
		console.error("[realtime] publish failed", {
			roomId,
			type: event.type,
			err,
		});
	}
}
