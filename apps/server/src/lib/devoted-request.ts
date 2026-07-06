import { db, productEvent, profile } from "@still/db";
import { type PlanTierId, resolveEffectiveTier } from "@still/plans";
import { and, eq, gte, sql } from "drizzle-orm";

import { notifyStaffDevotedRequest } from "./devoted-request-notification";
import { recordProductEvent } from "./record-product-event";

export type DevotedRequestRejectReason =
	| "already_devoted"
	| "already_requested";

export type DevotedRequestResult =
	| { submitted: true }
	| { submitted: false; reason: DevotedRequestRejectReason };

/** Cooldown window — one open request per patron per week. */
export const DEVOTED_REQUEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Pure policy for Devoted invite requests. */
export function shouldRejectDevotedRequest(input: {
	effectiveTier: PlanTierId;
	recentRequestCount: number;
}): DevotedRequestRejectReason | null {
	if (input.effectiveTier === "devoted") return "already_devoted";
	if (input.recentRequestCount > 0) return "already_requested";
	return null;
}

async function countRecentDevotedRequests(userId: string): Promise<number> {
	const since = new Date(Date.now() - DEVOTED_REQUEST_COOLDOWN_MS);
	const [row] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(productEvent)
		.where(
			and(
				eq(productEvent.userId, userId),
				eq(productEvent.kind, "devoted.request"),
				gte(productEvent.createdAt, since),
			),
		);
	return Number(row?.total ?? 0);
}

/** Submit a Devoted invite request — staff inbox + product funnel row. */
export async function submitDevotedRequest(
	userId: string,
): Promise<DevotedRequestResult> {
	const [profileRow] = await db
		.select({
			handle: profile.handle,
			displayName: profile.displayName,
			subscriptionTier: profile.subscriptionTier,
			planOverride: profile.planOverride,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!profileRow) {
		throw new Error("Profile not found");
	}

	const effectiveTier = resolveEffectiveTier({
		subscriptionTier: (profileRow.subscriptionTier ?? "still") as PlanTierId,
		planOverride: (profileRow.planOverride as PlanTierId | null) ?? null,
	});

	const recentRequestCount = await countRecentDevotedRequests(userId);
	const rejectReason = shouldRejectDevotedRequest({
		effectiveTier,
		recentRequestCount,
	});
	if (rejectReason) {
		return { submitted: false, reason: rejectReason };
	}

	await recordProductEvent(userId, "devoted.request", {
		handle: profileRow.handle,
		effectiveTier,
	});

	await notifyStaffDevotedRequest({
		patronUserId: userId,
		patronHandle: profileRow.handle,
		patronDisplayName: profileRow.displayName,
	});

	return { submitted: true };
}
