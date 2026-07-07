import { db, follow, notification, profile } from "@still/db";
import { userInboxRoomId } from "@still/realtime";
import { and, eq } from "drizzle-orm";

import { makeId } from "./cuid";
import { publishRealtimeEvent } from "./realtime-publish";
import { movieReviewNotificationHref } from "./review-notification-href";

/** Nested key on `profile.preferences` for per-kind inbox toggles. */
export const PROFILE_PREF_NOTIFICATIONS = "notifications" as const;

export const NOTIFICATION_KIND_REGISTRY = [
	{
		id: "follow.created",
		label: "New followers",
		description: "When someone starts following you.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "comment.on_review",
		label: "Comments on your reviews",
		description: "When someone comments on a review you wrote.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "comment.replied",
		label: "Replies to your comments",
		description: "When someone replies in a thread you joined.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "mention.in_review_or_comment",
		label: "Mentions",
		description: "When someone @mentions you in a review or comment.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "badge.awarded",
		label: "Badge unlocks",
		description: "Prestige badges and milestones worth celebrating.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "import.completed",
		label: "Diary imports",
		description: "When a Letterboxd import finishes.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "taste.challenge",
		label: "Taste challenges",
		description: "When someone invites you to compare taste.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "challenge.completed",
		label: "Completionist challenges",
		description: "When you finish a challenge set you joined.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "review.liked",
		label: "Review likes",
		description: "Only when you and the liker follow each other.",
		defaultEnabled: false,
		requiresOptIn: true,
	},
	{
		id: "chat.message",
		label: "Chat messages",
		description: "New messages in threads you belong to.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "tv.new_episode",
		label: "New TV episodes",
		description: "When a show you track airs a new episode.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "quote.submission.approved",
		label: "Quote approvals",
		description: "When staff publishes a quote you submitted.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "quote.submission.rejected",
		label: "Quote rejections",
		description: "When staff declines a quote you submitted.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "feedback.replied",
		label: "Feedback replies",
		description: "When the Sense team replies to feedback you sent.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "watchlist_now_streaming",
		label: "Watchlist streaming",
		description: "When a watchlisted title starts streaming in your region.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "referral.qualified",
		label: "Referral qualified",
		description: "When someone you invited finishes onboarding.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "referral.milestone",
		label: "Referral milestones",
		description: "When you unlock Invite & earn rewards.",
		defaultEnabled: true,
		requiresOptIn: false,
	},
	{
		id: "devoted.request",
		label: "Devoted invite requests",
		description: "When a patron requests Devoted access (staff only).",
		defaultEnabled: true,
		requiresOptIn: false,
	},
] as const;

export type NotificationKind =
	(typeof NOTIFICATION_KIND_REGISTRY)[number]["id"];

const DEFAULTS = Object.fromEntries(
	NOTIFICATION_KIND_REGISTRY.map((k) => [k.id, k.defaultEnabled]),
) as Record<NotificationKind, boolean>;

export type NotificationPrefs = Record<NotificationKind, boolean>;

export interface NotificationDeliveryContext {
	/** Actor who triggered the event (skip self-notify). */
	actorUserId?: string;
	/** Required for `review.liked` when prefs allow likes. */
	isMutual?: boolean;
}

/** Merge stored `preferences.notifications` with registry defaults. */
export function readNotificationPrefs(
	preferences: Record<string, unknown> | null | undefined,
): NotificationPrefs {
	const merged = { ...DEFAULTS };
	const raw = preferences?.[PROFILE_PREF_NOTIFICATIONS];
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
		return merged;
	}
	for (const entry of NOTIFICATION_KIND_REGISTRY) {
		const value = (raw as Record<string, unknown>)[entry.id];
		if (typeof value === "boolean") merged[entry.id] = value;
	}
	return merged;
}

/** Pure policy check (used in tests and after prefs are loaded). */
export function isNotificationEnabled(
	prefs: NotificationPrefs,
	kind: NotificationKind,
	userId: string,
	context?: NotificationDeliveryContext,
): boolean {
	if (context?.actorUserId && context.actorUserId === userId) return false;
	if (!prefs[kind]) return false;
	if (kind === "review.liked" && context?.isMutual !== true) return false;
	return true;
}

async function loadPrefsForUser(userId: string): Promise<NotificationPrefs> {
	const [row] = await db
		.select({ preferences: profile.preferences })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	return readNotificationPrefs(
		(row?.preferences as Record<string, unknown> | undefined) ?? null,
	);
}

/** Whether liker and review author mutually follow (either direction flagged `isMutual`). */
export async function areUsersMutualFollows(
	userA: string,
	userB: string,
): Promise<boolean> {
	const [row] = await db
		.select({ isMutual: follow.isMutual })
		.from(follow)
		.where(
			and(
				eq(follow.followerId, userA),
				eq(follow.followingId, userB),
				eq(follow.isMutual, true),
			),
		)
		.limit(1);
	return Boolean(row?.isMutual);
}

export interface DeliverNotificationInput {
	userId: string;
	kind: NotificationKind;
	title: string;
	body?: string | null;
	payload?: Record<string, unknown>;
	context?: NotificationDeliveryContext;
	/** Skip a profile read when the caller already loaded prefs (e.g. chat fan-out). */
	prefs?: NotificationPrefs;
}

/**
 * Inserts an inbox row when the recipient's prefs allow it. Never throws to callers;
 * logs insert failures so parent actions (comment, follow, like) still succeed.
 */
export async function deliverNotification(
	input: DeliverNotificationInput,
): Promise<void> {
	try {
		const prefs = input.prefs ?? (await loadPrefsForUser(input.userId));
		if (
			!isNotificationEnabled(prefs, input.kind, input.userId, input.context)
		) {
			return;
		}
		const notificationId = makeId("ntf");
		await db.insert(notification).values({
			id: notificationId,
			userId: input.userId,
			kind: input.kind,
			title: input.title,
			body: input.body ?? null,
			payload: input.payload ?? {},
		});
		void publishRealtimeEvent(userInboxRoomId(input.userId), {
			type: "notification.created",
			notificationId,
			kind: input.kind,
		});
	} catch (err) {
		console.error("[notification-delivery]", input.kind, err);
	}
}

export interface NotifyReviewCommentInput {
	reviewId: string;
	movieId: number;
	reviewAuthorId: string;
	commenterId: string;
	commenterDisplayName: string;
	replyToUserId: string | null;
	reviewTitle?: string | null;
}

/**
 * SN.9 — review comments: owner + reply target, deduped when the same person.
 */
export async function notifyOnReviewComment(
	input: NotifyReviewCommentInput,
): Promise<void> {
	const titleSuffix = input.reviewTitle?.trim()
		? ` on “${input.reviewTitle.trim().slice(0, 80)}”`
		: "";
	const from = input.commenterDisplayName.trim() || "Someone";
	const payload = {
		reviewId: input.reviewId,
		movieId: input.movieId,
		fromUserId: input.commenterId,
		href: movieReviewNotificationHref(input.movieId, input.reviewId),
	};

	const notifyReply =
		input.replyToUserId != null && input.replyToUserId !== input.commenterId;
	const notifyOwner =
		input.reviewAuthorId !== input.commenterId &&
		(!notifyReply || input.reviewAuthorId !== input.replyToUserId);

	if (notifyReply && input.replyToUserId) {
		await deliverNotification({
			userId: input.replyToUserId,
			kind: "comment.replied",
			title: `${from} replied to your comment${titleSuffix}`,
			payload,
			context: { actorUserId: input.commenterId },
		});
	}

	if (notifyOwner) {
		await deliverNotification({
			userId: input.reviewAuthorId,
			kind: "comment.on_review",
			title: `${from} commented on your review${titleSuffix}`,
			payload,
			context: { actorUserId: input.commenterId },
		});
	}
}
