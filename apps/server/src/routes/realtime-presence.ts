import { isPatronAppRoomId, patronAppRoomId } from "@still/realtime";
import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	getListingPresenceSnapshotMerged,
	isListingPresenceRoom,
	type ListingPresenceRedis,
	leaveListingPresence,
	touchListingPresence,
} from "../lib/listing-presence";
import {
	leavePatronAppPresence,
	resolveOnlinePresenceForViewer,
	touchPatronAppPresence,
} from "../lib/patron-presence";
import { normalizeActivityState } from "../lib/presence-activity";
import { getPresenceRedis } from "../lib/presence-redis";
import { hit } from "../lib/rate-limit";
import { fetchWorkerOccupancy } from "../lib/realtime-occupancy";
import { publishRealtimeEvent } from "../lib/realtime-publish";

/** Upstash (or local dev in-memory shim) for presence ZSET + activity HASH. */
function presenceRedis(): ListingPresenceRedis | null {
	return getPresenceRedis();
}

/** POST/DELETE rooms — listing detail occupancy or app-wide patron heartbeat. */
function isWritablePresenceRoom(roomId: string): boolean {
	return isListingPresenceRoom(roomId) || isPatronAppRoomId(roomId);
}

/** Fan out invalidation when occupancy changes — clients refetch GET snapshot. */
function publishPresenceUpdated(roomId: string): void {
	void publishRealtimeEvent(roomId, { type: "presence.updated" });
}

export const realtimePresenceRoute = new Elysia({
	prefix: "/api/realtime/presence",
	tags: ["realtime"],
})
	.use(context)
	.post(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in");
			// ~2.4 heartbeats/min at 25s + active/away flips — 6/min was dropping patrons offline.
			if (!hit(`presence:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			if (!isWritablePresenceRoom(body.room)) {
				return status(403, "Invalid room");
			}

			const redis = presenceRedis();
			if (!redis) {
				if (process.env.NODE_ENV === "production") {
					console.error(
						"[presence] UPSTASH_REDIS_REST_URL/TOKEN unset — heartbeats are no-ops",
					);
				}
				return { ok: true };
			}

			const activityState = normalizeActivityState(body.activityState);

			const result = isPatronAppRoomId(body.room)
				? await touchPatronAppPresence(
						redis,
						user.id,
						Date.now(),
						activityState,
					)
				: await touchListingPresence(
						redis,
						body.room,
						user.id,
						Date.now(),
						activityState,
					);
			if (result.changed) publishPresenceUpdated(body.room);

			return { ok: true };
		},
		{
			body: t.Object({
				room: t.String(),
				activityState: t.Optional(
					t.Union([t.Literal("active"), t.Literal("away")]),
				),
			}),
		},
	)
	.delete(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!isWritablePresenceRoom(body.room)) {
				return status(403, "Invalid room");
			}

			const redis = presenceRedis();
			if (!redis) {
				if (process.env.NODE_ENV === "production") {
					console.error(
						"[presence] UPSTASH_REDIS_REST_URL/TOKEN unset — heartbeats are no-ops",
					);
				}
				return { ok: true };
			}

			const result = isPatronAppRoomId(body.room)
				? await leavePatronAppPresence(redis, user.id)
				: await leaveListingPresence(redis, body.room, user.id);
			if (result.changed) publishPresenceUpdated(body.room);

			return { ok: true };
		},
		{
			body: t.Object({
				room: t.String(),
			}),
		},
	)
	.get(
		"/online",
		async ({ query, user, status }) => {
			if (!user) return status(401, "Sign in");

			const handles = query.handles
				.split(",")
				.map((handle) => handle.trim())
				.filter(Boolean);

			const workerEntries = await fetchWorkerOccupancy(patronAppRoomId());
			const presence = await resolveOnlinePresenceForViewer(
				user.id,
				handles,
				presenceRedis(),
				workerEntries,
			);

			return { presence };
		},
		{
			query: t.Object({
				handles: t.String(),
			}),
		},
	)
	.get(
		"/",
		async ({ query, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!isListingPresenceRoom(query.room)) {
				return status(403, "Invalid room");
			}

			const workerEntries = await fetchWorkerOccupancy(query.room);
			return getListingPresenceSnapshotMerged(
				user.id,
				query.room,
				presenceRedis(),
				workerEntries,
			);
		},
		{
			query: t.Object({
				room: t.String(),
			}),
		},
	);
