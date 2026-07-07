import { db, notification, profile } from "@still/db";
import { and, eq, gte, sql } from "drizzle-orm";

import { extractPatronMentionHandles } from "./content-mention-handles";
import { deliverNotification } from "./notification-delivery";
import { movieReviewNotificationHref } from "./review-notification-href";

/** Re-notify the same patron about the same review from the same actor at most once per day. */
const DEDUPE_MS = 24 * 60 * 60 * 1000;

export { extractPatronMentionHandles } from "./content-mention-handles";

async function mentionNotificationRecentlyDelivered(input: {
	userId: string;
	reviewId: string;
	actorUserId: string;
	since: Date;
}): Promise<boolean> {
	const [row] = await db
		.select({ id: notification.id })
		.from(notification)
		.where(
			and(
				eq(notification.userId, input.userId),
				eq(notification.kind, "mention.in_review_or_comment"),
				gte(notification.createdAt, input.since),
				sql`${notification.payload}->>'reviewId' = ${input.reviewId}`,
				sql`${notification.payload}->>'fromUserId' = ${input.actorUserId}`,
			),
		)
		.limit(1);
	return Boolean(row);
}

/** SN.9.1 — deliver inbox rows when patrons are @mentioned in a review or comment. */
export async function notifyPatronMentionsInContent(input: {
	body: string;
	actorUserId: string;
	actorDisplayName: string;
	reviewId: string;
	movieId: number;
	listingTitle?: string | null;
	commentId?: string | null;
}): Promise<void> {
	const handles = extractPatronMentionHandles(input.body);
	if (handles.length === 0) return;

	const since = new Date(Date.now() - DEDUPE_MS);
	const hrefBase = movieReviewNotificationHref(input.movieId, input.reviewId);
	const href = input.commentId
		? `${hrefBase}&comment=${encodeURIComponent(input.commentId)}`
		: hrefBase;
	const titleSuffix = input.listingTitle?.trim()
		? ` on “${input.listingTitle.trim().slice(0, 80)}”`
		: "";
	const from = input.actorDisplayName.trim() || "Someone";
	const title = input.commentId
		? `${from} mentioned you in a comment${titleSuffix}`
		: `${from} mentioned you in a review${titleSuffix}`;

	for (const handle of handles) {
		const [row] = await db
			.select({ userId: profile.userId, isPrivate: profile.isPrivate })
			.from(profile)
			.where(eq(profile.handle, handle))
			.limit(1);
		if (!row || row.isPrivate || row.userId === input.actorUserId) continue;

		if (
			await mentionNotificationRecentlyDelivered({
				userId: row.userId,
				reviewId: input.reviewId,
				actorUserId: input.actorUserId,
				since,
			})
		) {
			continue;
		}

		await deliverNotification({
			userId: row.userId,
			kind: "mention.in_review_or_comment",
			title,
			payload: {
				reviewId: input.reviewId,
				commentId: input.commentId ?? undefined,
				movieId: input.movieId,
				href,
				fromUserId: input.actorUserId,
			},
			context: { actorUserId: input.actorUserId },
		});
	}
}
