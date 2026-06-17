import { parseRealtimeEvent } from "@still/realtime";

import { authServer } from "@/lib/auth-server";
import {
	shouldUseRealtimeDevBus,
	subscribeRealtimeDevBus,
} from "@/lib/realtime-dev-bus";
import {
	getRealtimeRedis,
	isRealtimeStreamAvailable,
	realtimeStreamKey,
} from "@/lib/realtime-redis";
import { resolveRealtimeRoomAccess } from "@/lib/realtime-room-access";
import {
	encodeRealtimeSseMessage,
	encodeSseKeepalive,
	parseStreamEntryData,
	roomIdFromStreamKey,
} from "@/lib/realtime-sse";
import { hitRealtimeStreamRateLimit } from "@/lib/realtime-stream-rate-limit";
import {
	parseRealtimeStreamRoomsParam,
	readRealtimeStreamBatch,
} from "@/lib/realtime-stream-read";

export const runtime = "nodejs";
/** Long-lived SSE — match import proxy routes on Vercel Fluid. */
export const maxDuration = 300;

/** Signed-in patrons subscribe to allowed Redis stream rooms over SSE. */
export async function GET(request: Request) {
	const session = await authServer();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	if (!hitRealtimeStreamRateLimit(session.user.id)) {
		return new Response("Too many requests", { status: 429 });
	}

	if (!isRealtimeStreamAvailable()) {
		return new Response("Realtime not configured", { status: 503 });
	}

	const useDevBus = shouldUseRealtimeDevBus();
	const redis = useDevBus ? null : getRealtimeRedis();
	if (!useDevBus && !redis) {
		return new Response("Realtime not configured", { status: 503 });
	}

	const requestedRooms = parseRealtimeStreamRoomsParam(
		new URL(request.url).searchParams.get("rooms"),
	);
	if (!requestedRooms) {
		return new Response("Bad request", { status: 400 });
	}

	const allowedRooms: string[] = [];
	for (const roomId of requestedRooms) {
		const access = await resolveRealtimeRoomAccess(session.user.id, roomId);
		if (access !== "deny") {
			allowedRooms.push(roomId);
		}
	}

	if (allowedRooms.length === 0) {
		return new Response("Forbidden", { status: 403 });
	}

	const streamKeys = allowedRooms.map(realtimeStreamKey);
	let lastIds = Object.fromEntries(streamKeys.map((key) => [key, "$"]));
	const encoder = new TextEncoder();

	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			if (useDevBus) {
				const unsubscribe = subscribeRealtimeDevBus((roomId, event) => {
					if (!allowedRooms.includes(roomId)) return;
					if (request.signal.aborted) return;
					try {
						controller.enqueue(
							encoder.encode(encodeRealtimeSseMessage(roomId, event)),
						);
					} catch {
						// Client disconnected mid-enqueue.
					}
				});

				const keepalive = setInterval(() => {
					if (request.signal.aborted) {
						clearInterval(keepalive);
						return;
					}
					try {
						controller.enqueue(encoder.encode(encodeSseKeepalive()));
					} catch {
						clearInterval(keepalive);
					}
				}, 15_000);

				request.signal.addEventListener("abort", () => {
					unsubscribe();
					clearInterval(keepalive);
					try {
						controller.close();
					} catch {
						// Client may have already closed the stream.
					}
				});
				return;
			}

			const redisClient = redis;
			if (!redisClient) {
				try {
					controller.close();
				} catch {
					// Stream already closed.
				}
				return;
			}

			try {
				while (!request.signal.aborted) {
					const { entries, nextLastIds } = await readRealtimeStreamBatch(
						redisClient,
						streamKeys,
						lastIds,
						{ blockMS: 15_000, count: 10 },
					);
					lastIds = nextLastIds;

					if (entries.length === 0) {
						controller.enqueue(encoder.encode(encodeSseKeepalive()));
						continue;
					}

					for (const entry of entries) {
						const raw = parseStreamEntryData(entry.fields);
						const event = parseRealtimeEvent(raw);
						if (!event) continue;
						const roomId = roomIdFromStreamKey(entry.streamKey);
						if (!roomId) continue;
						controller.enqueue(
							encoder.encode(encodeRealtimeSseMessage(roomId, event)),
						);
					}
				}
			} catch (err) {
				if (!request.signal.aborted) {
					console.error("[realtime/stream]", err);
				}
			} finally {
				try {
					controller.close();
				} catch {
					// Client may have already closed the stream.
				}
			}
		},
	});

	return new Response(body, {
		headers: {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
