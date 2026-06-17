import { parseRealtimeEvent, type RealtimeEvent } from "@still/realtime";

/** Wire envelope multiplexed on one SSE connection. */
export type RealtimeSseMessage = {
	room: string;
	event: RealtimeEvent;
};

/** Encode a validated realtime event for a logical room id. */
export function encodeRealtimeSseMessage(
	room: string,
	event: RealtimeEvent,
): string {
	return encodeSseData({ room, event });
}

/** Parse SSE JSON payloads from `/api/realtime/stream`. */
export function parseRealtimeSseMessage(
	raw: unknown,
): RealtimeSseMessage | null {
	if (typeof raw !== "object" || raw === null) return null;
	if (!("room" in raw) || typeof raw.room !== "string") return null;
	const event = parseRealtimeEvent("event" in raw ? raw.event : raw);
	if (!event) return null;
	return { room: raw.room, event };
}

/** Map Redis stream key back to logical room id (`sense:stream:{roomId}`). */
export function roomIdFromStreamKey(streamKey: string): string | null {
	const prefix = "sense:stream:";
	if (!streamKey.startsWith(prefix)) return null;
	const roomId = streamKey.slice(prefix.length);
	return roomId.length > 0 ? roomId : null;
}

/** Encode a JSON payload as a single SSE `data:` frame (double newline terminated). */
export function encodeSseData(payload: unknown): string {
	return `data: ${JSON.stringify(payload)}\n\n`;
}

/** Comment-line keepalive so proxies and browsers do not idle-close the stream. */
export function encodeSseKeepalive(): string {
	return `: keepalive ${Date.now()}\n\n`;
}

/** Parse Redis stream field `data` (string or nested object) into JSON-ready value. */
export function parseStreamEntryData(raw: unknown): unknown | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		try {
			return JSON.parse(raw) as unknown;
		} catch {
			return null;
		}
	}
	if (typeof raw === "object" && raw !== null) {
		if ("data" in raw) {
			return parseStreamEntryData((raw as { data: unknown }).data);
		}
		// Upstash REST JSON-deserializes stream field values on XREAD.
		if ("type" in raw && typeof (raw as { type: unknown }).type === "string") {
			return raw;
		}
	}
	return null;
}
