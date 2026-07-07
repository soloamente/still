import { db, log, profile, type ShowcaseItem } from "@still/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { makeId } from "./cuid";
import { ensureMovieCached } from "./ensure-movie-cached";
import { syncFavoritesListForUserTitle } from "./favorites-list-sync";
import { migrateLegacyFavoriteMovies } from "./profile-showcase";

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

/** Coerce profile `favoriteMovieIds` json into a clean number list. */
export function parseProfileFavoriteMovieIds(raw: unknown): number[] {
	if (!Array.isArray(raw)) return [];
	return uniqueFavoriteMovieIds(
		raw.filter((id): id is number => typeof id === "number"),
	);
}

/** Favorite films that still lack any diary row for this patron. */
export async function onboardingFavoriteMovieIdsMissingDiary(
	userId: string,
	favoriteMovieIds: number[],
): Promise<number[]> {
	const movieIds = uniqueFavoriteMovieIds(favoriteMovieIds);
	if (movieIds.length === 0) return [];

	const rows = await db
		.select({ movieId: log.movieId })
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				isNull(log.removedAt),
				isNotNull(log.movieId),
				inArray(log.movieId, movieIds),
			),
		);

	const have = new Set(
		rows.map((row) => row.movieId).filter((id): id is number => id != null),
	);
	return movieIds.filter((id) => !have.has(id));
}

/**
 * Onboarding favorites are pinned on the profile but must exist in diary before
 * showcase edits. Creates watched logs for missing titles and marks all as liked.
 */
export async function backfillOnboardingFavoriteDiaryLogs(
	userId: string,
	favoriteMovieIds: number[],
	opts?: { watchedAt?: Date },
): Promise<void> {
	const movieIds = uniqueFavoriteMovieIds(favoriteMovieIds);
	if (movieIds.length === 0) return;
	const watchedAt = opts?.watchedAt ?? new Date();

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
				watchedAt,
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

/**
 * One-time repair for patrons who finished onboarding before favorites were
 * synced into diary — restores logs (dated to onboarding) and empty showcase.
 */
export async function repairLegacyOnboardingFavoriteDiary(input: {
	userId: string;
	favoriteMovieIds: number[];
	onboardedAt: Date | null;
	showcaseItems: unknown;
}): Promise<boolean> {
	const favoriteMovieIds = uniqueFavoriteMovieIds(input.favoriteMovieIds);
	if (favoriteMovieIds.length === 0) return false;

	const missing = await onboardingFavoriteMovieIdsMissingDiary(
		input.userId,
		favoriteMovieIds,
	);
	const showcaseEmpty =
		!Array.isArray(input.showcaseItems) || input.showcaseItems.length === 0;
	if (missing.length === 0 && !showcaseEmpty) return false;

	const watchedAt = input.onboardedAt ?? new Date();
	await backfillOnboardingFavoriteDiaryLogs(input.userId, favoriteMovieIds, {
		watchedAt,
	});

	if (showcaseEmpty) {
		await db
			.update(profile)
			.set({
				showcaseItems: showcaseItemsFromOnboardingFavorites(favoriteMovieIds),
			})
			.where(eq(profile.userId, input.userId));
	}

	return true;
}

/** First-time onboarding showcase — up to four favorite films. */
export function showcaseItemsFromOnboardingFavorites(
	favoriteMovieIds: number[],
): ShowcaseItem[] {
	return migrateLegacyFavoriteMovies([], favoriteMovieIds);
}
