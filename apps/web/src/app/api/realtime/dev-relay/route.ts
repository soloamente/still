import { parseRealtimeEvent } from "@still/realtime";

import {
	emitRealtimeDevBusEvent,
	shouldUseRealtimeDevBus,
} from "@/lib/realtime-dev-bus";

export const runtime = "nodejs";

/**
 * Dev-only bridge: Elysia publishes here when Upstash is unset so SSE works locally.
 * Production always uses Upstash Redis Streams.
 */
export async function POST(request: Request) {
	if (!shouldUseRealtimeDevBus()) {
		return new Response("Not found", { status: 404 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response("Bad request", { status: 400 });
	}

	if (typeof body !== "object" || body === null) {
		return new Response("Bad request", { status: 400 });
	}

	const roomId =
		"roomId" in body && typeof body.roomId === "string"
			? body.roomId.trim()
			: "";
	if (!roomId) {
		return new Response("Bad request", { status: 400 });
	}

	const event = parseRealtimeEvent("event" in body ? body.event : body);
	if (!event) {
		return new Response("Bad request", { status: 400 });
	}

	emitRealtimeDevBusEvent(roomId, event);
	return new Response(null, { status: 204 });
}
