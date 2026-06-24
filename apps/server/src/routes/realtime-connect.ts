import { timingSafeEqual } from "node:crypto";
import { chatMember, db, list, review } from "@still/db";
import { env } from "@still/env/server";
import {
	classifyRoom,
	parseChatRoomId,
	parseListRoomId,
	parseReviewRoomId,
} from "@still/realtime";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { canViewContent, resolveViewerFollow } from "../lib/content-visibility";
import { canViewList } from "../lib/list-view-access";
import { signConnectToken } from "../lib/realtime-token";

function checkInternalSecret(authHeader: string | null): boolean {
	if (!env.REALTIME_INTERNAL_SECRET) return false;
	if (!authHeader?.startsWith("Bearer ")) return false;
	const provided = authHeader.slice(7);
	try {
		return timingSafeEqual(
			Buffer.from(provided, "utf8"),
			Buffer.from(env.REALTIME_INTERNAL_SECRET, "utf8"),
		);
	} catch {
		return false;
	}
}

async function isDynamicRoomAllowed(
	userId: string,
	room: string,
): Promise<boolean> {
	const threadId = parseChatRoomId(room);
	if (threadId) {
		const [member] = await db
			.select({ threadId: chatMember.threadId })
			.from(chatMember)
			.where(
				and(eq(chatMember.threadId, threadId), eq(chatMember.userId, userId)),
			)
			.limit(1);
		return Boolean(member);
	}

	const reviewId = parseReviewRoomId(room);
	if (reviewId) {
		const [row] = await db
			.select({ userId: review.userId, visibility: review.visibility })
			.from(review)
			.where(eq(review.id, reviewId))
			.limit(1);
		if (!row) return false;
		if (row.userId === userId) return true;
		const { viewerFollowsAuthor, viewerIsMutual } = await resolveViewerFollow(
			userId,
			row.userId,
		);
		return canViewContent({
			viewerId: userId,
			authorId: row.userId,
			visibility: row.visibility,
			viewerFollowsAuthor,
			viewerIsMutual,
		});
	}

	const listId = parseListRoomId(room);
	if (listId) {
		const [row] = await db
			.select({ id: list.id, isPublic: list.isPublic, userId: list.userId })
			.from(list)
			.where(eq(list.id, listId))
			.limit(1);
		if (!row) return false;
		return canViewList(row, userId);
	}

	return false;
}

export const realtimeConnectRoute = new Elysia({
	prefix: "/api/realtime",
	tags: ["realtime"],
})
	.use(context)
	// Mint a short-lived JWT for WebSocket connect auth.
	.get("/token", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (!env.REALTIME_JWT_SECRET) return status(503, "Realtime not configured");
		const token = await signConnectToken(user.id, env.REALTIME_JWT_SECRET);
		return { token };
	})
	// Internal — called by the Cloudflare Worker to authorize dynamic rooms.
	.post(
		"/authorize",
		async ({ request, body, status }) => {
			if (!checkInternalSecret(request.headers.get("Authorization"))) {
				return status(401, "Unauthorized");
			}
			const { tier, ownerUserId } = classifyRoom(body.room);
			if (tier === "deny") return { allowed: false };
			if (tier === "allow") return { allowed: true };
			if (tier === "self") return { allowed: body.userId === ownerUserId };
			const allowed = await isDynamicRoomAllowed(body.userId, body.room);
			return { allowed };
		},
		{
			body: t.Object({ userId: t.String(), room: t.String() }),
		},
	);
