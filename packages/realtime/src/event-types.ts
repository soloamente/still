import { z } from "zod";

/** Broadcast after a review comment is persisted in Postgres. */
export const realtimeCommentCreatedEventSchema = z.object({
	type: z.literal("comment.created"),
	commentId: z.string(),
	preview: z.string(),
});

/** Broadcast after like/dislike counts change on a review. */
export const realtimeReactionUpdatedEventSchema = z.object({
	type: z.literal("reaction.updated"),
	likesCount: z.number().int().nonnegative(),
	dislikesCount: z.number().int().nonnegative(),
});

/** Broadcast after a notification row is inserted for a patron. */
export const realtimeNotificationCreatedEventSchema = z.object({
	type: z.literal("notification.created"),
	notificationId: z.string(),
	kind: z.string(),
});

/** Broadcast after a ranked list order is persisted in Postgres. */
export const realtimeListReorderedEventSchema = z.object({
	type: z.literal("list.reordered"),
	itemIds: z.array(z.string()).min(1),
});

/** Broadcast when listing room occupancy changes — clients refetch GET snapshot. */
export const realtimePresenceUpdatedEventSchema = z.object({
	type: z.literal("presence.updated"),
});

/** Broadcast after a chat message is persisted — delivered to thread members. */
export const realtimeChatMessageEventSchema = z.object({
	type: z.literal("chat.message"),
	message: z.object({
		id: z.string(),
		threadId: z.string(),
		userId: z.string(),
		body: z.string().nullable(),
		createdAt: z.string(),
	}),
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
	realtimeCommentCreatedEventSchema,
	realtimeReactionUpdatedEventSchema,
	realtimeNotificationCreatedEventSchema,
	realtimeListReorderedEventSchema,
	realtimePresenceUpdatedEventSchema,
	realtimeChatMessageEventSchema,
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/** Validate a realtime broadcast payload before patching client state. */
export function parseRealtimeEvent(data: unknown): RealtimeEvent | null {
	const parsed = realtimeEventSchema.safeParse(data);
	return parsed.success ? parsed.data : null;
}
