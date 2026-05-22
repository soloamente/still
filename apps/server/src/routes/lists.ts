import { db, eventLog, list, listItem, movie, reaction, tv } from "@still/db";
import { env } from "@still/env/server";
import { get } from "@vercel/blob";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	communityPeriodQuery,
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import { makeId } from "../lib/cuid";
import { isFavoritesSystemList } from "../lib/favorites-list-sync";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";
import { vercelBlobImagePut } from "../lib/vercel-blob-image-put";

type CreateListBody = {
	title: string;
	description?: string;
	isRanked?: boolean;
	isPublic?: boolean;
	tags?: string[];
};

type PatchListBody = {
	title?: string;
	description?: string;
	isRanked?: boolean;
	isPublic?: boolean;
	tags?: string[];
	coverMovieId?: number | null;
	coverImageUrl?: string | null;
};

type AddListItemBody = {
	movieId: number;
	position?: number;
	note?: string;
};

export const listsRoute = new Elysia({ prefix: "/api/lists", tags: ["lists"] })
	.use(context)
	.get(
		"/",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select()
				.from(list)
				.where(
					and(
						eq(list.isPublic, true),
						withinCommunityPeriod(list.updatedAt, start, end),
					),
				)
				.orderBy(desc(list.likesCount), desc(list.updatedAt))
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{
			query: t.Composite([
				t.Object({ limit: t.Optional(t.String()) }),
				communityPeriodQuery,
			]),
		},
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
	/** Signed-in patron list search — powers the search dialog `lists` tag. */
	.get(
		"/search",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const q = (query.q ?? "").trim();
			const limit = Math.min(Number(query.limit ?? 20), 40);
			const rows = await db
				.select()
				.from(list)
				.where(
					q
						? and(eq(list.userId, user.id), ilike(list.title, `%${q}%`))
						: eq(list.userId, user.id),
				)
				.orderBy(desc(list.updatedAt))
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
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
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`list:create:${user.id}`, { limit: 8, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<CreateListBody>(rawBody);
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
		"/:id/cover-image",
		async ({ params, status }) => {
			const [row] = await db
				.select({ coverImageUrl: list.coverImageUrl, isPublic: list.isPublic })
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			const coverImageUrl = row?.coverImageUrl?.trim();
			if (!coverImageUrl) return status(404, "No cover");

			if (!coverImageUrl.includes("blob.vercel-storage.com")) {
				try {
					const upstream = await fetch(coverImageUrl);
					if (!upstream.ok) return status(404, "Cover not found");
					const contentType =
						upstream.headers.get("content-type") ?? "image/jpeg";
					return new Response(upstream.body, {
						headers: {
							"Content-Type": contentType,
							"Cache-Control": "public, max-age=3600, s-maxage=86400",
						},
					});
				} catch (err) {
					console.error("[lists/cover-image] fetch failed", err);
					return status(502, "Cover load failed");
				}
			}

			if (!env.BLOB_READ_WRITE_TOKEN) {
				return status(503, "BLOB_READ_WRITE_TOKEN is not set");
			}
			try {
				const result = await get(coverImageUrl, {
					access: env.BLOB_STORE_ACCESS,
					token: env.BLOB_READ_WRITE_TOKEN,
				});
				if (!result || result.statusCode !== 200 || !result.stream) {
					return status(404, "Cover not found");
				}
				return new Response(result.stream, {
					headers: {
						"Content-Type": result.blob.contentType,
						"Cache-Control": row?.isPublic
							? "public, max-age=3600, s-maxage=86400"
							: "private, no-cache",
					},
				});
			} catch (err) {
				console.error("[lists/cover-image] blob get failed", err);
				return status(502, "Cover load failed");
			}
		},
		{ params: t.Object({ id: t.String() }) },
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
			const favoritesList = isFavoritesSystemList(meta);
			const items = await db
				.select({ item: listItem, movie, tv })
				.from(listItem)
				.leftJoin(movie, eq(listItem.movieId, movie.tmdbId))
				.leftJoin(tv, eq(listItem.tvId, tv.tmdbId))
				.where(eq(listItem.listId, params.id))
				.orderBy(
					...(favoritesList
						? [desc(listItem.addedAt)]
						: [asc(listItem.position), asc(listItem.addedAt)]),
				);
			return { ...meta, items };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.patch(
		"/:id",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<PatchListBody>(rawBody);
			const [existing] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			if (isFavoritesSystemList(existing))
				return status(403, "This list is synced from your favorites");
			if (body.coverMovieId !== undefined && body.coverMovieId !== null) {
				const [onList] = await db
					.select({ movieId: listItem.movieId })
					.from(listItem)
					.where(
						and(
							eq(listItem.listId, params.id),
							eq(listItem.movieId, body.coverMovieId),
						),
					)
					.limit(1);
				if (!onList) return status(400, "That title is not on this list");
			}

			const coverPatch: Partial<typeof list.$inferInsert> = {};
			if (body.coverMovieId !== undefined) {
				coverPatch.coverMovieId = body.coverMovieId;
				if (body.coverMovieId !== null) coverPatch.coverImageUrl = null;
			}
			if (body.coverImageUrl !== undefined) {
				coverPatch.coverImageUrl = body.coverImageUrl;
				if (body.coverImageUrl !== null) coverPatch.coverMovieId = null;
			}

			const [updated] = await db
				.update(list)
				.set({
					title: body.title ?? existing.title,
					description: body.description ?? existing.description,
					isRanked: body.isRanked ?? existing.isRanked,
					isPublic: body.isPublic ?? existing.isPublic,
					tags: body.tags ?? existing.tags,
					...coverPatch,
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
				/** Pin a list item poster as hero + primary tile; `null` clears the pin. */
				coverMovieId: t.Optional(t.Union([t.Number(), t.Null()])),
				/** Custom upload URL; `null` clears. Setting a movie pin clears this. */
				coverImageUrl: t.Optional(t.Union([t.String(), t.Null()])),
			}),
		},
	)
	.post(
		"/:id/cover",
		async ({ params, request, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			if (isFavoritesSystemList(existing))
				return status(403, "This list is synced from your favorites");
			if (!hit(`list:cover:${user.id}`, { limit: 10, windowMs: 60_000 }).ok)
				return status(429, "Slow down");

			const formData = await request.formData();
			const file = formData.get("file");
			if (!(file instanceof File)) return status(400, "Missing file");
			if (!file.type.startsWith("image/")) return status(400, "Image only");
			if (file.size > 5_000_000) return status(413, "File too large (max 5MB)");

			const key = `list-covers/${existing.id}/${Date.now()}-${encodeURIComponent(file.name)}`;
			const uploaded = await vercelBlobImagePut(key, file);
			if ("error" in uploaded) {
				const code = uploaded.code;
				if (code === "BLOB_UNCONFIGURED" || code === "BLOB_ACCESS_MISMATCH") {
					return status(code === "BLOB_UNCONFIGURED" ? 503 : 502, {
						error: uploaded.error,
						code,
						hint: uploaded.hint,
					});
				}
				return status(502, { error: uploaded.error });
			}

			const [updated] = await db
				.update(list)
				.set({ coverImageUrl: uploaded.url, coverMovieId: null })
				.where(eq(list.id, params.id))
				.returning();
			const [enriched] = await withCoverPosterPaths(updated ? [updated] : []);
			return enriched ?? updated;
		},
		{ params: t.Object({ id: t.String() }) },
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
			if (isFavoritesSystemList(existing))
				return status(403, "This list is synced from your favorites");
			await db.delete(list).where(eq(list.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/items",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<AddListItemBody>(rawBody);
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent || (parent.userId !== user.id && !parent.isCollaborative))
				return status(403, "Cannot edit this list");
			if (isFavoritesSystemList(parent))
				return status(403, "This list is synced from your favorites");
			const [row] = await db
				.insert(listItem)
				.values({
					id: makeId("lit"),
					listId: params.id,
					movieId: body.movieId,
					tvId: null,
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
			if (isFavoritesSystemList(parent))
				return status(403, "This list is synced from your favorites");
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
					coverMovieIds: sql`(select coalesce(json_agg(movie_id order by position) filter (where position < 4), '[]'::json) from list_item where list_id = ${params.id})`,
					coverMovieId: sql`case when ${list.coverMovieId} = ${Number(params.movieId)} then null else ${list.coverMovieId} end`,
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
