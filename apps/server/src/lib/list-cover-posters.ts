import { db, listItem, movie, tv } from "@still/db";
import { desc, inArray } from "drizzle-orm";

import { listDisplayCoverMovieIds } from "./list-display-cover";

type ListRowWithId = {
	id: string;
	coverMovieIds: number[];
	coverTvIds?: number[];
	coverMovieId?: number | null;
	coverImageUrl?: string | null;
};

/**
 * Recent list items (up to 4 per list) for ordered lobby cover strips.
 */
async function recentCoverSlotsByListId(
	listIds: string[],
): Promise<Map<string, { movieId: number | null; tvId: number | null }[]>> {
	if (listIds.length === 0) return new Map();

	const rows = await db
		.select({
			listId: listItem.listId,
			movieId: listItem.movieId,
			tvId: listItem.tvId,
			addedAt: listItem.addedAt,
		})
		.from(listItem)
		.where(inArray(listItem.listId, listIds))
		.orderBy(desc(listItem.addedAt));

	const byList = new Map<
		string,
		{ movieId: number | null; tvId: number | null }[]
	>();
	for (const row of rows) {
		const bucket = byList.get(row.listId) ?? [];
		if (bucket.length >= 4) continue;
		bucket.push({ movieId: row.movieId, tvId: row.tvId });
		byList.set(row.listId, bucket);
	}
	return byList;
}

/**
 * Hydrates `coverPosterPaths` in **item order** (films + shows) for list lobby cards.
 * Pinned `coverMovieId` still applies via `listDisplayCoverMovieIds` when no custom image.
 */
export async function withCoverPosterPaths<L extends ListRowWithId>(
	rows: L[],
): Promise<(L & { coverPosterPaths: (string | null)[] })[]> {
	if (rows.length === 0) return [];

	const listIds = rows.map((r) => r.id);
	const slotsByList = await recentCoverSlotsByListId(listIds);

	const movieIds = new Set<number>();
	const tvIds = new Set<number>();
	for (const slots of slotsByList.values()) {
		for (const slot of slots) {
			if (slot.movieId != null) movieIds.add(slot.movieId);
			if (slot.tvId != null) tvIds.add(slot.tvId);
		}
	}
	for (const r of rows) {
		for (const id of listDisplayCoverMovieIds(r)) movieIds.add(id);
		if (r.coverTvIds) {
			for (const id of r.coverTvIds) tvIds.add(id);
		}
	}

	const moviePosterById = new Map<number, string | null>();
	if (movieIds.size > 0) {
		const hits = await db
			.select({ tmdbId: movie.tmdbId, posterPath: movie.posterPath })
			.from(movie)
			.where(inArray(movie.tmdbId, [...movieIds]));
		for (const h of hits) moviePosterById.set(h.tmdbId, h.posterPath);
	}

	const tvPosterById = new Map<number, string | null>();
	if (tvIds.size > 0) {
		const hits = await db
			.select({ tmdbId: tv.tmdbId, posterPath: tv.posterPath })
			.from(tv)
			.where(inArray(tv.tmdbId, [...tvIds]));
		for (const h of hits) tvPosterById.set(h.tmdbId, h.posterPath);
	}

	return rows.map((r) => {
		const customCover = r.coverImageUrl?.trim();
		if (customCover) {
			return { ...r, coverPosterPaths: [customCover] };
		}

		const pinned = r.coverMovieId;
		if (pinned != null) {
			const displayIds = listDisplayCoverMovieIds(r);
			return {
				...r,
				coverPosterPaths: displayIds.map(
					(id) => moviePosterById.get(id) ?? null,
				),
			};
		}

		const slots = slotsByList.get(r.id) ?? [];
		const orderedPaths = slots.map((slot) => {
			if (slot.movieId != null) {
				return moviePosterById.get(slot.movieId) ?? null;
			}
			if (slot.tvId != null) {
				return tvPosterById.get(slot.tvId) ?? null;
			}
			return null;
		});

		if (orderedPaths.length > 0) {
			return { ...r, coverPosterPaths: orderedPaths };
		}

		// Fallback: legacy movie-only ids when no items returned (empty list).
		const displayIds = listDisplayCoverMovieIds(r);
		return {
			...r,
			coverPosterPaths: displayIds.map((id) => moviePosterById.get(id) ?? null),
		};
	});
}
