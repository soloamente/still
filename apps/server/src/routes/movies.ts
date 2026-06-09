import {
	db,
	list,
	listItem,
	movie,
	movieCredit,
	person,
	profile,
	review,
	user,
} from "@still/db";
import { env } from "@still/env/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import { filterMovieCatalogueResults } from "../lib/adult-content-catalogue-filter";
import {
	buildAdultBlockedMoviePayload,
	isMovieAdult,
	shouldBlockAdultDetail,
} from "../lib/adult-content-policy";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { contentVisibilityWhere } from "../lib/content-visibility";
import { fetchPublicDiaryCommunityStats } from "../lib/fetch-public-diary-community-stats";
import {
	buildHeroArtworkSlides,
	buildScreenshotSlides,
	normalizeTmdbImagesBundle,
} from "../lib/hero-artwork-slides";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { fetchFollowingRatingsForMovie } from "../lib/movie-following-ratings";
import { fetchReviewMovieScreenshots } from "../lib/review-movie-screenshots";
import { routeBody } from "../lib/route-body";
import { SEARCH_DIALOG_STUDIO_IDS } from "../lib/search-dialog-studio-ids";
import { syncMoviePosterPalette } from "../lib/sync-movie-palette";
import {
	type TmdbMovieDetail,
	type TmdbMovieSummary,
	tmdbApi,
	tmdbImg,
} from "../lib/tmdb";
import { parseCommaIntList } from "../lib/tmdb-discover-params";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";

/** Returned when `TMDB_API_KEY` is missing so the UI can explain empty rails/search. */
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

const COMPANY_SEARCH_VERIFY_MAX = 20;
const COMPANY_DISCOVER_SCAN_PAGES = 4;

/** TMDb search rows do not include company ids — verify via `/movie/{id}`. */
async function movieBelongsToCompany(
	movieId: number,
	companyId: number,
	language: string,
): Promise<boolean> {
	const row = await tmdbApi.movieProductionCompanies(movieId, { language });
	return (row.production_companies ?? []).some((c) => c.id === companyId);
}

async function filterSearchResultsByCompany(
	movies: TmdbMovieSummary[],
	companyId: number,
	language: string,
): Promise<TmdbMovieSummary[]> {
	const candidates = movies.slice(0, COMPANY_SEARCH_VERIFY_MAX);
	const verified = await Promise.all(
		candidates.map(async (m) => ({
			movie: m,
			ok: await movieBelongsToCompany(m.id, companyId, language),
		})),
	);
	return verified.filter((row) => row.ok).map((row) => row.movie);
}

/** Discover catalogue for one studio, then match title substring (search has no `with_companies`). */
async function discoverCompanyMoviesMatchingTitle(
	companyId: number,
	titleNeedle: string,
	language: string,
	showAdultContent: boolean,
): Promise<TmdbMovieSummary[]> {
	const ql = titleNeedle.toLowerCase();
	const out: TmdbMovieSummary[] = [];
	const seen = new Set<number>();

	for (let page = 1; page <= COMPANY_DISCOVER_SCAN_PAGES; page++) {
		const disc = await tmdbApi.discoverMovies(page, {
			withCompanies: companyId,
			sortBy: "popularity.desc",
			language,
			showAdultContent,
		});
		for (const m of disc.results) {
			if (seen.has(m.id)) continue;
			const titleHaystack =
				`${m.title} ${m.original_title ?? ""}`.toLowerCase();
			if (!titleHaystack.includes(ql)) continue;
			seen.add(m.id);
			out.push(m);
		}
		if (out.length >= COMPANY_SEARCH_VERIFY_MAX) break;
		const totalPages = disc.total_pages ?? 0;
		if (page >= totalPages) break;
	}

	return out.slice(0, COMPANY_SEARCH_VERIFY_MAX);
}

/** Shifts a UTC calendar day (`YYYY-MM-DD`) so discover windows do not double-count “today”. */
function utcYyyyMmDdPlusDays(yyyyMmDd: string, days: number): string {
	const [yRaw, mRaw, dRaw] = yyyyMmDd.split("-");
	const y = Number(yRaw);
	const m = Number(mRaw);
	const d = Number(dRaw);
	const t = Date.UTC(y, m - 1, d);
	return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * TMDb sometimes returns theatrical discover rows with an empty `release_date` (TBA / missing
 * regional row). Date-sorted “in cinemas” surfaces should drop them so posters never imply a release.
 */
function tmdbDiscoverTheatricalRowHasCalendarDate(
	releaseDate: string | undefined,
): boolean {
	const d = releaseDate?.trim();
	return Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));
}

/** Allowed `sort_by` values for `/discover/movie` — anything else falls back to popularity. */
const DISCOVER_SORT_WHITELIST = new Set([
	"popularity.desc",
	"popularity.asc",
	"primary_release_date.desc",
	"primary_release_date.asc",
	"vote_average.desc",
	"vote_average.asc",
	"original_title.asc",
]);

/** TMDb `with_watch_monetization_types` — single-token whitelist (comma AND is server-only later if needed). */
const DISCOVER_MONETIZATION_WHITELIST = new Set([
	"flatrate",
	"rent",
	"buy",
	"ads",
	"free",
]);

/** Prefer locale-specific copy when TMDb returns it; fall back to the cached `en-US` row. */
function localizedMovieCopy(
	localized: TmdbMovieDetail,
	row: { title: string; tagline: string | null; overview: string | null },
): { title: string; tagline: string | null; overview: string | null } {
	const pick = (
		local: string | null | undefined,
		fallback: string | null,
	): string | null => {
		const trimmed = typeof local === "string" ? local.trim() : "";
		return trimmed.length > 0 ? trimmed : fallback;
	};
	return {
		title: pick(localized.title, row.title) ?? row.title,
		tagline: pick(localized.tagline ?? null, row.tagline),
		overview: pick(localized.overview, row.overview),
	};
}

/**
 * Cache a TMDb detail response into the local `movie` + `person` + `movie_credit`
 * tables. Idempotent: every call upserts. Returns the saved movie row.
 */
async function cacheDetail(detail: TmdbMovieDetail) {
	const releaseDate = detail.release_date ?? null;
	await db
		.insert(movie)
		.values({
			tmdbId: detail.id,
			imdbId: detail.imdb_id ?? null,
			title: detail.title,
			originalTitle: detail.original_title ?? null,
			tagline: detail.tagline ?? null,
			overview: detail.overview,
			posterPath: detail.poster_path,
			backdropPath: detail.backdrop_path,
			runtime: detail.runtime ?? null,
			releaseDate: releaseDate ? new Date(releaseDate) : null,
			year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
			genreIds: (detail.genres ?? []).map((g) => g.id),
			spokenLanguages: (detail.spoken_languages ?? []).map((l) => l.iso_639_1),
			originalLanguage: detail.original_language ?? null,
			status: detail.status ?? null,
			popularity: detail.popularity ?? null,
			voteAverage: detail.vote_average ?? null,
			voteCount: detail.vote_count ?? null,
			adult: detail.adult === true,
			tmdbJson: detail as unknown as Record<string, unknown>,
			lastSyncedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: movie.tmdbId,
			set: {
				title: detail.title,
				overview: detail.overview,
				posterPath: detail.poster_path,
				backdropPath: detail.backdrop_path,
				adult: detail.adult === true,
				tmdbJson: detail as unknown as Record<string, unknown>,
				lastSyncedAt: new Date(),
				popularity: detail.popularity ?? null,
				voteAverage: detail.vote_average ?? null,
			},
		});

	// Best-effort: upsert credits. We don't fail the request if this errors.
	try {
		const cast = detail.credits?.cast ?? [];
		const crew = detail.credits?.crew ?? [];
		const all = [
			...cast.map((c) => ({ ...c, department: "Cast" as const })),
			...crew.map((c) => ({ ...c })),
		];
		if (all.length) {
			// First upsert all unique people.
			const people = new Map<number, (typeof all)[number]>();
			for (const c of all) if (!people.has(c.id)) people.set(c.id, c);
			await db
				.insert(person)
				.values(
					Array.from(people.values()).map((p) => ({
						tmdbId: p.id,
						name: p.name,
						profilePath: p.profile_path ?? null,
						knownForDepartment: p.known_for_department ?? null,
						popularity: p.popularity ?? null,
					})),
				)
				.onConflictDoNothing();
			// Then credit rows.
			await db
				.insert(movieCredit)
				.values(
					all.map((c) => ({
						movieId: detail.id,
						personId: c.id,
						creditId: c.credit_id,
						department: (c.department as string) ?? "Cast",
						job: (c.job as string) ?? null,
						character: (c.character as string) ?? null,
						order: (c.order as number) ?? null,
					})),
				)
				.onConflictDoNothing();
		}
	} catch (err) {
		console.error("[movies] failed to cache credits", err);
	}

	await syncMoviePosterPalette(detail.id, detail.poster_path);
}

/**
 * Cached rows can be "fresh" by time but still lack newer `append_to_response`
 * payloads (e.g. `keywords`). Without this, the UI never picks up new sections
 * until the 7‑day stale window elapses.
 */
function tmdbJsonNeedsEnrichment(tmdbJson: unknown): boolean {
	if (tmdbJson == null || typeof tmdbJson !== "object") return true;
	const o = tmdbJson as Record<string, unknown>;
	if (!("keywords" in o)) return true;
	if (!("recommendations" in o)) return true;
	if (!("images" in o)) return true;
	return false;
}

const STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const moviesRoute = new Elysia({
	prefix: "/api/movies",
	tags: ["movies"],
})
	.use(context)
	// Search — TMDb passthrough, paged. We don't cache search hits to keep
	// the local DB clean of one-off lookups.
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

			const data = await tmdbApi.searchMovies(q, page, {
				language,
				showAdultContent,
			});
			let rows = data.results;

			if (companyId) {
				// `/search/movie` never ships `production_company_ids` — verify each hit, then
				// scan the studio discover sheet for title matches search may miss.
				const verified = await filterSearchResultsByCompany(
					rows,
					companyId,
					language,
				);
				const fromDiscover = await discoverCompanyMoviesMatchingTitle(
					companyId,
					q,
					language,
					showAdultContent,
				);
				const merged = new Map<number, TmdbMovieSummary>();
				for (const m of [...verified, ...fromDiscover]) {
					merged.set(m.id, m);
				}
				rows = [...merged.values()].slice(0, COMPANY_SEARCH_VERIFY_MAX);
			}

			rows = await filterMovieCatalogueResults(rows, showAdultContent);

			return {
				...data,
				page,
				results: rows.map((m) => ({
					...m,
					poster_url: tmdbImg.poster(m.poster_path),
					backdrop_url: tmdbImg.backdrop(m.backdrop_path),
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
			const data = await tmdbApi.popular(page, { language, showAdultContent });
			const rows = await filterMovieCatalogueResults(
				data.results,
				showAdultContent,
			);
			return {
				...data,
				results: rows.map((m) => ({
					...m,
					poster_url: tmdbImg.poster(m.poster_path),
					backdrop_url: tmdbImg.backdrop(m.backdrop_path),
				})),
			};
		},
		{ query: t.Object({ page: t.Optional(t.String()) }) },
	)
	.get(
		"/upcoming",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			// Theatrical “opening soon” via discover — not TMDb `/movie/upcoming` (curated, can drift).
			// `Latest + in cinemas` uses `primary_release_date.lte=today`; use **gte = tomorrow** so
			// same-day openings are not duplicated at the top of both grids (TMDb `gte`/`lte` are inclusive).
			const regionFromQuery = (query.region ?? "").trim().toUpperCase();
			const releaseRegionFromQuery =
				regionFromQuery.length === 2 && /^[A-Z]{2}$/.test(regionFromQuery)
					? regionFromQuery
					: undefined;
			const releaseRegionDefault = (env.TMDB_WATCH_REGION ?? "US")
				.trim()
				.toUpperCase();
			const releaseRegionFallback =
				releaseRegionDefault.length === 2 &&
				/^[A-Z]{2}$/.test(releaseRegionDefault)
					? releaseRegionDefault
					: "US";
			const discoveryRegion = releaseRegionFromQuery ?? releaseRegionFallback;
			const todayUtc = new Date().toISOString().slice(0, 10);
			// `Latest + in cinemas` uses `primary_release_date.lte=today` (includes same-day openings).
			// If we also use `gte=today` here, TMDb surfaces the same “opens today” rows at the top of
			// both grids — use **tomorrow** so Upcoming is strictly after the Latest window.
			const primaryReleaseDateGte = utcYyyyMmDdPlusDays(todayUtc, 1);
			const data = await tmdbApi.discoverMovies(page, {
				sortBy: "primary_release_date.asc",
				withReleaseTypes: "2|3",
				region: discoveryRegion,
				primaryReleaseDateGte,
				language,
				showAdultContent,
			});
			const theatricalRows = data.results.filter((m) =>
				tmdbDiscoverTheatricalRowHasCalendarDate(m.release_date),
			);
			const rows = await filterMovieCatalogueResults(
				theatricalRows,
				showAdultContent,
			);
			return {
				...data,
				results: rows.map((m) => ({
					...m,
					poster_url: tmdbImg.poster(m.poster_path),
					backdrop_url: tmdbImg.backdrop(m.backdrop_path),
				})),
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				/** Optional ISO 3166-1 alpha-2 — scopes primary release dates (defaults to `TMDB_WATCH_REGION`). */
				region: t.Optional(t.String()),
			}),
		},
	)
	/** TMDb `/movie/now_playing` — titles currently in theatres (region-aware on TMDb’s side). */
	.get(
		"/now-playing",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const data = await tmdbApi.nowPlaying(page, {
				language,
				showAdultContent,
			});
			const rows = await filterMovieCatalogueResults(
				data.results,
				showAdultContent,
			);
			return {
				...data,
				results: rows.map((m) => ({
					...m,
					poster_url: tmdbImg.poster(m.poster_path),
					backdrop_url: tmdbImg.backdrop(m.backdrop_path),
				})),
			};
		},
		{ query: t.Object({ page: t.Optional(t.String()) }) },
	)
	.get(
		"/trending",
		async ({ query, user }) => {
			const page = Number(query.page ?? 1) || 1;
			if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const data = await tmdbApi.trending(
				(query.window as "day" | "week") ?? "day",
				page,
				{ language, showAdultContent },
			);
			const rows = await filterMovieCatalogueResults(
				data.results,
				showAdultContent,
			);
			return {
				...data,
				results: rows.map((m) => ({
					...m,
					poster_url: tmdbImg.poster(m.poster_path),
					backdrop_url: tmdbImg.backdrop(m.backdrop_path),
				})),
			};
		},
		{
			query: t.Object({
				window: t.Optional(t.String()),
				page: t.Optional(t.String()),
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
			const data = await tmdbApi.genreMovieList({ language });
			return { genres: data.genres ?? [] };
		},
		{ query: t.Object({ language: t.Optional(t.String()) }) },
	)
	/** Curated production companies for the search dialog studio rail (logos from TMDb). */
	.get("/studios", async () => {
		if (!env.TMDB_API_KEY) {
			return {
				studios: SEARCH_DIALOG_STUDIO_IDS.map((id) => ({
					id,
					name: String(id),
					logo_url: null as string | null,
				})),
				...TMDB_UNCONFIGURED,
			};
		}
		const studios = await Promise.all(
			SEARCH_DIALOG_STUDIO_IDS.map(async (id) => {
				try {
					const row = await tmdbApi.company(id);
					return {
						id,
						name: row.name,
						logo_url: tmdbImg.logo(row.logo_path, "w92"),
					};
				} catch {
					return { id, name: String(id), logo_url: null as string | null };
				}
			}),
		);
		return { studios };
	})
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
			const sortBy = DISCOVER_SORT_WHITELIST.has(sortRaw)
				? sortRaw
				: "popularity.desc";
			const venueRaw = (query.venue ?? "").trim().toLowerCase();
			// Monetization-only discover (at-home lobby) must still scope to digital release type `4` —
			// otherwise TMDb returns theatrical titles that merely have a flatrate provider listed.
			const withReleaseTypes =
				venueRaw === "theaters"
					? "2|3"
					: venueRaw === "streaming"
						? "4"
						: undefined;
			const monetizationRaw = (query.monetization ?? "").trim().toLowerCase();
			const withWatchMonetizationTypes = DISCOVER_MONETIZATION_WHITELIST.has(
				monetizationRaw,
			)
				? monetizationRaw
				: undefined;
			const withReleaseTypesResolved =
				withReleaseTypes ??
				(withWatchMonetizationTypes !== undefined ? "4" : undefined);
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
			const releaseGteRaw = (query.release_gte ?? "").trim();
			const primaryReleaseDateGteFromQuery = /^\d{4}-\d{2}-\d{2}$/.test(
				releaseGteRaw,
			)
				? releaseGteRaw
				: undefined;

			// “Latest + in cinemas” must not use `/movie/upcoming` semantics (future dates only).
			// TMDb discover: theatrical release types + primary date ≤ today in `region` = already playing/released theatrically, newest first.
			const regionFromQuery = (query.region ?? "").trim().toUpperCase();
			const releaseRegionFromQuery =
				regionFromQuery.length === 2 && /^[A-Z]{2}$/.test(regionFromQuery)
					? regionFromQuery
					: undefined;
			const releaseRegionDefault = (env.TMDB_WATCH_REGION ?? "US")
				.trim()
				.toUpperCase();
			const releaseRegionFallback =
				releaseRegionDefault.length === 2 &&
				/^[A-Z]{2}$/.test(releaseRegionDefault)
					? releaseRegionDefault
					: "US";
			const applyTheatricalAlreadyReleased =
				venueRaw === "theaters" &&
				sortBy === "primary_release_date.desc" &&
				withWatchMonetizationTypes === undefined;
			const discoveryRegion = applyTheatricalAlreadyReleased
				? (releaseRegionFromQuery ?? releaseRegionFallback)
				: undefined;
			// Streaming “newest at home” used to omit this cap — TMDb could still return far-future
			// `release_date` rows. Any `primary_release_date.desc` without an explicit `release_gte`
			// (upcoming uses asc + gte) means “already released / announced through today”.
			const primaryReleaseDateLte =
				sortBy === "primary_release_date.desc" &&
				!primaryReleaseDateGteFromQuery
					? todayUtc
					: undefined;

			const data = await tmdbApi.discoverMovies(page, {
				withGenres: withGenres.length > 0 ? withGenres : undefined,
				withKeywords: withKeywords.length > 0 ? withKeywords : undefined,
				withCompanies,
				sortBy,
				withReleaseTypes: withReleaseTypesResolved,
				region: discoveryRegion,
				primaryReleaseDateLte,
				primaryReleaseDateGte: primaryReleaseDateGteFromQuery,
				watchRegion,
				withWatchMonetizationTypes,
				language,
				withTextQuery: textQuery,
				showAdultContent,
			});
			// Theatrical venue: hide undated rows so “Latest in cinemas” never shows ambiguous TBA tiles.
			let discoverRows =
				venueRaw === "theaters"
					? data.results.filter((m) =>
							tmdbDiscoverTheatricalRowHasCalendarDate(m.release_date),
						)
					: data.results;
			// Belt-and-suspenders: if TMDb ignores `primary_release_date.lte` for some combo, never show future calendar dates in “Latest / newest”.
			if (
				sortBy === "primary_release_date.desc" &&
				!primaryReleaseDateGteFromQuery
			) {
				discoverRows = discoverRows.filter((m) => {
					const d = m.release_date?.trim();
					if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
					return d <= todayUtc;
				});
			}
			discoverRows = await filterMovieCatalogueResults(
				discoverRows,
				showAdultContent,
			);
			return {
				...data,
				results: discoverRows.map((m) => ({
					...m,
					poster_url: tmdbImg.poster(m.poster_path),
					backdrop_url: tmdbImg.backdrop(m.backdrop_path),
				})),
				applied: {
					genre: withGenres ?? null,
					company: withCompanies ?? null,
					sort: sortBy,
					venue:
						venueRaw === "theaters" || venueRaw === "streaming"
							? venueRaw
							: null,
					monetization: withWatchMonetizationTypes ?? null,
					watch_region:
						withWatchMonetizationTypes !== undefined
							? watchRegionAll
								? "ALL"
								: (watchRegion ?? null)
							: null,
					region: discoveryRegion ?? null,
					primary_release_date_lte: primaryReleaseDateLte ?? null,
					release_gte: primaryReleaseDateGteFromQuery ?? null,
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
				/** Comma-separated TMDb keyword ids (AND). */
				keywords: t.Optional(t.String()),
				/** TMDb production company id (`with_companies`), e.g. A24 = 41077. */
				company: t.Optional(t.String()),
				sort: t.Optional(t.String()),
				venue: t.Optional(t.String()),
				monetization: t.Optional(t.String()),
				watch_region: t.Optional(t.String()),
				region: t.Optional(t.String()),
				release_gte: t.Optional(t.String()),
			}),
		},
	)
	// Movie detail. We check the local cache first; if stale or missing,
	// fetch from TMDb and upsert.
	.get(
		"/:id",
		async ({ params, status, user }) => {
			const id = Number(params.id);
			if (!Number.isFinite(id)) return status(400, "Invalid id");

			const language = await getTmdbLanguageForUser(user?.id);

			const [existing] = await db
				.select()
				.from(movie)
				.where(eq(movie.tmdbId, id))
				.limit(1);
			const staleByTime =
				!existing || Date.now() - existing.lastSyncedAt.getTime() > STALE_MS;
			const staleByShape = tmdbJsonNeedsEnrichment(existing?.tmdbJson);
			const isStale = staleByTime || staleByShape;

			let detail: TmdbMovieDetail | undefined;
			if (isStale) {
				try {
					detail = await tmdbApi.movieDetail(id);
					await cacheDetail(detail);
				} catch (err) {
					console.error("[movies] tmdb detail failed; serving cached", err);
					if (!existing) return status(404, "Movie not found");
				}
			}

			const [row] = await db
				.select()
				.from(movie)
				.where(eq(movie.tmdbId, id))
				.limit(1);
			if (!row) return status(404, "Movie not found");

			const showAdultContent = await getShowAdultContentForUser(user?.id);
			if (shouldBlockAdultDetail(showAdultContent, isMovieAdult(row))) {
				return buildAdultBlockedMoviePayload(id, row.title);
			}

			// Locale-specific artwork + copy (title, tagline, overview) from the patron’s catalogue language.
			let posterPathForUrl = row.posterPath;
			let backdropPathForUrl = row.backdropPath;
			let title = row.title;
			let tagline = row.tagline;
			let overview = row.overview;
			const cachedImages = (
				row.tmdbJson as {
					images?: { posters?: unknown[]; backdrops?: unknown[] };
				}
			)?.images;
			// Dedicated `/images` returns the full backdrop set (append + locale can filter).
			const imagesForRailPromise = tmdbApi.movieImages(id).catch(() => null);
			let imagesSourceForHero = normalizeTmdbImagesBundle(
				detail?.images ?? cachedImages,
			);
			if (language !== "en-US") {
				try {
					const localized = await tmdbApi.movieDetail(id, { language });
					posterPathForUrl = localized.poster_path ?? row.posterPath;
					backdropPathForUrl = localized.backdrop_path ?? row.backdropPath;
					const copy = localizedMovieCopy(localized, row);
					title = copy.title;
					tagline = copy.tagline;
					overview = copy.overview;
					if (localized.images) {
						imagesSourceForHero = normalizeTmdbImagesBundle({
							posters: localized.images.posters,
							backdrops:
								normalizeTmdbImagesBundle(detail?.images ?? cachedImages)
									?.backdrops ?? localized.images.backdrops,
						});
					}
				} catch (err) {
					console.warn("[movies] localized detail failed; using cache", err);
				}
			}

			const [community, imagesFromDedicated] = await Promise.all([
				fetchPublicDiaryCommunityStats({ movieId: id }),
				imagesForRailPromise,
			]);
			const fullImagesBundle = normalizeTmdbImagesBundle(
				imagesFromDedicated ?? detail?.images ?? cachedImages,
			);

			return {
				...row,
				title,
				tagline,
				overview,
				poster_url: tmdbImg.poster(posterPathForUrl),
				backdrop_url: tmdbImg.backdrop(backdropPathForUrl, "original"),
				hero_artwork: buildHeroArtworkSlides({
					title,
					posterPath: posterPathForUrl,
					backdropPath: backdropPathForUrl,
					images: imagesSourceForHero,
				}),
				screenshots: buildScreenshotSlides({
					title,
					backdropPath: backdropPathForUrl,
					images: fullImagesBundle,
				}),
				community,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	/** TMDb backdrops for review composer + reader still picker (capped rail). */
	.get(
		"/:id/review-stills",
		async ({ params, status }) => {
			const id = Number(params.id);
			if (!Number.isFinite(id)) return status(400, "Invalid id");
			const screenshots = await fetchReviewMovieScreenshots(id);
			return { screenshots };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id/reviews",
		async ({ params, user: currentUser }) => {
			const id = Number(params.id);
			const rows = await db
				.select({
					review,
					handle: profile.handle,
					displayName: profile.displayName,
					image: user.image,
				})
				.from(review)
				.leftJoin(profile, eq(review.userId, profile.userId))
				.leftJoin(user, eq(review.userId, user.id))
				.where(
					and(
						eq(review.movieId, id),
						isNull(review.removedAt),
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
					),
				)
				.orderBy(desc(review.likesCount), desc(review.publishedAt))
				.limit(20);
			return rows.map(({ review: row, handle, displayName, image }) => ({
				...row,
				author:
					handle && displayName
						? {
								handle,
								displayName,
								image: image ?? null,
							}
						: null,
			}));
		},
		{ params: t.Object({ id: t.String() }) },
	)
	/** Public lists that include this title — powers the film page “Lists” tab. */
	.get(
		"/:id/lists",
		async ({ params }) => {
			const movieId = Number(params.id);
			if (!Number.isFinite(movieId)) return [];
			const rows = await db
				.select({ list, ownerHandle: profile.handle })
				.from(listItem)
				.innerJoin(list, eq(listItem.listId, list.id))
				.innerJoin(profile, eq(list.userId, profile.userId))
				.where(
					and(
						eq(listItem.movieId, movieId),
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
	/** Latest rated/favorited diary rows from patrons the viewer follows (film detail community). */
	.get(
		"/:id/following-ratings",
		async ({ params, user }) => {
			const movieId = Number(params.id);
			if (!Number.isFinite(movieId)) return { entries: [], moreCount: 0 };
			if (!user) return { entries: [], moreCount: 0 };
			return fetchFollowingRatingsForMovie(user.id, movieId);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	// Bulk fetch — used by profile favorites, list covers, etc. Pulls only
	// what we have locally; if a movie isn't cached, the caller can fall
	// back to /movies/:id which fetches on demand.
	.post(
		"/batch",
		async ({ body: rawBody }) => {
			const body = routeBody<{ ids: number[] }>(rawBody);
			if (!body.ids.length) return [];
			const rows = await db
				.select({
					tmdbId: movie.tmdbId,
					title: movie.title,
					posterPath: movie.posterPath,
					year: movie.year,
				})
				.from(movie)
				.where(inArray(movie.tmdbId, body.ids));
			return rows;
		},
		{ body: t.Object({ ids: t.Array(t.Number()) }) },
	);
