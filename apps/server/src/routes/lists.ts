import {
	db,
	eventLog,
	list,
	listItem,
	movie,
	profile,
	reaction,
	tv,
} from "@still/db";
import { listRoomId } from "@still/realtime";
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { joinedTitleItemNotAdultSql } from "../lib/adult-content-sql";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { getImageAsset, putImageAsset } from "../lib/asset-store";
import {
	communityOffset,
	parseCommunityPage,
} from "../lib/community-page-args";
import {
	communityPeriodQuery,
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import { makeId } from "../lib/cuid";
import {
	isFavoritesSystemList,
	refreshListAggregates,
	repairFavoritesListPositions,
} from "../lib/favorites-list-sync";
import { canEditList } from "../lib/list-collaborator-access";
import {
	fetchCollaboratedListsForPatron,
	fetchListCollaborators,
	inviteListCollaboratorByHandle,
	removeListCollaborator,
} from "../lib/list-collaborators";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { fetchOwnerLogScoresForListItems } from "../lib/list-owner-log-scores";
import {
	LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS,
	LIST_ITEM_NOTE_MAX_CHARS,
} from "../lib/list-quality";
import { canViewList } from "../lib/list-view-access";
import { loadPatronEntitlements } from "../lib/patron-entitlements";
import {
	patronHasPlanFeature,
	planFeatureRequiredBody,
} from "../lib/plan-feature-access";
import { hit } from "../lib/rate-limit";
import { publishRealtimeEvent } from "../lib/realtime-publish";
import { formField } from "../lib/request-form";
import {
	assertEmailVerified,
	EmailVerificationRequiredError,
	emailVerificationRequiredBody,
} from "../lib/require-verified-email";
import { routeBody } from "../lib/route-body";
import { logMediaKey } from "../lib/sense-taste-overlap";
import { ensureTvCached } from "../lib/tv-cache";

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
	coverTvId?: number | null;
	coverImageUrl?: string | null;
};

type AddListItemBody = {
	movieId?: number;
	tvId?: number;
	position?: number;
	note?: string;
};

type ReorderListItemsBody = {
	itemIds: string[];
};

type PatchListItemNoteBody = {
	note?: string | null;
};

/** Community lists: surface described lists before empty-blurb rows at equal engagement. */
const listDiscoverabilityOrder = desc(
	sql`CASE WHEN length(trim(coalesce(${list.description}, ''))) >= 40 THEN 1 ELSE 0 END`,
);

/** System favorites lists stay metadata-synced; patrons may still set cover art. */
function patchTouchesNonCoverFields(body: PatchListBody): boolean {
	return (
		body.title !== undefined ||
		body.description !== undefined ||
		body.isRanked !== undefined ||
		body.isPublic !== undefined ||
		body.tags !== undefined
	);
}

export const listsRoute = new Elysia({ prefix: "/api/lists", tags: ["lists"] })
	.use(context)
	.get(
		"/",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const page = parseCommunityPage(query.page);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const whereClause = and(
				eq(list.isPublic, true),
				isNull(list.removedAt),
				withinCommunityPeriod(list.updatedAt, start, end),
			);
			const [rows, countRow] = await Promise.all([
				db
					.select()
					.from(list)
					.where(whereClause)
					.orderBy(
						listDiscoverabilityOrder,
						desc(list.likesCount),
						desc(list.updatedAt),
						desc(list.id),
					)
					.limit(limit)
					.offset(communityOffset(page, limit)),
				db.select({ total: count() }).from(list).where(whereClause),
			]);
			return {
				items: await withCoverPosterPaths(rows),
				total: Number(countRow[0]?.total ?? 0),
			};
		},
		{
			query: t.Composite([
				t.Object({
					limit: t.Optional(t.String()),
					page: t.Optional(t.String()),
				}),
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
				.where(and(eq(list.isPublic, true), isNull(list.removedAt)))
				.orderBy(
					listDiscoverabilityOrder,
					desc(list.likesCount),
					desc(list.updatedAt),
				)
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	/** Indexable public lists for Next.js sitemap (ST.1 SEO). */
	.get(
		"/sitemap",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 500), 2000);
			const rows = await db
				.select({
					id: list.id,
					updatedAt: list.updatedAt,
				})
				.from(list)
				.where(
					and(
						eq(list.isPublic, true),
						isNull(list.removedAt),
						sql`length(trim(coalesce(${list.description}, ''))) >= ${LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS}`,
						sql`${list.systemKind} is null`,
					),
				)
				.orderBy(desc(list.updatedAt))
				.limit(limit);
			return {
				entries: rows.map((row) => ({
					id: row.id,
					updatedAt:
						row.updatedAt instanceof Date
							? row.updatedAt.toISOString()
							: String(row.updatedAt),
				})),
			};
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
						? and(
								eq(list.userId, user.id),
								isNull(list.removedAt),
								ilike(list.title, `%${q}%`),
							)
						: and(eq(list.userId, user.id), isNull(list.removedAt)),
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
			const [ownedRows, sharedRows] = await Promise.all([
				db
					.select()
					.from(list)
					.where(and(eq(list.userId, user.id), isNull(list.removedAt)))
					.orderBy(desc(list.updatedAt)),
				fetchCollaboratedListsForPatron(user.id),
			]);
			const libraryRows = [
				...ownedRows.map((row) => ({ ...row, listRole: "owner" as const })),
				...sharedRows,
			].sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			);
			const enriched = await withCoverPosterPaths(libraryRows);

			const movieIdRaw = query.movieId?.trim();
			const tvIdRaw = query.tvId?.trim();
			if (!movieIdRaw && !tvIdRaw) return enriched;

			const movieId =
				movieIdRaw && Number.isFinite(Number(movieIdRaw))
					? Number(movieIdRaw)
					: null;
			const tvId =
				tvIdRaw && Number.isFinite(Number(tvIdRaw)) ? Number(tvIdRaw) : null;
			if (movieId == null && tvId == null) return enriched;
			if (movieId != null && tvId != null) return enriched;

			const titleInList =
				movieId != null
					? eq(listItem.movieId, movieId)
					: tvId != null
						? eq(listItem.tvId, tvId)
						: null;
			if (titleInList == null) return enriched;

			const listIds = enriched.map((row) => row.id);
			if (listIds.length === 0) return enriched;

			const memberships = await db
				.select({ listId: listItem.listId })
				.from(listItem)
				.where(and(inArray(listItem.listId, listIds), titleInList));
			const contains = new Set(memberships.map((m) => m.listId));

			return enriched.map((row) => {
				const containsTitle = contains.has(row.id);
				return {
					...row,
					containsTitle,
					containsMovie: containsTitle,
				};
			});
		},
		{
			query: t.Object({
				movieId: t.Optional(t.String()),
				tvId: t.Optional(t.String()),
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
			if (body.isPublic === false) {
				const entitlements = await loadPatronEntitlements(user.id);
				if (!patronHasPlanFeature(entitlements, "private_lists")) {
					return status(
						403,
						planFeatureRequiredBody(
							"private_lists",
							"Private lists require Immersed",
						),
					);
				}
			}
			const effectiveIsPublic = body.isPublic ?? true;
			if (effectiveIsPublic) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}
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
		async ({ params, status, user }) => {
			const [row] = await db
				.select({
					id: list.id,
					coverImageUrl: list.coverImageUrl,
					isPublic: list.isPublic,
					userId: list.userId,
				})
				.from(list)
				.where(and(eq(list.id, params.id), isNull(list.removedAt)))
				.limit(1);
			if (!row || !(await canViewList(row, user?.id)))
				return status(404, "Not found");
			const coverImageUrl = row.coverImageUrl?.trim();
			if (!coverImageUrl) return status(404, "No cover");

			const asset = await getImageAsset(coverImageUrl);
			if (!asset) return status(404, "Cover not found");
			return new Response(asset.body, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": row?.isPublic
						? "public, max-age=3600, s-maxage=86400"
						: "private, no-cache",
				},
			});
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id",
		async ({ params, status, user }) => {
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const [meta] = await db
				.select()
				.from(list)
				.where(and(eq(list.id, params.id), isNull(list.removedAt)))
				.limit(1);
			if (!meta) return status(404, "Not found");
			if (!(await canViewList(meta, user?.id))) return status(404, "Not found");
			// Upgrade legacy favorites lists to ranked + normalized positions on read.
			if (isFavoritesSystemList(meta) && !meta.isRanked) {
				await db
					.update(list)
					.set({ isRanked: true, updatedAt: new Date() })
					.where(eq(list.id, params.id));
				await repairFavoritesListPositions(params.id);
				meta.isRanked = true;
			}
			let liked = false;
			if (user) {
				const [reactionRow] = await db
					.select({ parentId: reaction.parentId })
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
				liked = Boolean(reactionRow);
			}
			const items = await db
				.select({ item: listItem, movie, tv })
				.from(listItem)
				.leftJoin(movie, eq(listItem.movieId, movie.tmdbId))
				.leftJoin(tv, eq(listItem.tvId, tv.tmdbId))
				.where(
					and(
						eq(listItem.listId, params.id),
						joinedTitleItemNotAdultSql(showAdultContent, {
							movieId: listItem.movieId,
							tvId: listItem.tvId,
						}),
					),
				)
				.orderBy(asc(listItem.position), asc(listItem.addedAt));

			const ownerScores = await fetchOwnerLogScoresForListItems(
				meta.userId,
				items.map((row) => ({
					movieId: row.item.movieId,
					tvId: row.item.tvId,
				})),
			);
			const itemsWithOwnerLog = items.map((row) => {
				const key = logMediaKey(row.item.movieId, row.item.tvId);
				const ownerLog = key ? (ownerScores.get(key) ?? null) : null;
				return { ...row, ownerLog };
			});

			const collaborators = await fetchListCollaborators(params.id);
			const viewerCanEdit = await canEditList(user?.id, meta);
			const [ownerProfile] = await db
				.select({
					handle: profile.handle,
					displayName: profile.displayName,
				})
				.from(profile)
				.where(eq(profile.userId, meta.userId))
				.limit(1);

			return {
				...meta,
				items: itemsWithOwnerLog,
				liked,
				collaborators,
				viewerCanEdit,
				owner: ownerProfile ?? null,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/collaborators",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const entitlements = await loadPatronEntitlements(user.id);
			if (!patronHasPlanFeature(entitlements, "private_lists")) {
				return status(
					403,
					planFeatureRequiredBody(
						"private_lists",
						"List collaboration requires Immersed",
					),
				);
			}
			const body = routeBody<{ handle: string }>(rawBody);
			const result = await inviteListCollaboratorByHandle({
				listId: params.id,
				ownerUserId: user.id,
				handle: body.handle,
			});
			if (!result.ok) return status(result.status, result.error);
			const collaborators = await fetchListCollaborators(params.id);
			return { ok: true, collaborators };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({ handle: t.String({ minLength: 1, maxLength: 64 }) }),
		},
	)
	.delete(
		"/:id/collaborators/:collaboratorUserId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const result = await removeListCollaborator({
				listId: params.id,
				ownerUserId: user.id,
				collaboratorUserId: params.collaboratorUserId,
			});
			if (!result.ok) return status(404, result.error);
			const collaborators = await fetchListCollaborators(params.id);
			return { ok: true, collaborators };
		},
		{
			params: t.Object({
				id: t.String(),
				collaboratorUserId: t.String(),
			}),
		},
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
			if (body.isPublic === false && existing.isPublic) {
				const entitlements = await loadPatronEntitlements(user.id);
				if (!patronHasPlanFeature(entitlements, "private_lists")) {
					return status(
						403,
						planFeatureRequiredBody(
							"private_lists",
							"Private lists require Immersed",
						),
					);
				}
			}
			const effectiveIsPublic = body.isPublic ?? existing.isPublic;
			if (effectiveIsPublic) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}
			if (isFavoritesSystemList(existing) && patchTouchesNonCoverFields(body)) {
				return status(403, "This list is synced from your favorites");
			}
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
			if (body.coverTvId !== undefined && body.coverTvId !== null) {
				const [onList] = await db
					.select({ tvId: listItem.tvId })
					.from(listItem)
					.where(
						and(
							eq(listItem.listId, params.id),
							eq(listItem.tvId, body.coverTvId),
						),
					)
					.limit(1);
				if (!onList) return status(400, "That title is not on this list");
			}

			const coverPatch: Partial<typeof list.$inferInsert> = {};
			if (body.coverMovieId !== undefined) {
				coverPatch.coverMovieId = body.coverMovieId;
				if (body.coverMovieId !== null) {
					coverPatch.coverImageUrl = null;
					coverPatch.coverTvId = null;
				}
			}
			if (body.coverTvId !== undefined) {
				coverPatch.coverTvId = body.coverTvId;
				if (body.coverTvId !== null) {
					coverPatch.coverImageUrl = null;
					coverPatch.coverMovieId = null;
				}
			}
			if (body.coverImageUrl !== undefined) {
				if (body.coverImageUrl !== null) {
					const entitlements = await loadPatronEntitlements(user.id);
					if (!patronHasPlanFeature(entitlements, "list_covers")) {
						return status(
							403,
							planFeatureRequiredBody(
								"list_covers",
								"Custom list covers require Immersed",
							),
						);
					}
				}
				coverPatch.coverImageUrl = body.coverImageUrl;
				if (body.coverImageUrl !== null) {
					coverPatch.coverMovieId = null;
					coverPatch.coverTvId = null;
				}
			}

			const metadataPatch = isFavoritesSystemList(existing)
				? {}
				: {
						title: body.title ?? existing.title,
						description: body.description ?? existing.description,
						isRanked: body.isRanked ?? existing.isRanked,
						isPublic: body.isPublic ?? existing.isPublic,
						tags: body.tags ?? existing.tags,
					};

			const [updated] = await db
				.update(list)
				.set({
					...metadataPatch,
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
				coverTvId: t.Optional(t.Union([t.Number(), t.Null()])),
				/** Custom upload URL; `null` clears. Setting a movie pin clears this. */
				coverImageUrl: t.Optional(t.Union([t.String(), t.Null()])),
			}),
		},
	)
	.post(
		"/:id/cover",
		async ({ params, body, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			const entitlements = await loadPatronEntitlements(user.id);
			if (!patronHasPlanFeature(entitlements, "list_covers")) {
				return status(
					403,
					planFeatureRequiredBody(
						"list_covers",
						"Custom list covers require Immersed",
					),
				);
			}
			if (!hit(`list:cover:${user.id}`, { limit: 10, windowMs: 60_000 }).ok)
				return status(429, "Slow down");

			const file = formField(body, "file");
			if (!(file instanceof File)) return status(400, "Missing file");
			if (!file.type.startsWith("image/")) return status(400, "Image only");
			if (file.size > 5_000_000) return status(413, "File too large (max 5MB)");

			const key = `list-covers/${existing.id}/${Date.now()}-${encodeURIComponent(file.name)}`;
			const uploaded = await putImageAsset(key, file);
			if ("error" in uploaded) {
				return status(502, {
					error: uploaded.error,
					code: uploaded.code,
					hint: uploaded.hint,
				});
			}

			const [updated] = await db
				.update(list)
				.set({
					coverImageUrl: uploaded.value,
					coverMovieId: null,
					coverTvId: null,
				})
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
		"/:id/reorder",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<ReorderListItemsBody>(rawBody);
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent) return status(404, "Not found");
			if (!(await canEditList(user.id, parent)))
				return status(403, "Cannot edit this list");
			// Favorites list: membership stays diary-synced; patrons may still rank items.

			const currentItems = await db
				.select({ id: listItem.id })
				.from(listItem)
				.where(eq(listItem.listId, params.id));
			const currentIds = currentItems.map((item) => item.id);
			const requestedIds = body.itemIds;
			const requestedIdSet = new Set(requestedIds);
			const currentIdSet = new Set(currentIds);

			if (requestedIdSet.size !== requestedIds.length) {
				return status(400, "itemIds must not contain duplicates");
			}
			if (requestedIds.length !== currentIds.length) {
				return status(400, "itemIds must include every list item exactly once");
			}
			if (
				requestedIds.some((id) => !currentIdSet.has(id)) ||
				currentIds.some((id) => !requestedIdSet.has(id))
			) {
				return status(400, "itemIds must include every list item exactly once");
			}

			try {
				// Neon HTTP driver does not support explicit transactions.
				// Apply deterministic position updates sequentially.
				for (const [position, id] of requestedIds.entries()) {
					await db
						.update(listItem)
						.set({ position })
						.where(and(eq(listItem.id, id), eq(listItem.listId, params.id)));
				}
			} catch (error) {
				console.error("[lists/reorder] failed", {
					listId: params.id,
					userId: user.id,
					error,
				});
				return status(500, {
					error: "Failed to reorder list",
					detail: error instanceof Error ? error.message : String(error),
				});
			}

			const showAdultContent = await getShowAdultContentForUser(user.id);
			const items = await db
				.select({ item: listItem, movie, tv })
				.from(listItem)
				.leftJoin(movie, eq(listItem.movieId, movie.tmdbId))
				.leftJoin(tv, eq(listItem.tvId, tv.tmdbId))
				.where(
					and(
						eq(listItem.listId, params.id),
						joinedTitleItemNotAdultSql(showAdultContent, {
							movieId: listItem.movieId,
							tvId: listItem.tvId,
						}),
					),
				)
				.orderBy(asc(listItem.position), asc(listItem.addedAt));

			void publishRealtimeEvent(listRoomId(params.id), {
				type: "list.reordered",
				itemIds: requestedIds,
			});

			return { ok: true, items };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({ itemIds: t.Array(t.String()) }),
		},
	)
	.post(
		"/:id/items",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<AddListItemBody>(rawBody);
			const movieId = body.movieId;
			const tvId = body.tvId;
			if (movieId != null && tvId != null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId == null && tvId == null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent) return status(404, "Not found");
			if (!(await canEditList(user.id, parent)))
				return status(403, "Cannot edit this list");
			if (isFavoritesSystemList(parent))
				return status(403, "This list is synced from your favorites");
			if (tvId != null) {
				await ensureTvCached(tvId);
			}
			const [row] = await db
				.insert(listItem)
				.values({
					id: makeId("lit"),
					listId: params.id,
					movieId: movieId ?? null,
					tvId: tvId ?? null,
					position: body.position ?? parent.itemsCount,
					note: body.note ?? null,
					addedById: user.id,
				})
				.onConflictDoNothing()
				.returning();
			await refreshListAggregates(params.id);
			return row;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				movieId: t.Optional(t.Number()),
				tvId: t.Optional(t.Number()),
				position: t.Optional(t.Integer()),
				note: t.Optional(t.String({ maxLength: 500 })),
			}),
		},
	)
	.patch(
		"/:id/items/item/:itemId",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<PatchListItemNoteBody>(rawBody);
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent) return status(404, "Not found");
			if (!(await canEditList(user.id, parent)))
				return status(403, "Cannot edit this list");
			if (isFavoritesSystemList(parent))
				return status(403, "This list is synced from your favorites");
			const [existing] = await db
				.select()
				.from(listItem)
				.where(
					and(eq(listItem.listId, params.id), eq(listItem.id, params.itemId)),
				)
				.limit(1);
			if (!existing) return status(404, "List item not found");
			const note =
				body.note === undefined
					? existing.note
					: body.note === null || body.note.trim() === ""
						? null
						: body.note.trim();
			const [row] = await db
				.update(listItem)
				.set({ note })
				.where(eq(listItem.id, params.itemId))
				.returning();
			return row;
		},
		{
			params: t.Object({ id: t.String(), itemId: t.String() }),
			body: t.Object({
				note: t.Optional(
					t.Union([
						t.String({ maxLength: LIST_ITEM_NOTE_MAX_CHARS }),
						t.Null(),
					]),
				),
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
			if (!parent) return status(404, "Not found");
			if (!(await canEditList(user.id, parent)))
				return status(403, "Cannot edit this list");
			if (isFavoritesSystemList(parent))
				return status(403, "This list is synced from your favorites");
			const movieId = Number(params.movieId);
			await db
				.delete(listItem)
				.where(
					and(eq(listItem.listId, params.id), eq(listItem.movieId, movieId)),
				);
			if (parent.coverMovieId === movieId) {
				await db
					.update(list)
					.set({ coverMovieId: null })
					.where(eq(list.id, params.id));
			}
			await refreshListAggregates(params.id);
			return { ok: true };
		},
		{ params: t.Object({ id: t.String(), movieId: t.String() }) },
	)
	.delete(
		"/:id/items/tv/:tvId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [parent] = await db
				.select()
				.from(list)
				.where(eq(list.id, params.id))
				.limit(1);
			if (!parent) return status(404, "Not found");
			if (!(await canEditList(user.id, parent)))
				return status(403, "Cannot edit this list");
			if (isFavoritesSystemList(parent))
				return status(403, "This list is synced from your favorites");
			await db
				.delete(listItem)
				.where(
					and(
						eq(listItem.listId, params.id),
						eq(listItem.tvId, Number(params.tvId)),
					),
				);
			await refreshListAggregates(params.id);
			return { ok: true };
		},
		{ params: t.Object({ id: t.String(), tvId: t.String() }) },
	)
	.post(
		"/:id/like",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [listRow] = await db
				.select({ id: list.id, isPublic: list.isPublic })
				.from(list)
				.where(and(eq(list.id, params.id), isNull(list.removedAt)))
				.limit(1);
			if (!listRow) return status(404, "Not found");
			if (!listRow.isPublic) return status(403, "Private list");
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
				.where(and(eq(list.userId, params.userId), isNull(list.removedAt)))
				.orderBy(desc(list.updatedAt))
				.limit(limit);
			return withCoverPosterPaths(rows);
		},
		{
			params: t.Object({ userId: t.String() }),
			query: t.Object({ limit: t.Optional(t.String()) }),
		},
	);
