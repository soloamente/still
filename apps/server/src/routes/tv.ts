import { db, list, listItem, profile, tv } from "@still/db";
import { env } from "@still/env/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { ensureTvAdultClassification } from "../lib/adult-anime-classification";
import { filterTvCatalogueResults } from "../lib/adult-content-catalogue-filter";
import {
	buildAdultBlockedTvPayload,
	isTvAdultFromRow,
	shouldBlockAdultDetail,
} from "../lib/adult-content-policy";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { fetchPublicDiaryCommunityStats } from "../lib/fetch-public-diary-community-stats";
import {
	buildHeroArtworkSlides,
	buildScreenshotSlides,
	normalizeTmdbImagesBundle,
} from "../lib/hero-artwork-slides";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { fetchListingCommunityEngagementStats } from "../lib/listing-community-stats";
import {
	fetchListingQuotesForTv,
	parseTvQuoteEpisodeParams,
} from "../lib/listing-quotes-query";
import {
	getTvMalEnrichment,
	syncTvMalIdFromDetail,
} from "../lib/mal-anime-enrichment";
import { fetchFollowingRatingsForTv } from "../lib/movie-following-ratings";
import { type TmdbTvSummary, tmdbApi, tmdbImg } from "../lib/tmdb";
import { parseCommaIntList } from "../lib/tmdb-discover-params";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";
import { ensureTvCached } from "../lib/tv-cache";
import {
	getTvSeasonDetailCached,
	getTvSeasonsCached,
} from "../lib/tv-season-cache";

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

const COMPANY_SEARCH_VERIFY_MAX = 20;
const COMPANY_DISCOVER_SCAN_PAGES = 4;

async function tvBelongsToCompany(
	tvId: number,
	companyId: number,
	language: string,
): Promise<boolean> {
	const row = await tmdbApi.tvProductionCompanies(tvId, { language });
	return (row.production_companies ?? []).some((c) => c.id === companyId);
}

async function filterTvSearchResultsByCompany(
	shows: TmdbTvSummary[],
	companyId: number,
	language: string,
): Promise<TmdbTvSummary[]> {
	const candidates = shows.slice(0, COMPANY_SEARCH_VERIFY_MAX);
	const verified = await Promise.all(
		candidates.map(async (show) => ({
			show,
			ok: await tvBelongsToCompany(show.id, companyId, language),
		})),
	);
	return verified.filter((row) => row.ok).map((row) => row.show);
}

async function discoverCompanyTvMatchingTitle(
	companyId: number,
	titleNeedle: string,
	language: string,
	showAdultContent: boolean,
): Promise<TmdbTvSummary[]> {
	const ql = titleNeedle.toLowerCase();
	const out: TmdbTvSummary[] = [];
	const seen = new Set<number>();

	for (let page = 1; page <= COMPANY_DISCOVER_SCAN_PAGES; page++) {
		const disc = await tmdbApi.discoverTv(page, {
			withCompanies: companyId,
			sortBy: "popularity.desc",
			language,
			showAdultContent,
		});
		for (const show of disc.results) {
			if (seen.has(show.id)) continue;
			const titleHaystack =
				`${show.name} ${show.original_name ?? ""}`.toLowerCase();
			if (!titleHaystack.includes(ql)) continue;
			seen.add(show.id);
			out.push(show);
		}
		if (out.length >= COMPANY_SEARCH_VERIFY_MAX) break;
		const totalPages = disc.total_pages ?? 0;
		if (page >= totalPages) break;
	}

	return out.slice(0, COMPANY_SEARCH_VERIFY_MAX);
}

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
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const page = Number(query.page ?? 1) || 1;
			const companyRaw = query.company?.trim();
			const companyId =
				companyRaw && Number.isFinite(Number(companyRaw))
					? Math.floor(Number(companyRaw))
					: null;

			const data = await tmdbApi.searchTv(q, page, {
				language,
				showAdultContent,
			});
			let rows = data.results;

			if (companyId) {
				const verified = await filterTvSearchResultsByCompany(
					rows,
					companyId,
					language,
				);
				const fromDiscover = await discoverCompanyTvMatchingTitle(
					companyId,
					q,
					language,
					showAdultContent,
				);
				const merged = new Map<number, TmdbTvSummary>();
				for (const show of [...verified, ...fromDiscover]) {
					merged.set(show.id, show);
				}
				rows = [...merged.values()].slice(0, COMPANY_SEARCH_VERIFY_MAX);
			}

			rows = await filterTvCatalogueResults(rows, showAdultContent);

			return {
				...data,
				page,
				results: rows.map((show) => ({
					...show,
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
				total_results: companyId ? rows.length : data.total_results,
			};
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				page: t.Optional(t.String()),
				company: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/popular",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const data = await tmdbApi.popularTv(page, {
				language,
				showAdultContent,
			});
			const rows = await filterTvCatalogueResults(
				data.results,
				showAdultContent,
			);
			return {
				...data,
				results: rows.map((show) => ({
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
		"/on-the-air",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const sortRaw = (query.sort ?? "").trim();
			const sortBy = DISCOVER_TV_SORT_WHITELIST.has(sortRaw)
				? sortRaw
				: "popularity.desc";
			// Align with home **Ongoing** — Returning Series (`0`), not `/tv/on_the_air` (broadcast window overlaps Ended).
			const data = await tmdbApi.discoverTv(page, {
				sortBy,
				withStatus: 0,
				language,
				showAdultContent,
			});
			const rows = await filterTvCatalogueResults(
				data.results,
				showAdultContent,
			);
			return {
				...data,
				results: rows.map((show) => ({
					...show,
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				sort: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/genres",
		async ({ query, user }) => {
			if (!env.TMDB_API_KEY)
				return {
					genres: [] as { id: number; name: string }[],
					...TMDB_UNCONFIGURED,
				};
			const languageOverride = (query.language ?? "").trim();
			const language =
				languageOverride && /^[a-z]{2}(-[A-Z]{2})?$/i.test(languageOverride)
					? languageOverride
					: await getTmdbLanguageForUser(user?.id);
			const data = await tmdbApi.genreTvList({ language });
			return { genres: data.genres ?? [] };
		},
		{ query: t.Object({ language: t.Optional(t.String()) }) },
	)
	.get(
		"/discover",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const withGenres = parseCommaIntList(query.genre?.trim());
			const withKeywords = parseCommaIntList(query.keywords?.trim());
			const textQuery = (query.q ?? "").trim() || undefined;
			const companyRaw = query.company?.trim();
			const withCompanies =
				companyRaw && Number.isFinite(Number(companyRaw))
					? Math.floor(Number(companyRaw))
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

			const statusRaw = (query.status ?? "").trim().toLowerCase();
			const withStatus =
				statusRaw === "ended" ||
				statusRaw === "completed" ||
				statusRaw === "complete"
					? 3
					: statusRaw === "returning" || statusRaw === "ongoing"
						? 0
						: undefined;

			const data = await tmdbApi.discoverTv(page, {
				withGenres: withGenres.length > 0 ? withGenres : undefined,
				withKeywords: withKeywords.length > 0 ? withKeywords : undefined,
				withCompanies,
				sortBy,
				firstAirDateGte,
				firstAirDateLte,
				watchRegion,
				withWatchMonetizationTypes,
				withStatus,
				language,
				withTextQuery: textQuery,
				showAdultContent,
			});
			let rows = data.results;
			if (sortBy === "first_air_date.desc" && !firstAirDateGte) {
				rows = rows.filter((show) => {
					const d = show.first_air_date?.trim();
					if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
					return d <= todayUtc;
				});
			}
			rows = await filterTvCatalogueResults(rows, showAdultContent, {
				keywordIds: withKeywords,
			});
			return {
				...data,
				results: rows.map((show) => ({
					...show,
					title: show.name,
					poster_url: tmdbImg.poster(show.poster_path),
					backdrop_url: tmdbImg.backdrop(show.backdrop_path),
				})),
				applied: {
					genre: withGenres.length > 0 ? withGenres : null,
					keywords: withKeywords.length > 0 ? withKeywords : null,
					company: withCompanies ?? null,
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
					text_query: textQuery ?? null,
				},
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				genre: t.Optional(t.String()),
				/** TMDb discover `with_text_query` — strict AND with genre/keyword/company filters. */
				q: t.Optional(t.String()),
				keywords: t.Optional(t.String()),
				company: t.Optional(t.String()),
				sort: t.Optional(t.String()),
				air_date_gte: t.Optional(t.String()),
				monetization: t.Optional(t.String()),
				watch_region: t.Optional(t.String()),
				/** `ended` / `completed` → TMDb status 3; `returning` / `ongoing` → 0. */
				status: t.Optional(t.String()),
			}),
		},
	)
	// Season list for progress pickers — cached on `tv.tmdbJson` for 24h.
	.get(
		"/:id/seasons",
		async ({ params, status, user }) => {
			const id = Number(params.id);
			if (!Number.isFinite(id)) return status(400, "Invalid id");
			if (!env.TMDB_API_KEY) return { seasons: [], ...TMDB_UNCONFIGURED };
			const language = await getTmdbLanguageForUser(user?.id);
			await ensureTvCached(id);
			const seasons = await getTvSeasonsCached(id, language);
			return { seasons };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id/season/:seasonNumber",
		async ({ params, status, user }) => {
			const id = Number(params.id);
			const seasonNumber = Number(params.seasonNumber);
			if (!Number.isFinite(id) || !Number.isFinite(seasonNumber)) {
				return status(400, "Invalid id or season");
			}
			if (!env.TMDB_API_KEY) return { season: null, ...TMDB_UNCONFIGURED };
			const language = await getTmdbLanguageForUser(user?.id);
			await ensureTvCached(id);
			const season = await getTvSeasonDetailCached(id, seasonNumber, language);
			return { season };
		},
		{
			params: t.Object({
				id: t.String(),
				seasonNumber: t.String(),
			}),
		},
	)
	/** Public lists that include this series — TV detail community lists. */
	.get(
		"/:id/lists",
		async ({ params }) => {
			const tvId = Number(params.id);
			if (!Number.isFinite(tvId)) return [];
			const rows = await db
				.select({ list, ownerHandle: profile.handle })
				.from(listItem)
				.innerJoin(list, eq(listItem.listId, list.id))
				.innerJoin(profile, eq(list.userId, profile.userId))
				.where(
					and(
						eq(listItem.tvId, tvId),
						eq(list.isPublic, true),
						isNull(list.removedAt),
					),
				)
				.orderBy(desc(list.likesCount), desc(list.updatedAt))
				.limit(24);
			const mapped = rows.map((r) => ({
				...r.list,
				ownerHandle: r.ownerHandle,
			}));
			return withCoverPosterPaths(mapped);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	/** Published dialogue quotes for a TV episode — season + episode required. */
	.get(
		"/:id/quotes",
		async ({ params, query, user, status }) => {
			const tvId = Number(params.id);
			if (!Number.isFinite(tvId)) return status(400, "Invalid id");
			const episode = parseTvQuoteEpisodeParams(query);
			if (!episode) {
				return status(
					400,
					"season and episode query params are required for TV quotes",
				);
			}
			return fetchListingQuotesForTv({
				tvId,
				seasonNumber: episode.seasonNumber,
				episodeNumber: episode.episodeNumber,
				sort: query.sort,
				page: query.page,
				limit: query.limit,
				viewerUserId: user?.id ?? null,
			});
		},
		{
			params: t.Object({ id: t.String() }),
			query: t.Object({
				season: t.Optional(t.String()),
				episode: t.Optional(t.String()),
				sort: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	/** Latest rated/favorited diary rows from patrons the viewer follows (TV detail community). */
	.get(
		"/:id/following-ratings",
		async ({ params, user }) => {
			const tvId = Number(params.id);
			if (!Number.isFinite(tvId)) return { entries: [], moreCount: 0 };
			if (!user) return { entries: [], moreCount: 0 };
			return fetchFollowingRatingsForTv(user.id, tvId);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	// TV series detail — cache row first, then block adult titles when patron pref is off.
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
			const showAdultContent = await getShowAdultContentForUser(user?.id);

			await ensureTvCached(id);
			await ensureTvAdultClassification(id);

			const [row] = await db
				.select()
				.from(tv)
				.where(eq(tv.tmdbId, id))
				.limit(1);
			if (
				row &&
				shouldBlockAdultDetail(showAdultContent, isTvAdultFromRow(row))
			) {
				return buildAdultBlockedTvPayload(id, row.title);
			}

			try {
				const [detail, imagesFromDedicated] = await Promise.all([
					tmdbApi.tvDetail(id, { language }),
					tmdbApi.tvImages(id).catch(() => null),
				]);
				await syncTvMalIdFromDetail(
					id,
					detail as unknown as Record<string, unknown>,
				).catch(() => {});
				const malEnrichment = await getTvMalEnrichment(id).catch(() => null);
				const fullImagesBundle = normalizeTmdbImagesBundle(
					imagesFromDedicated ?? detail.images,
				);
				const [communityRatings, communityEngagement] = await Promise.all([
					fetchPublicDiaryCommunityStats({ tvId: id }),
					fetchListingCommunityEngagementStats({ tvId: id }),
				]);
				const community = { ...communityRatings, ...communityEngagement };
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
					hero_artwork: buildHeroArtworkSlides({
						title: detail.name,
						posterPath: detail.poster_path,
						backdropPath: detail.backdrop_path,
						images: fullImagesBundle,
					}),
					screenshots: buildScreenshotSlides({
						title: detail.name,
						backdropPath: detail.backdrop_path,
						images: fullImagesBundle,
					}),
					genreIds: (detail.genres ?? []).map((g) => g.id),
					voteAverage: detail.vote_average ?? null,
					voteCount: detail.vote_count ?? null,
					paletteAccent: null,
					paletteMuted: null,
					paletteForeground: null,
					community,
					malEnrichment,
					tmdbJson: detail as unknown as Record<string, unknown>,
				};
			} catch (err) {
				console.error("[tv] detail failed", err);
				return status(404, "TV show not found");
			}
		},
		{ params: t.Object({ id: t.String() }) },
	);
