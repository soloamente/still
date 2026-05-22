import { db, LIST_SYSTEM_KIND_FAVORITES, list, listItem } from "@still/db";
import { and, desc, eq, sql } from "drizzle-orm";

import { makeId } from "./cuid";

/** True when the list row is the auto-managed favorites collection. */
export function isFavoritesSystemList(row: {
	systemKind: string | null;
}): boolean {
	return row.systemKind === LIST_SYSTEM_KIND_FAVORITES;
}

/** Create or fetch the patron's system favorites list. */
export async function ensureFavoritesList(userId: string): Promise<string> {
	const [existing] = await db
		.select({ id: list.id })
		.from(list)
		.where(
			and(
				eq(list.userId, userId),
				eq(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
			),
		)
		.limit(1);
	if (existing) return existing.id;

	const id = makeId("lst");
	await db.insert(list).values({
		id,
		userId,
		title: "Favorites",
		slug: "favorites",
		description: "Titles you've favorited from your diary.",
		isRanked: false,
		isPublic: true,
		isCollaborative: false,
		systemKind: LIST_SYSTEM_KIND_FAVORITES,
	});
	return id;
}

/** Recompute `itemsCount` and `coverMovieIds` from current list items. */
export async function refreshListAggregates(listId: string): Promise<void> {
	const items = await db
		.select({
			movieId: listItem.movieId,
			addedAt: listItem.addedAt,
		})
		.from(listItem)
		.where(eq(listItem.listId, listId))
		.orderBy(desc(listItem.addedAt))
		.limit(4);

	const coverMovieIds = items
		.map((row) => row.movieId)
		.filter((id): id is number => id != null);

	const countRow = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(listItem)
		.where(eq(listItem.listId, listId));
	const itemsCount = countRow[0]?.count ?? 0;

	await db
		.update(list)
		.set({
			itemsCount,
			coverMovieIds,
			updatedAt: new Date(),
		})
		.where(eq(list.id, listId));
}

/**
 * Keep the system favorites list aligned with `log.liked` for one title.
 * Call after log create/update/delete when liked state or title may change.
 */
export async function syncFavoritesListForUserTitle(input: {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	liked: boolean;
}): Promise<void> {
	const { userId, movieId, tvId, liked } = input;
	if (movieId == null && tvId == null) return;

	if (!liked) {
		const [favoritesList] = await db
			.select({ id: list.id })
			.from(list)
			.where(
				and(
					eq(list.userId, userId),
					eq(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
				),
			)
			.limit(1);
		if (!favoritesList) return;

		if (movieId != null) {
			await db
				.delete(listItem)
				.where(
					and(
						eq(listItem.listId, favoritesList.id),
						eq(listItem.movieId, movieId),
					),
				);
		} else if (tvId != null) {
			await db
				.delete(listItem)
				.where(
					and(eq(listItem.listId, favoritesList.id), eq(listItem.tvId, tvId)),
				);
		}
		await refreshListAggregates(favoritesList.id);
		return;
	}

	const listId = await ensureFavoritesList(userId);
	const now = new Date();

	if (movieId != null) {
		const [existing] = await db
			.select({ id: listItem.id })
			.from(listItem)
			.where(and(eq(listItem.listId, listId), eq(listItem.movieId, movieId)))
			.limit(1);
		if (existing) {
			await db
				.update(listItem)
				.set({ addedAt: now })
				.where(eq(listItem.id, existing.id));
		} else {
			await db.insert(listItem).values({
				id: makeId("lit"),
				listId,
				movieId,
				tvId: null,
				position: 0,
				addedById: userId,
				addedAt: now,
			});
		}
	} else if (tvId != null) {
		const [existing] = await db
			.select({ id: listItem.id })
			.from(listItem)
			.where(and(eq(listItem.listId, listId), eq(listItem.tvId, tvId)))
			.limit(1);
		if (existing) {
			await db
				.update(listItem)
				.set({ addedAt: now })
				.where(eq(listItem.id, existing.id));
		} else {
			await db.insert(listItem).values({
				id: makeId("lit"),
				listId,
				movieId: null,
				tvId,
				position: 0,
				addedById: userId,
				addedAt: now,
			});
		}
	}

	await refreshListAggregates(listId);
}
