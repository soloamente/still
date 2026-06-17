import type { Redis } from "@upstash/redis";

/** Max multiplexed logical rooms per SSE connection. */
export const REALTIME_STREAM_MAX_ROOMS = 8;

export type RealtimeStreamEntry = {
	streamKey: string;
	entryId: string;
	fields: Record<string, unknown>;
};

/** Parse `?rooms=` into deduped room ids; null when missing or invalid. */
export function parseRealtimeStreamRoomsParam(
	roomsParam: string | null,
): string[] | null {
	if (!roomsParam?.trim()) return null;
	const rooms = [
		...new Set(
			roomsParam
				.split(",")
				.map((room) => room.trim())
				.filter(Boolean),
		),
	];
	if (rooms.length === 0 || rooms.length > REALTIME_STREAM_MAX_ROOMS) {
		return null;
	}
	return rooms;
}

/** Normalize raw Redis XREAD payloads from Upstash into flat stream entries. */
export function parseXReadResult(result: unknown): RealtimeStreamEntry[] {
	if (!result || !Array.isArray(result)) return [];

	const entries: RealtimeStreamEntry[] = [];

	for (const streamChunk of result) {
		if (!Array.isArray(streamChunk) || streamChunk.length < 2) continue;

		const streamKey = String(streamChunk[0]);
		const messages = streamChunk[1];
		if (!Array.isArray(messages)) continue;

		for (const message of messages) {
			if (!Array.isArray(message) || message.length < 2) continue;

			const entryId = String(message[0]);
			const fieldList = message[1];
			const fields: Record<string, unknown> = {};

			if (Array.isArray(fieldList)) {
				for (let i = 0; i < fieldList.length; i += 2) {
					fields[String(fieldList[i])] = fieldList[i + 1];
				}
			} else if (typeof fieldList === "object" && fieldList !== null) {
				Object.assign(fields, fieldList as Record<string, unknown>);
			}

			entries.push({ streamKey, entryId, fields });
		}
	}

	return entries;
}

/** Blocking XREAD across one or more Redis stream keys (Upstash REST API). */
export async function readRealtimeStreamBatch(
	redis: Redis,
	streamKeys: string[],
	lastIds: Record<string, string>,
	opts: { blockMS: number; count: number },
): Promise<{
	entries: RealtimeStreamEntry[];
	nextLastIds: Record<string, string>;
}> {
	if (streamKeys.length === 0) {
		return { entries: [], nextLastIds: lastIds };
	}

	const ids = streamKeys.map((key) => lastIds[key] ?? "$");
	const result = await redis.xread(streamKeys, ids, {
		count: opts.count,
		blockMS: opts.blockMS,
	});

	const entries = parseXReadResult(result);
	const nextLastIds = { ...lastIds };

	for (const entry of entries) {
		nextLastIds[entry.streamKey] = entry.entryId;
	}

	return { entries, nextLastIds };
}
