import { db, log, profile } from "@still/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { makeId } from "./cuid";
import { ensureMovieCached } from "./ensure-movie-cached";
import { syncFavoritesListForUserTitle } from "./favorites-list-sync";
import {
	migrateLegacyFavoriteMovies,
	type ShowcaseItem,
} from "./profile-showcase";

/** Normalize onboarding favorite ids — unique, finite, stable order. */
function uniqueFavoriteMovieIds(favoriteMovieIds: number[]): number[] {
	const seen = new Set<number>();
	const out: number[] = [];
	for (const raw of favoriteMovieIds) {
		if (!Number.isFinite(raw) || seen.has(raw)) continue;
		seen.add(raw);
		out.push(raw);
	}
	return out;
}

/**
 * Onboarding favorites are pinned on the profile but must exist in diary before
 * showcase edits. Creates watched logs for missing titles and marks all as liked.
 */
export async function backfillOnboardingFavoriteDiaryLogs(
	userId: string,
	favoriteMovieIds: number[],
): Promise<void> {
	const movieIds = uniqueFavoriteMovieIds(favoriteMovieIds);
	if (movieIds.length === 0) return;

	for (const movieId of movieIds) {
		const [existing] = await db
			.select({ id: log.id, liked: log.liked })
			.from(log)
			.where(
				and(
					eq(log.userId, userId),
					isNull(log.removedAt),
					eq(log.movieId, movieId),
					isNotNull(log.movieId),
				),
			)
			.limit(1);

		if (existing) {
			if (!existing.liked) {
				await db
					.update(log)
					.set({ liked: true })
					.where(eq(log.id, existing.id));
				await syncFavoritesListForUserTitle({
					userId,
					movieId,
					tvId: null,
					liked: true,
				});
			}
			continue;
		}

		await ensureMovieCached(movieId);

		const [own] = await db
			.select({ defaultVisibility: profile.defaultVisibility })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		const [inserted] = await db
			.insert(log)
			.values({
				id: makeId("log"),
				userId,
				movieId,
				tvId: null,
				watchedAt: new Date(),
				rating: null,
				liked: true,
				rewatch: false,
				watchVenue: "streaming",
				logScope: "show",
				visibility: own?.defaultVisibility ?? "public",
			})
			.returning({ id: log.id, liked: log.liked });

		if (inserted?.liked) {
			await syncFavoritesListForUserTitle({
				userId,
				movieId,
				tvId: null,
				liked: true,
			});
		}
	}
}

/** First-time onboarding showcase — up to four favorite films. */
export function showcaseItemsFromOnboardingFavorites(
	favoriteMovieIds: number[],
): ShowcaseItem[] {
	return migrateLegacyFavoriteMovies([], favoriteMovieIds);
}
