import { BoundedTtlCache } from "./bounded-ttl-cache";
import type { PeopleSearchRow } from "./people-search-row";
import {
	type TmdbCredit,
	type TmdbFetchOptions,
	tmdbApi,
	tmdbImg,
} from "./tmdb";

/** How many popular titles seed the cast leaderboard. */
const SAMPLE_POPULAR_TITLES = 4;
/** Billing-order depth per title when scoring cast. */
const CAST_DEPTH_PER_TITLE = 12;
/** Cached TMDb-derived cast boards (per listing kind + locale). */
const trendingCastCache = new BoundedTtlCache<PeopleSearchRow[]>(
	5 * 60 * 1000,
	8,
);

export type SearchDialogTrendingCastKind = "movie" | "tv";

function mapCreditToSearchRow(credit: TmdbCredit): PeopleSearchRow {
	const character = credit.character?.trim();
	return {
		id: credit.id,
		name: credit.name,
		profileUrl: tmdbImg.profile(credit.profile_path, "w185"),
		knownForDepartment: credit.known_for_department ?? "Acting",
		knownForTitles: character ? [character] : [],
	};
}

/**
 * Score cast from several popular titles — higher billing on hotter titles wins.
 * Pure helper for tests and the TMDb loader below.
 */
export function aggregateTrendingCastScores(
	casts: readonly { cast: readonly TmdbCredit[]; titleWeight: number }[],
): PeopleSearchRow[] {
	const scores = new Map<number, { score: number; credit: TmdbCredit }>();
	for (const { cast, titleWeight } of casts) {
		for (let i = 0; i < Math.min(cast.length, CAST_DEPTH_PER_TITLE); i++) {
			const member = cast[i];
			if (!member?.id || !member.name?.trim()) continue;
			const points = titleWeight * (CAST_DEPTH_PER_TITLE - i);
			const prev = scores.get(member.id);
			if (!prev) {
				scores.set(member.id, { score: points, credit: member });
			} else {
				prev.score += points;
			}
		}
	}
	return [...scores.values()]
		.sort((a, b) => b.score - a.score)
		.map(({ credit }) => mapCreditToSearchRow(credit));
}

async function fetchPopularTitleIds(
	kind: SearchDialogTrendingCastKind,
	fetchOpts: TmdbFetchOptions,
): Promise<number[]> {
	const page =
		kind === "movie"
			? await tmdbApi.popular(1, fetchOpts)
			: await tmdbApi.popularTv(1, fetchOpts);
	return page.results
		.map((row) => row.id)
		.filter((id) => Number.isFinite(id))
		.slice(0, SAMPLE_POPULAR_TITLES);
}

async function fetchCastForTitle(
	kind: SearchDialogTrendingCastKind,
	titleId: number,
	fetchOpts: TmdbFetchOptions,
): Promise<TmdbCredit[]> {
	if (kind === "movie") {
		const payload = await tmdbApi.movieCredits(titleId, fetchOpts);
		return payload.cast ?? [];
	}
	const payload = await tmdbApi.tvAggregateCredits(titleId, fetchOpts);
	return payload.cast ?? [];
}

/**
 * Cast leaderboard from the current popular movie or TV catalogue — powers the
 * numbered people rail under Movies vs Shows in ⌘K.
 */
export async function loadSearchDialogTrendingCastPeople(
	kind: SearchDialogTrendingCastKind,
	fetchOpts: TmdbFetchOptions,
): Promise<PeopleSearchRow[]> {
	const cacheKey = [
		kind,
		fetchOpts.language ?? "en-US",
		fetchOpts.showAdultContent ? "adult" : "safe",
	].join(":");
	const cached = trendingCastCache.get(cacheKey);
	if (cached) return cached;

	const titleIds = await fetchPopularTitleIds(kind, fetchOpts);
	if (titleIds.length === 0) {
		trendingCastCache.set(cacheKey, []);
		return [];
	}

	const castBoards = await Promise.all(
		titleIds.map(async (titleId, index) => {
			const cast = await fetchCastForTitle(kind, titleId, fetchOpts);
			// Earlier popular titles weigh more (4, 3, 2, 1).
			const titleWeight = SAMPLE_POPULAR_TITLES - index;
			return { cast, titleWeight };
		}),
	);

	const rows = aggregateTrendingCastScores(castBoards);
	trendingCastCache.set(cacheKey, rows);
	return rows;
}
