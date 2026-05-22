import { db, eventLog, follow, notification, profile, user } from "@still/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { hit } from "../lib/rate-limit";

export const followsRoute = new Elysia({
	prefix: "/api/follows",
	tags: ["follows"],
})
	.use(context)
	.post(
		"/:userId",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			if (viewer.id === params.userId)
				return status(400, "Cannot follow yourself");
			if (!hit(`follow:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok)
				return status(429, "Slow down");

			const [target] = await db
				.select()
				.from(user)
				.where(eq(user.id, params.userId))
				.limit(1);
			if (!target) return status(404, "User not found");

			const [viewerProfile] = await db
				.select({ handle: profile.handle })
				.from(profile)
				.where(eq(profile.userId, viewer.id))
				.limit(1);

			await db
				.insert(follow)
				.values({ followerId: viewer.id, followingId: params.userId })
				.onConflictDoNothing();

			// Reciprocal flag (mutual follow).
			const [reciprocal] = await db
				.select()
				.from(follow)
				.where(
					and(
						eq(follow.followerId, params.userId),
						eq(follow.followingId, viewer.id),
					),
				)
				.limit(1);
			if (reciprocal) {
				await db
					.update(follow)
					.set({ isMutual: true })
					.where(
						and(
							eq(follow.followerId, viewer.id),
							eq(follow.followingId, params.userId),
						),
					);
				await db
					.update(follow)
					.set({ isMutual: true })
					.where(
						and(
							eq(follow.followerId, params.userId),
							eq(follow.followingId, viewer.id),
						),
					);
			}

			await db.insert(notification).values({
				id: makeId("ntf"),
				userId: params.userId,
				kind: "follow.created",
				title: `${viewer.name ?? "Someone"} started following you`,
				payload: {
					fromUserId: viewer.id,
					...(viewerProfile?.handle
						? { href: `/profile/${viewerProfile.handle}` }
						: {}),
				},
			});
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: viewer.id,
				kind: "follow.created",
				payload: { followingId: params.userId },
			});
			return { following: true };
		},
		{ params: t.Object({ userId: t.String() }) },
	)
	.delete(
		"/:userId",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			await db
				.delete(follow)
				.where(
					and(
						eq(follow.followerId, viewer.id),
						eq(follow.followingId, params.userId),
					),
				);
			// Drop mutual flag on the reverse row, if any.
			await db
				.update(follow)
				.set({ isMutual: false })
				.where(
					and(
						eq(follow.followerId, params.userId),
						eq(follow.followingId, viewer.id),
					),
				);
			return { following: false };
		},
		{ params: t.Object({ userId: t.String() }) },
	)
	.get(
		"/of/:userId/followers",
		async ({ params }) => {
			const rows = await db
				.select({
					userId: follow.followerId,
					user,
					profile,
					createdAt: follow.createdAt,
				})
				.from(follow)
				.leftJoin(user, eq(follow.followerId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(follow.followingId, params.userId))
				.orderBy(desc(follow.createdAt))
				.limit(100);
			return rows;
		},
		{ params: t.Object({ userId: t.String() }) },
	)
	.get(
		"/of/:userId/following",
		async ({ params }) => {
			const rows = await db
				.select({
					userId: follow.followingId,
					user,
					profile,
					createdAt: follow.createdAt,
				})
				.from(follow)
				.leftJoin(user, eq(follow.followingId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(follow.followerId, params.userId))
				.orderBy(desc(follow.createdAt))
				.limit(100);
			return rows;
		},
		{ params: t.Object({ userId: t.String() }) },
	)
	.get(
		"/check/:userId",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			const [row] = await db
				.select()
				.from(follow)
				.where(
					and(
						eq(follow.followerId, viewer.id),
						eq(follow.followingId, params.userId),
					),
				)
				.limit(1);
			return { following: Boolean(row), isMutual: row?.isMutual ?? false };
		},
		{ params: t.Object({ userId: t.String() }) },
	)
	// Suggestions: people followed by people you follow but not by you.
	.get("/suggestions", async ({ user: viewer, status }) => {
		if (!viewer) return status(401, "Sign in");
		const rows = await db.execute<{
			user_id: string;
			name: string;
			image: string | null;
			handle: string | null;
			shared_follows: number;
		}>(
			sql`select u.id as user_id, u.name as name, u.image as image, p.handle as handle,
        count(distinct f2.follower_id) as shared_follows
        from follow f1
        join follow f2 on f1.following_id = f2.follower_id
        join "user" u on u.id = f2.following_id
        left join profile p on p.user_id = u.id
        where f1.follower_id = ${viewer.id}
          and f2.following_id <> ${viewer.id}
          and not exists (
            select 1 from follow f3
            where f3.follower_id = ${viewer.id}
              and f3.following_id = f2.following_id
          )
        group by u.id, u.name, u.image, p.handle
        order by shared_follows desc
        limit 12`,
		);
		return rows.rows ?? [];
	});
