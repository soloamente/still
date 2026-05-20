import { env } from "@still/env/server";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { tmdbApi, tmdbImg } from "../lib/tmdb";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";

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

/** Same vocabulary as movie discover — subscription / rent / etc. */
const DISCOVER_MONETIZATION_WHITELIST = new Set([
	"flatrate",
	"rent",
	"buy",
	"ads",
	"free",
]);

export const tvRoute = new Elysia({ prefix: "/api/tv", tags: ["tv"] })
	.use(context)
	// Text search — TMDb passthrough (same contract as `/api/movies/search` for the web dialog).
	.get(
		"/search",
		async ({ query, user }) => {
			const q = (query.q ?? "").trim();
			if (!q) return { results: [], total_pages: 0, total_results: 0, page: 1 };
			if (!env.TMDB_API_KEY)
				return tmdbUnconfiguredPaged(Number(query.page ?? 1) || 1);
			const language = await getTmdbLanguageForUser(user?.id);
			const data = await tmdbApi.searchTv(q, Number(query.page ?? 1), {
				language,
			});
			return {
				...data,
				results: data.results.map((show) => ({
					...show,
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
			};
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				page: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/popular",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const data = await tmdbApi.popularTv(page, { language });
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
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const genreRaw = query.genre?.trim();
			const withGenres =
				genreRaw && Number.isFinite(Number(genreRaw))
					? Math.floor(Number(genreRaw))
					: undefined;
			const sortRaw = (query.sort ?? "").trim();
			const sortBy = DISCOVER_TV_SORT_WHITELIST.has(sortRaw)
				? sortRaw
				: "popularity.desc";
			const airGteRaw = (query.air_date_gte ?? "").trim();
			const firstAirDateGte = /^\d{4}-\d{2}-\d{2}$/.test(airGteRaw)
				? airGteRaw
				: undefined;
			const monetizationRaw = (query.monetization ?? "").trim().toLowerCase();
			const withWatchMonetizationTypes = DISCOVER_MONETIZATION_WHITELIST.has(
				monetizationRaw,
			)
				? monetizationRaw
				: undefined;
			const regionRaw = (query.watch_region ?? "").trim().toUpperCase();
			const watchRegionAll =
				regionRaw === "ALL" || regionRaw === "ANY" || regionRaw === "WORLD";
			const watchRegionFromQuery =
				!watchRegionAll &&
				regionRaw.length === 2 &&
				/^[A-Z]{2}$/.test(regionRaw)
					? regionRaw
					: undefined;
			const watchRegionDefault = (env.TMDB_WATCH_REGION ?? "US")
				.trim()
				.toUpperCase();
			const watchRegion =
				withWatchMonetizationTypes !== undefined
					? watchRegionAll
						? undefined
						: (watchRegionFromQuery ??
							(watchRegionDefault.length === 2 &&
							/^[A-Z]{2}$/.test(watchRegionDefault)
								? watchRegionDefault
								: "US"))
					: undefined;

			const todayUtc = new Date().toISOString().slice(0, 10);
			// Mirror movie discover: “latest first air” without a future floor must not list unaired years-ahead rows.
			const firstAirDateLte =
				sortBy === "first_air_date.desc" && !firstAirDateGte
					? todayUtc
					: undefined;

			const data = await tmdbApi.discoverTv(page, {
				withGenres,
				sortBy,
				firstAirDateGte,
				firstAirDateLte,
				watchRegion,
				withWatchMonetizationTypes,
				language,
			});
			let rows = data.results;
			if (sortBy === "first_air_date.desc" && !firstAirDateGte) {
				rows = rows.filter((show) => {
					const d = show.first_air_date?.trim();
					if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
					return d <= todayUtc;
				});
			}
			return {
				...data,
				results: rows.map((show) => ({
					...show,
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
				applied: {
					genre: withGenres ?? null,
					sort: sortBy,
					air_date_gte: firstAirDateGte ?? null,
					air_date_lte: firstAirDateLte ?? null,
					monetization: withWatchMonetizationTypes ?? null,
					watch_region:
						withWatchMonetizationTypes !== undefined
							? watchRegionAll
								? "ALL"
								: (watchRegion ?? null)
							: null,
				},
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				genre: t.Optional(t.String()),
				sort: t.Optional(t.String()),
				air_date_gte: t.Optional(t.String()),
				monetization: t.Optional(t.String()),
				watch_region: t.Optional(t.String()),
			}),
		},
	)
	// TV series detail — TMDb passthrough (no local `tv` table yet; mirrors `/api/movies/:id` shape for the web).
	.get(
		"/:id",
		async ({ params, status, user }) => {
			const id = Number(params.id);
			if (!Number.isFinite(id)) return status(400, "Invalid id");
			if (!env.TMDB_API_KEY) {
				return {
					tmdbId: id,
					title: "",
					...TMDB_UNCONFIGURED,
				};
			}
			const language = await getTmdbLanguageForUser(user?.id);
			try {
				const detail = await tmdbApi.tvDetail(id, { language });
				const y = detail.first_air_date?.trim().slice(0, 4);
				const yearNum =
					y && y.length === 4 && /^\d{4}$/.test(y) ? Number(y) : null;
				return {
					tmdbId: id,
					title: detail.name,
					originalTitle: detail.original_name ?? null,
					overview: detail.overview ?? null,
					tagline: detail.tagline ?? null,
					year: yearNum,
					firstAirDate: detail.first_air_date ?? null,
					lastAirDate: detail.last_air_date ?? null,
					numberOfSeasons: detail.number_of_seasons ?? null,
					numberOfEpisodes: detail.number_of_episodes ?? null,
					episodeRuntime: detail.episode_run_time?.[0] ?? null,
					posterPath: detail.poster_path,
					backdropPath: detail.backdrop_path,
					poster_url: tmdbImg.poster(detail.poster_path),
					backdrop_url: tmdbImg.backdrop(detail.backdrop_path, "original"),
					genreIds: (detail.genres ?? []).map((g) => g.id),
					voteAverage: detail.vote_average ?? null,
					voteCount: detail.vote_count ?? null,
					paletteAccent: null,
					paletteMuted: null,
					paletteForeground: null,
					community: { averageRating: null, reviewsCount: 0 },
					tmdbJson: detail as unknown as Record<string, unknown>,
				};
			} catch (err) {
				console.error("[tv] detail failed", err);
				return status(404, "TV show not found");
			}
		},
		{ params: t.Object({ id: t.String() }) },
	);
