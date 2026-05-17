import { env } from "@still/env/server";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { tmdbApi, tmdbImg } from "../lib/tmdb";

/** Returned when `TMDB_API_KEY` is missing so the UI can explain empty rails. */
const TMDB_UNCONFIGURED = {
	code: "TMDB_UNCONFIGURED" as const,
	hint: "Add TMDB_API_KEY to apps/server .env (API key from https://www.themoviedb.org/settings/api). Restart the API server after saving.",
};

function tmdbUnconfiguredPaged(page: number) {
	return {
		page,
		total_pages: 0,
		total_results: 0,
		results: [] as unknown[],
		...TMDB_UNCONFIGURED,
	};
}

/** Allowed `sort_by` values for `/discover/tv` — anything else falls back to popularity. */
const DISCOVER_TV_SORT_WHITELIST = new Set([
	"popularity.desc",
	"popularity.asc",
	"first_air_date.desc",
	"first_air_date.asc",
	"vote_average.desc",
	"vote_average.asc",
	"name.asc",
]);

export const tvRoute = new Elysia({ prefix: "/api/tv", tags: ["tv"] })
	.use(context)
	.get(
		"/popular",
		async ({ query }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const data = await tmdbApi.popularTv(page);
			return {
				...data,
				results: data.results.map((show) => ({
					...show,
					// Lobby grid + `MoviePoster` expect `title`; TMDb TV summaries use `name`.
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
			};
		},
		{ query: t.Object({ page: t.Optional(t.String()) }) },
	)
	.get(
		"/discover",
		async ({ query }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const genreRaw = query.genre?.trim();
			const withGenres =
				genreRaw && Number.isFinite(Number(genreRaw))
					? Math.floor(Number(genreRaw))
					: undefined;
			const sortRaw = (query.sort ?? "").trim();
			const sortBy = DISCOVER_TV_SORT_WHITELIST.has(sortRaw)
				? sortRaw
				: "popularity.desc";
			const data = await tmdbApi.discoverTv(page, { withGenres, sortBy });
			return {
				...data,
				results: data.results.map((show) => ({
					...show,
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
				applied: { genre: withGenres ?? null, sort: sortBy },
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				genre: t.Optional(t.String()),
				sort: t.Optional(t.String()),
			}),
		},
	);
