import { db, follow, profile, user } from "@still/db";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { fetchOverlapDiarySlices } from "../lib/fetch-overlap-diary-slices";
import { deliverNotification } from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import {
	buildOverlapDiaryMap,
	computeTasteOverlap,
} from "../lib/sense-taste-overlap";
import { buildSuggestedPatrons } from "../lib/suggested-patron-discovery";
import { buildTasteMatchedDiscovery } from "../lib/taste-matched-discovery";

async function resolveProfileByHandle(handle: string) {
	const normalized = handle.toLowerCase();
	const [row] = await db
		.select({ user, profile })
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.handle, normalized))
		.limit(1);
	return row ?? null;
}

function canViewDiaryForOverlap(args: {
	targetIsPrivate: boolean;
	viewerId: string | null;
	targetUserId: string;
	isFollowing: boolean;
}): boolean {
	if (!args.targetIsPrivate) return true;
	if (!args.viewerId) return false;
	if (args.viewerId === args.targetUserId) return true;
	return args.isFollowing;
}

async function isViewerFollowing(
	viewerId: string,
	targetUserId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ followerId: follow.followerId })
		.from(follow)
		.where(
			and(
				eq(follow.followerId, viewerId),
				eq(follow.followingId, targetUserId),
			),
		)
		.limit(1);
	return Boolean(row);
}

async function computeOverlapBetweenUserIds(
	viewerUserId: string,
	targetUserId: string,
) {
	const [viewerSlices, targetSlices] = await Promise.all([
		fetchOverlapDiarySlices(viewerUserId),
		fetchOverlapDiarySlices(targetUserId),
	]);
	return computeTasteOverlap(
		buildOverlapDiaryMap(viewerSlices),
		buildOverlapDiaryMap(targetSlices),
	);
}

export const tasteRoute = new Elysia({
	prefix: "/api/taste",
	tags: ["taste"],
})
	.use(context)
	/** Rule-based movie picks from diary taste (ST.4) — Movies lobby rail. */
	.get("/for-you", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (!hit(`taste:for-you:${user.id}`, { limit: 60, windowMs: 60_000 }).ok) {
			return status(429, "Slow down");
		}
		return buildTasteMatchedDiscovery(user.id);
	})
	/** SN.16 — patrons with high diary overlap (excludes already-followed). */
	.get("/suggested-patrons", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (
			!hit(`taste:suggested-patrons:${user.id}`, {
				limit: 30,
				windowMs: 60_000,
			}).ok
		) {
			return status(429, "Slow down");
		}
		return buildSuggestedPatrons(user.id);
	})
	/** Signed-in viewer vs profile handle — full comparison payload. */
	.get(
		"/overlap/:handle",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in to compare tastes");

			const targetRow = await resolveProfileByHandle(params.handle);
			if (!targetRow) return status(404, "Profile not found");
			if (targetRow.user.id === viewer.id)
				return status(400, "Compare with someone else");

			const following = await isViewerFollowing(viewer.id, targetRow.user.id);
			if (
				!canViewDiaryForOverlap({
					targetIsPrivate: targetRow.profile.isPrivate,
					viewerId: viewer.id,
					targetUserId: targetRow.user.id,
					isFollowing: following,
				})
			) {
				return status(403, "This diary is private");
			}

			const [viewerProfile] = await db
				.select({
					handle: profile.handle,
					displayName: profile.displayName,
				})
				.from(profile)
				.where(eq(profile.userId, viewer.id))
				.limit(1);
			if (!viewerProfile) return status(404, "Your profile is not ready");

			const overlap = await computeOverlapBetweenUserIds(
				viewer.id,
				targetRow.user.id,
			);

			return {
				viewer: {
					handle: viewerProfile.handle,
					displayName: viewerProfile.displayName,
				},
				target: {
					handle: targetRow.profile.handle,
					displayName: targetRow.profile.displayName,
				},
				overlap,
			};
		},
		{ params: t.Object({ handle: t.String() }) },
	)
	/**
	 * Public aggregate compare (OG / share) — both handles must exist.
	 * Order-independent; uses lexicographically first user id as "viewer" axis for divergences only.
	 */
	.get(
		"/compare",
		async ({ query, user: viewer, status }) => {
			const rowA = await resolveProfileByHandle(query.a);
			const rowB = await resolveProfileByHandle(query.b);
			if (!rowA || !rowB) return status(404, "Profile not found");
			if (rowA.user.id === rowB.user.id)
				return status(400, "Choose two different patrons");

			const viewerId = viewer?.id ?? null;
			const canSeeA = canViewDiaryForOverlap({
				targetIsPrivate: rowA.profile.isPrivate,
				viewerId,
				targetUserId: rowA.user.id,
				isFollowing: viewerId
					? await isViewerFollowing(viewerId, rowA.user.id)
					: false,
			});
			const canSeeB = canViewDiaryForOverlap({
				targetIsPrivate: rowB.profile.isPrivate,
				viewerId,
				targetUserId: rowB.user.id,
				isFollowing: viewerId
					? await isViewerFollowing(viewerId, rowB.user.id)
					: false,
			});
			if (!canSeeA || !canSeeB) {
				return status(403, "One or both diaries are private");
			}

			const [first, second] =
				rowA.user.id < rowB.user.id ? [rowA, rowB] : [rowB, rowA];

			const overlap = await computeOverlapBetweenUserIds(
				first.user.id,
				second.user.id,
			);

			return {
				a: {
					handle: rowA.profile.handle,
					displayName: rowA.profile.displayName,
				},
				b: {
					handle: rowB.profile.handle,
					displayName: rowB.profile.displayName,
				},
				overlap,
			};
		},
		{
			query: t.Object({
				a: t.String(),
				b: t.String(),
			}),
		},
	)
	/** Taste challenge — notifies the target to open a comparison on the challenger's profile. */
	.post(
		"/challenge/:handle",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in to send a taste challenge");
			if (
				!hit(`taste-challenge:${viewer.id}`, { limit: 20, windowMs: 60_000 }).ok
			) {
				return status(429, "Slow down");
			}

			const targetRow = await resolveProfileByHandle(params.handle);
			if (!targetRow) return status(404, "Profile not found");
			if (targetRow.user.id === viewer.id)
				return status(400, "Cannot challenge yourself");

			const [viewerProfile] = await db
				.select({
					handle: profile.handle,
					displayName: profile.displayName,
				})
				.from(profile)
				.where(eq(profile.userId, viewer.id))
				.limit(1);
			if (!viewerProfile) return status(404, "Your profile is not ready");

			const displayName = viewerProfile.displayName ?? viewer.name ?? "Someone";

			await deliverNotification({
				userId: targetRow.user.id,
				kind: "taste.challenge",
				title: `${displayName} sent a taste challenge`,
				body: "Compare your diaries side by side — accept to open the overlap sheet.",
				payload: {
					fromUserId: viewer.id,
					challengerHandle: viewerProfile.handle,
					href: `/profile/${viewerProfile.handle}?tasteCompare=1`,
				},
				context: { actorUserId: viewer.id },
			});

			return { sent: true };
		},
		{ params: t.Object({ handle: t.String() }) },
	);
