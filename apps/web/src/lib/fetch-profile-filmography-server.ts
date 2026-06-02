import "server-only";

import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import {
	type FilmographyQueryOpts,
	type ProfileFilmographyVenueCounts,
	profileFilmographyRowToSeed,
} from "@/lib/profile-filmography-fetch";
import { FILMOGRAPHY_DEFAULT_LIMIT } from "@/lib/profile-filmography-page-size";
import { serverApi } from "@/lib/server-api";

/**
 * RSC page-1 fetch for the profile filmography grid — forwards cookies via Eden,
 * returns poster seeds + pagination meta + the active-media venue count.
 */
export async function fetchProfileFilmographyServer(
	handle: string,
	opts: Omit<FilmographyQueryOpts, "signal">,
): Promise<{
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	venueCounts: ProfileFilmographyVenueCounts;
}> {
	const empty = {
		seeds: [] as PopularMovieSeed[],
		totalPages: 0,
		totalResults: 0,
		venueCounts: { movies: 0, tv: 0 },
	};
	try {
		const client = await serverApi();
		const res = await client.api.profiles({ handle }).filmography.get({
			query: {
				media: opts.media,
				order: opts.order,
				...(opts.venue ? { venue: opts.venue } : {}),
				...(opts.favorites ? { favorites: "1" } : {}),
				page: "1",
				limit: String(FILMOGRAPHY_DEFAULT_LIMIT),
			},
		});
		if (res.error != null) {
			console.error("[fetchProfileFilmographyServer] failed:", res.error);
			return empty;
		}
		const data = res.data as unknown as {
			results?: ProfileFilmographyRow[];
			total_pages?: number;
			total_results?: number;
			venueCounts?: ProfileFilmographyVenueCounts;
		} | null;
		const rows = Array.isArray(data?.results) ? data.results : [];
		const seeds = rows
			.map(profileFilmographyRowToSeed)
			.filter((s): s is PopularMovieSeed => s != null);
		return {
			seeds,
			totalPages: typeof data?.total_pages === "number" ? data.total_pages : 1,
			totalResults:
				typeof data?.total_results === "number"
					? data.total_results
					: seeds.length,
			venueCounts: data?.venueCounts ?? { movies: 0, tv: 0 },
		};
	} catch (err) {
		console.error("[fetchProfileFilmographyServer] threw:", err);
		return empty;
	}
}
