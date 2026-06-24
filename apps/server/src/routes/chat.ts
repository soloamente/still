import {
	chatMember,
	chatMessage,
	chatThread,
	db,
	profile,
	user,
} from "@still/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { deliverNotification } from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import { publishRealtimeEvent } from "../lib/realtime-publish";
import { routeBody } from "../lib/route-body";
import { broadcast } from "../ws/hub";

const createChatThreadBody = t.Object({
	kind: t.Union([t.Literal("dm"), t.Literal("group")]),
	memberIds: t.Array(t.String(), { minItems: 1 }),
	title: t.Optional(t.String({ maxLength: 80 })),
});

type CreateChatThreadBody = {
	kind: "dm" | "group";
	memberIds: string[];
	title?: string;
};

const postChatMessageBody = t.Object({
	body: t.Optional(t.String({ maxLength: 4000 })),
	replyToId: t.Optional(t.String()),
	attachments: t.Optional(t.Array(t.Any())),
});

/** Matches `chat_message.attachments` jsonb in @still/db — keep in sync with schema. */
type ChatMessageAttachment = {
	url: string;
	kind: "image" | "gif" | "video" | "audio" | "movie" | "review";
	refId?: string | number;
	width?: number;
	height?: number;
	duration?: number;
};

type PostChatMessageBody = {
	body?: string;
	replyToId?: string;
	attachments?: ChatMessageAttachment[];
};

/** Threads the caller is a member of, with the last message preview. */
async function threadsForUser(userId: string) {
	const memberships = await db
		.select({
			threadId: chatMember.threadId,
			lastReadAt: chatMember.lastReadAt,
		})
		.from(chatMember)
		.where(eq(chatMember.userId, userId));
	if (memberships.length === 0) return [];
	const ids = memberships.map((m) => m.threadId);
	const threads = await db
		.select()
		.from(chatThread)
		.where(inArray(chatThread.id, ids))
		.orderBy(desc(chatThread.lastMessageAt));
	const allMembers = await db
		.select({ chatMember, user, profile })
		.from(chatMember)
		.leftJoin(user, eq(chatMember.userId, user.id))
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(inArray(chatMember.threadId, ids));
	const byThread = new Map<string, typeof allMembers>();
	for (const row of allMembers) {
		const list = byThread.get(row.chatMember.threadId) ?? [];
		list.push(row);
		byThread.set(row.chatMember.threadId, list);
	}
	const lastReadByThread = new Map(
		memberships.map((m) => [m.threadId, m.lastReadAt] as const),
	);
	return threads.map((thread) => ({
		thread,
		members: byThread.get(thread.id) ?? [],
		lastReadAt: lastReadByThread.get(thread.id) ?? null,
	}));
}

export const chatRoute = new Elysia({ prefix: "/api/chat", tags: ["chat"] })
	.use(context)
	.get("/threads", async ({ user: viewer, status }) => {
		if (!viewer) return status(401, "Sign in");
		return threadsForUser(viewer.id);
	})
	.post(
		"/threads",
		async ({ body: rawBody, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			if (!hit(`chat:thread:${viewer.id}`, { limit: 20, windowMs: 60_000 }).ok)
				return status(429, "Slow down");

			const body = routeBody<CreateChatThreadBody>(rawBody);
			const memberIds = Array.from(new Set([viewer.id, ...body.memberIds]));
			if (memberIds.length < 2)
				return status(400, "Need at least one other member");

			// DM: if a 1:1 already exists with this pair, return it.
			if (body.kind === "dm" && memberIds.length === 2) {
				const [other] = memberIds.filter((id) => id !== viewer.id);
				const existing = await db.execute<{ thread_id: string }>(
					sql`select t.id as thread_id from chat_thread t
              where t.kind = 'dm' and (
                select count(*) from chat_member m
                where m.thread_id = t.id and m.user_id in (${viewer.id}, ${other})
              ) = 2 and (
                select count(*) from chat_member m
                where m.thread_id = t.id
              ) = 2
              limit 1`,
				);
				const row = existing.rows?.[0];
				if (row) {
					return { id: row.thread_id, reused: true };
				}
			}

			const id = makeId("thr");
			await db.insert(chatThread).values({
				id,
				kind: body.kind,
				title: body.title ?? null,
				createdById: viewer.id,
			});
			await db.insert(chatMember).values(
				memberIds.map((userId, i) => ({
					threadId: id,
					userId,
					role: i === 0 ? ("owner" as const) : ("member" as const),
				})),
			);
			return { id, reused: false };
		},
		{ body: createChatThreadBody },
	)
	.get(
		"/threads/:id/messages",
		async ({ params, user: viewer, query, status }) => {
			if (!viewer) return status(401, "Sign in");
			const [member] = await db
				.select()
				.from(chatMember)
				.where(
					and(
						eq(chatMember.threadId, params.id),
						eq(chatMember.userId, viewer.id),
					),
				)
				.limit(1);
			if (!member) return status(403, "Not a member");

			const limit = Math.min(Number(query.limit ?? 50), 100);
			const rows = await db
				.select({ chatMessage, user, profile })
				.from(chatMessage)
				.leftJoin(user, eq(chatMessage.userId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(chatMessage.threadId, params.id))
				.orderBy(desc(chatMessage.createdAt))
				.limit(limit);
			return rows.reverse();
		},
		{
			params: t.Object({ id: t.String() }),
			query: t.Object({ limit: t.Optional(t.String()) }),
		},
	)
	.post(
		"/threads/:id/messages",
		async ({ params, body: rawBody, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			if (!hit(`chat:msg:${viewer.id}`, { limit: 120, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<PostChatMessageBody>(rawBody);
			const [member] = await db
				.select()
				.from(chatMember)
				.where(
					and(
						eq(chatMember.threadId, params.id),
						eq(chatMember.userId, viewer.id),
					),
				)
				.limit(1);
			if (!member) return status(403, "Not a member");

			const id = makeId("msg");
			const created = new Date();
			const [row] = await db
				.insert(chatMessage)
				.values({
					id,
					threadId: params.id,
					userId: viewer.id,
					body: body.body ?? null,
					replyToId: body.replyToId ?? null,
					attachments: body.attachments ?? [],
					createdAt: created,
				})
				.returning();

			const preview = body.body
				? body.body.slice(0, 160)
				: (body.attachments?.[0]?.kind ?? "attachment");
			await db
				.update(chatThread)
				.set({
					lastMessageAt: created,
					lastMessagePreview: preview,
					lastMessageById: viewer.id,
				})
				.where(eq(chatThread.id, params.id));

			// Notify other thread members (Discord-style: only when not the sender).
			const members = await db
				.select({ userId: chatMember.userId })
				.from(chatMember)
				.where(eq(chatMember.threadId, params.id));
			for (const m of members) {
				if (m.userId === viewer.id) continue;
				await deliverNotification({
					userId: m.userId,
					kind: "chat.message",
					title: `${viewer.name ?? "Someone"} sent a message`,
					body: preview,
					payload: { threadId: params.id, messageId: id, href: "/chat" },
					context: { actorUserId: viewer.id },
				});
			}

			// Fan out the new message. Best-effort; messages persist either way.
			// Legacy in-process hub (SSE-mode `/ws/chat`) + Cloudflare realtime
			// Worker (WS transport). Dual-broadcast keeps cutover reversible.
			broadcast(params.id, { kind: "message", payload: row });
			if (row) {
				void publishRealtimeEvent(chatRoomId(params.id), {
					type: "chat.message",
					message: {
						id: row.id,
						threadId: row.threadId,
						userId: row.userId,
						body: row.body,
						createdAt: row.createdAt.toISOString(),
					},
				});
			}

			return row;
		},
		{
			params: t.Object({ id: t.String() }),
			body: postChatMessageBody,
		},
	)
	.post(
		"/threads/:id/read",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			await db
				.update(chatMember)
				.set({ lastReadAt: new Date() })
				.where(
					and(
						eq(chatMember.threadId, params.id),
						eq(chatMember.userId, viewer.id),
					),
				);
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	);
