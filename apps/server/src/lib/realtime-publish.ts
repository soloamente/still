import { env } from "@still/env/server";
import type { RealtimeEvent } from "@still/realtime";

import { getRealtimeRedis, realtimeStreamKey } from "./realtime-redis";

export { isRealtimePublishEnabled } from "./realtime-redis";

export function isRealtimeWorkerPublishEnabled(): boolean {
	return Boolean(env.REALTIME_WORKER_URL && env.REALTIME_INTERNAL_SECRET);
}

async function publishViaWorker(
	roomId: string,
	event: RealtimeEvent,
): Promise<void> {
	try {
		const res = await fetch(`${env.REALTIME_WORKER_URL}/publish`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.REALTIME_INTERNAL_SECRET}`,
			},
			body: JSON.stringify({ room: roomId, event }),
		});
		if (!res.ok) {
			console.error("[realtime] worker publish rejected", {
				roomId,
				type: event.type,
				status: res.status,
			});
		}
	} catch (err) {
		console.error("[realtime] worker publish failed", {
			roomId,
			type: event.type,
			err,
		});
	}
}

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

/** Fan out after Postgres commit. Dual-publishes to Worker + Upstash during cutover. Never throws. */
export async function publishRealtimeEvent(
	roomId: string,
	event: RealtimeEvent,
): Promise<void> {
	const workerEnabled = isRealtimeWorkerPublishEnabled();
	const redis = getRealtimeRedis();

	if (!workerEnabled && !redis) {
		if (process.env.NODE_ENV === "development") {
			await publishViaDevRelay(roomId, event);
		}
		return;
	}

	const tasks: Promise<void>[] = [];

	if (workerEnabled) {
		tasks.push(publishViaWorker(roomId, event));
	}

	if (redis) {
		tasks.push(
			(async () => {
				try {
					const key = realtimeStreamKey(roomId);
					await redis.xadd(key, "*", { data: JSON.stringify(event) });
					await redis.expire(key, 86_400);
				} catch (err) {
					console.error("[realtime] upstash publish failed", {
						roomId,
						type: event.type,
						err,
					});
				}
			})(),
		);
	}

	await Promise.all(tasks);
}
