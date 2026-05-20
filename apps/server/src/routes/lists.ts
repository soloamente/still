import { db, eventLog, list, listItem, movie, reaction } from "@still/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { hit } from "../lib/rate-limit";

export const listsRoute = new Elysia({ prefix: "/api/lists", tags: ["lists"] })
	.use(context)
	.get(
		"/",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const rows = await db
				.select()
				.from(list)
				.where(eq(list.isPublic, true))
				.orderBy(desc(list.likesCount), desc(list.updatedAt))
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	.get(
		"/popular",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const rows = await db
				.select()
				.from(list)
				.where(eq(list.isPublic, true))
				.orderBy(desc(list.likesCount), desc(list.updatedAt))
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	.get(
		"/me",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const rows = await db
				.select()
				.from(list)
				.where(eq(list.userId, user.id))
				.orderBy(desc(list.updatedAt));
			const enriched = await withCoverPosterPaths(rows);

			const movieIdRaw = query.movieId?.trim();
			if (!movieIdRaw) return enriched;

			const movieId = Number(movieIdRaw);
			if (!Number.isFinite(movieId)) return enriched;

			const memberships = await db
				.select({ listId: listItem.listId })
				.from(listItem)
				.innerJoin(list, eq(listItem.listId, list.id))
				.where(and(eq(list.userId, user.id), eq(listItem.movieId, movieId)));
			const contains = new Set(memberships.map((m) => m.listId));

			return enriched.map((row) => ({
				...row,
				containsMovie: contains.has(row.id),
			}));
		},
		{
			query: t.Object({
				movieId: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`list:create:${user.id}`, { limit: 8, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const id = makeId("lst");
			const [row] = await db
				.insert(list)
				.values({
					id,
					userId: user.id,
					title: body.title,
					description: body.description ?? null,
					isRanked: body.isRanked ?? false,
					isPublic: body.isPublic ?? true,
					tags: body.tags ?? [],
				})
				.returning();
			const [enriched] = await withCoverPosterPaths(row ? [row] : []);
			return enriched ?? row;
		},
		{
			body: t.Object({
				title: t.String({ minLength: 1, maxLength: 120 }),
				description: t.Optional(t.String({ maxLength: 4000 })),
				isRanked: t.Optional(t.Boolean()),
				isPublic: t.Optional(t.Boolean()),
				tags: t.Optional(t.Array(t.String())),
			}),
		},
	)
	.get(
		"/:id",
		async ({ params, status }) => {
			const [meta] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!meta) return status(404, "Not found");
			const items = await db
				.select({ item: listItem, movie })
				.from(listItem)
				.leftJoin(movie, eq(listItem.movieId, movie.tmdbId))
				.where(eq(listItem.listId, params.id))
				.orderBy(asc(listItem.position), asc(listItem.addedAt));
			return { ...meta, items };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.patch(
		"/:id",
		async ({ params, body, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			const [updated] = await db
				.update(list)
				.set({
					title: body.title ?? existing.title,
					description: body.description ?? existing.description,
					isRanked: body.isRanked ?? existing.isRanked,
					isPublic: body.isPublic ?? existing.isPublic,
					tags: body.tags ?? existing.tags,
				})
				.where(eq(list.id, params.id))
				.returning();
			const [enriched] = await withCoverPosterPaths(updated ? [updated] : []);
			return enriched ?? updated;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				title: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
				description: t.Optional(t.String({ maxLength: 4000 })),
				isRanked: t.Optional(t.Boolean()),
				isPublic: t.Optional(t.Boolean()),
				tags: t.Optional(t.Array(t.String())),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			await db.delete(list).where(eq(list.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/items",
		async ({ params, body, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent || (parent.userId !== user.id && !parent.isCollaborative))
				return status(403, "Cannot edit this list");
			const [row] = await db
				.insert(listItem)
				.values({
					listId: params.id,
					movieId: body.movieId,
					position: body.position ?? parent.itemsCount,
					note: body.note ?? null,
					addedById: user.id,
				})
				.onConflictDoNothing()
				.returning();
			await db
				.update(list)
				.set({
					itemsCount: sql`(select count(*) from list_item where list_id = ${params.id})`,
					coverMovieIds: sql`(select coalesce(json_agg(movie_id order by position) filter (where position < 4), '[]'::json) from list_item where list_id = ${params.id})`,
				})
				.where(eq(list.id, params.id));
			return row;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				movieId: t.Number(),
				position: t.Optional(t.Integer()),
				note: t.Optional(t.String({ maxLength: 500 })),
			}),
		},
	)
	.delete(
		"/:id/items/:movieId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent || (parent.userId !== user.id && !parent.isCollaborative))
				return status(403, "Cannot edit this list");
			await db
				.delete(listItem)
				.where(
					and(
						eq(listItem.listId, params.id),
						eq(listItem.movieId, Number(params.movieId)),
					),
				);
			await db
				.update(list)
				.set({
					itemsCount: sql`(select count(*) from list_item where list_id = ${params.id})`,
				})
				.where(eq(list.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String(), movieId: t.String() }) },
	)
	.post(
		"/:id/like",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(reaction)
				.where(
					and(
						eq(reaction.userId, user.id),
						eq(reaction.parentType, "list"),
						eq(reaction.parentId, params.id),
						eq(reaction.kind, "like"),
					),
				)
				.limit(1);
			if (existing) {
				await db
					.delete(reaction)
					.where(
						and(
							eq(reaction.userId, user.id),
							eq(reaction.parentType, "list"),
							eq(reaction.parentId, params.id),
							eq(reaction.kind, "like"),
						),
					);
				await db
					.update(list)
					.set({ likesCount: sql`greatest(${list.likesCount} - 1, 0)` })
					.where(eq(list.id, params.id));
				return { liked: false };
			}
			await db.insert(reaction).values({
				userId: user.id,
				parentType: "list",
				parentId: params.id,
				kind: "like",
			});
			await db
				.update(list)
				.set({ likesCount: sql`${list.likesCount} + 1` })
				.where(eq(list.id, params.id));
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: user.id,
				kind: "list.liked",
				payload: { listId: params.id },
			});
			return { liked: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/by-user/:userId",
		async ({ params, query }) => {
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const rows = await db
				.select()
				.from(list)
				.where(eq(list.userId, params.userId))
				.orderBy(desc(list.updatedAt))
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{
			params: t.Object({ userId: t.String() }),
			query: t.Object({ limit: t.Optional(t.String()) }),
		},
	);
