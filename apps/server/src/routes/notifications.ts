import { badge, db, notification, profile } from "@still/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";

type NotificationRow = typeof notification.$inferSelect;

/**
 * Fills `payload.href` when missing so older rows and minimal inserts still deep-link
 * in the client (follower profile, chat hub, achievements).
 */
async function withNavigationHints(
	rows: NotificationRow[],
): Promise<NotificationRow[]> {
	const followerIds = new Set<string>();
	for (const r of rows) {
		if (r.kind !== "follow.created") continue;
		const p = r.payload as Record<string, unknown>;
		if (typeof p.href === "string") continue;
		const from = p.fromUserId;
		if (typeof from === "string") followerIds.add(from);
	}

	const handleByUserId = new Map<string, string>();
	if (followerIds.size > 0) {
		const ids = [...followerIds];
		const profs = await db
			.select({ userId: profile.userId, handle: profile.handle })
			.from(profile)
			.where(inArray(profile.userId, ids));
		for (const row of profs) handleByUserId.set(row.userId, row.handle);
	}

	return rows.map((r) => {
		const base = (r.payload ?? {}) as Record<string, unknown>;
		if (typeof base.href === "string") return r;

		if (r.kind === "follow.created") {
			const uid = base.fromUserId;
			const h = typeof uid === "string" ? handleByUserId.get(uid) : undefined;
			if (h) return { ...r, payload: { ...base, href: `/profile/${h}` } };
		}
		if (r.kind === "chat.message") {
			return { ...r, payload: { ...base, href: "/chat" } };
		}
		if (r.kind === "badge.awarded" || r.kind === "achievement.unlocked") {
			return { ...r, payload: { ...base, href: "/achievements" } };
		}
		if (r.kind === "tv.new_episode") {
			const tvId = base.tvId;
			if (typeof tvId === "number" && Number.isFinite(tvId)) {
				return {
					...r,
					payload: {
						...base,
						href: `/tv/${tvId}#tv-section-progress`,
					},
				};
			}
		}
		return r;
	});
}

/** Attach real badge `iconUrl` so the inbox can render medal art instead of a generic icon. */
async function withBadgeArtwork(
	rows: NotificationRow[],
): Promise<NotificationRow[]> {
	const badgeIds = new Set<string>();
	for (const r of rows) {
		if (r.kind !== "badge.awarded") continue;
		const p = r.payload as Record<string, unknown>;
		if (typeof p.badgeId === "string") badgeIds.add(p.badgeId);
	}
	if (badgeIds.size === 0) return rows;

	const catalog = await db
		.select({ id: badge.id, iconUrl: badge.iconUrl })
		.from(badge)
		.where(inArray(badge.id, [...badgeIds]));
	const iconById = new Map(catalog.map((b) => [b.id, b.iconUrl]));

	return rows.map((r) => {
		if (r.kind !== "badge.awarded") return r;
		const base = (r.payload ?? {}) as Record<string, unknown>;
		const badgeId = base.badgeId;
		if (typeof badgeId !== "string") return r;
		const iconUrl = iconById.get(badgeId);
		if (!iconUrl) return r;
		return { ...r, payload: { ...base, iconUrl } };
	});
}

export const notificationsRoute = new Elysia({
	prefix: "/api/notifications",
	tags: ["notifications"],
})
	.use(context)
	.get(
		"/",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const limit = Math.min(Number(query.limit ?? 50), 100);
			const rows = await db
				.select()
				.from(notification)
				.where(eq(notification.userId, user.id))
				.orderBy(desc(notification.createdAt))
				.limit(limit);
			return await withBadgeArtwork(await withNavigationHints(rows));
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	.get("/unread-count", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const [row] = await db
			.select({ c: sql<number>`count(*)` })
			.from(notification)
			.where(
				and(eq(notification.userId, user.id), isNull(notification.readAt)),
			);
		return { count: Number(row?.c ?? 0) };
	})
	.post("/read-all", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		await db
			.update(notification)
			.set({ readAt: new Date() })
			.where(
				and(eq(notification.userId, user.id), isNull(notification.readAt)),
			);
		return { ok: true };
	})
	.post(
		"/:id/read",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			await db
				.update(notification)
				.set({ readAt: new Date() })
				.where(
					and(eq(notification.id, params.id), eq(notification.userId, user.id)),
				);
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	);
