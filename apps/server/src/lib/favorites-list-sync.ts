import { db, LIST_SYSTEM_KIND_FAVORITES, list, listItem } from "@still/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { makeId } from "./cuid";

/** Ranked favorites use `position`; cover snapshots follow the same order. */
const FAVORITES_ITEM_ORDER = [
	asc(listItem.position),
	asc(listItem.addedAt),
] as const;

/** True when the list row is the auto-managed favorites collection. */
export function isFavoritesSystemList(row: {
	systemKind: string | null;
}): boolean {
	return row.systemKind === LIST_SYSTEM_KIND_FAVORITES;
}

/**
 * Normalize positions 0..n-1 for legacy rows that all used position 0.
 * Preserves prior "newest first" display by sorting on `addedAt` descending.
 */
export async function repairFavoritesListPositions(
	listId: string,
): Promise<void> {
	const items = await db
		.select({ id: listItem.id, position: listItem.position })
		.from(listItem)
		.where(eq(listItem.listId, listId))
		.orderBy(desc(listItem.addedAt), asc(listItem.id));

	for (const [position, item] of items.entries()) {
		if (item.position !== position) {
			await db
				.update(listItem)
				.set({ position })
				.where(eq(listItem.id, item.id));
		}
	}
}

async function countListItems(listId: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(listItem)
		.where(eq(listItem.listId, listId));
	return row?.count ?? 0;
}

/** Create or fetch the patron's system favorites list (always ranked). */
export async function ensureFavoritesList(userId: string): Promise<string> {
	const [existing] = await db
		.select({ id: list.id, isRanked: list.isRanked })
		.from(list)
		.where(
			and(
				eq(list.userId, userId),
				eq(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
			),
		)
		.limit(1);
	if (existing) {
		if (!existing.isRanked) {
			await db
				.update(list)
				.set({ isRanked: true, updatedAt: new Date() })
				.where(eq(list.id, existing.id));
			await repairFavoritesListPositions(existing.id);
		}
		return existing.id;
	}

	const id = makeId("lst");
	await db.insert(list).values({
		id,
		userId,
		title: "Favorites",
		slug: "favorites",
		description: "Titles you've favorited from your diary.",
		isRanked: true,
		isPublic: true,
		isCollaborative: false,
		systemKind: LIST_SYSTEM_KIND_FAVORITES,
	});
	return id;
}

/** Recompute counts and cover id snapshots from current list items. */
export async function refreshListAggregates(listId: string): Promise<void> {
	const recentItems = await db
		.select({
			movieId: listItem.movieId,
			tvId: listItem.tvId,
		})
		.from(listItem)
		.where(eq(listItem.listId, listId))
		.orderBy(...FAVORITES_ITEM_ORDER)
		.limit(4);

	const coverMovieIds = recentItems
		.map((row) => row.movieId)
		.filter((id): id is number => id != null);
	const coverTvIds = recentItems
		.map((row) => row.tvId)
		.filter((id): id is number => id != null);

	const [counts] = await db
		.select({
			movieItemsCount: sql<number>`count(*) filter (where ${listItem.movieId} is not null)::int`,
			tvItemsCount: sql<number>`count(*) filter (where ${listItem.tvId} is not null)::int`,
		})
		.from(listItem)
		.where(eq(listItem.listId, listId));

	const movieItemsCount = counts?.movieItemsCount ?? 0;
	const tvItemsCount = counts?.tvItemsCount ?? 0;

	await db
		.update(list)
		.set({
			itemsCount: movieItemsCount + tvItemsCount,
			movieItemsCount,
			tvItemsCount,
			coverMovieIds,
			coverTvIds,
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
		if (!existing) {
			const position = await countListItems(listId);
			await db.insert(listItem).values({
				id: makeId("lit"),
				listId,
				movieId,
				tvId: null,
				position,
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
		if (!existing) {
			const position = await countListItems(listId);
			await db.insert(listItem).values({
				id: makeId("lit"),
				listId,
				movieId: null,
				tvId,
				position,
				addedById: userId,
				addedAt: now,
			});
		}
	}

	await refreshListAggregates(listId);
}
