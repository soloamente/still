import { env } from "@still/env/server";

/**
 * Tiny typed wrapper around TMDb v3. We deliberately don't generate the
 * full openapi: TMDb's responses are huge and most endpoints we touch are
 * a handful of fields. Anything we miss is still available in `tmdbJson`
 * on the cached `movie` row.
 *
 * If `TMDB_API_KEY` is unset (dev environments without keys), every call
 * returns an empty/null shape so the rest of the app keeps rendering.
 */
const TMDB_BASE = "https://api.themoviedb.org/3";

export type TmdbMovieSummary = {
	id: number;
	title: string;
	original_title?: string;
	release_date?: string;
	poster_path: string | null;
	backdrop_path: string | null;
	overview: string;
	popularity?: number;
	vote_average?: number;
	vote_count?: number;
	genre_ids?: number[];
	original_language?: string;
	adult?: boolean;
};

/** TMDb TV list rows — `name` is the human-facing title (we map to `title` in API responses for the web grid). */
export type TmdbTvSummary = {
	id: number;
	name: string;
	original_name?: string;
	first_air_date?: string;
	poster_path: string | null;
	backdrop_path: string | null;
	overview: string;
	popularity?: number;
	vote_average?: number;
	vote_count?: number;
	genre_ids?: number[];
	original_language?: string;
	adult?: boolean;
};

/** TMDb `/search/person` row — `known_for` mixes movie (`title`) and TV (`name`) entries. */
export type TmdbPersonSummary = {
	id: number;
	name: string;
	profile_path: string | null;
	known_for_department?: string;
	popularity?: number;
	known_for?: Array<{
		id?: number;
		title?: string;
		name?: string;
		media_type?: "movie" | "tv";
	}>;
};

export type TmdbMovieDetail = TmdbMovieSummary & {
	imdb_id?: string;
	tagline?: string;
	runtime?: number;
	status?: string;
	spoken_languages?: { iso_639_1: string; english_name: string }[];
	genres?: { id: number; name: string }[];
	credits?: {
		cast: TmdbCredit[];
		crew: TmdbCredit[];
	};
	similar?: { results: TmdbMovieSummary[] };
	recommendations?: { results: TmdbMovieSummary[] };
	videos?: { results: TmdbVideo[] };
	"watch/providers"?: {
		results: Record<
			string,
			{
				link: string;
				flatrate?: TmdbProvider[];
				rent?: TmdbProvider[];
				buy?: TmdbProvider[];
			}
		>;
	};
	release_dates?: {
		results: {
			iso_3166_1: string;
			release_dates: {
				certification: string;
				iso_639_1?: string;
				note?: string;
				release_date: string;
				type: number;
			}[];
		}[];
	};
	/** Appended via `append_to_response=keywords` — useful for festival / award-flavored tags. */
	keywords?: {
		keywords: { id: number; name: string }[];
	};
	/** Appended via `append_to_response=images` — extra posters/backdrops for hero carousel. */
	images?: {
		backdrops: TmdbImageAsset[];
		posters: TmdbImageAsset[];
	};
};

export type TmdbImageAsset = {
	file_path: string;
	vote_average?: number;
	vote_count?: number;
	width?: number;
	height?: number;
	aspect_ratio?: number;
};

/** Full TV series payload from `/tv/{id}` + append_to_response (subset typed for our UI). */
export type TmdbSeasonSummary = {
	id: number;
	name: string;
	overview?: string;
	poster_path: string | null;
	season_number: number;
	episode_count: number;
	air_date?: string | null;
};

export type TmdbEpisodeSummary = {
	id: number;
	name: string;
	overview?: string;
	episode_number: number;
	season_number: number;
	air_date?: string | null;
	still_path: string | null;
	runtime?: number | null;
};

export type TmdbSeasonDetail = TmdbSeasonSummary & {
	episodes: TmdbEpisodeSummary[];
};

export type TmdbTvDetail = TmdbTvSummary & {
	tagline?: string;
	status?: string;
	last_air_date?: string | null;
	number_of_seasons?: number;
	number_of_episodes?: number;
	episode_run_time?: number[];
	genres?: { id: number; name: string }[];
	credits?: { cast: TmdbCredit[]; crew: TmdbCredit[] };
	similar?: { results: TmdbTvSummary[] };
	recommendations?: { results: TmdbTvSummary[] };
	videos?: { results: TmdbVideo[] };
	"watch/providers"?: TmdbMovieDetail["watch/providers"];
	/** TV keywords append returns `results` (movies use nested `keywords`). */
	keywords?: { results?: { id: number; name: string }[] };
	images?: {
		backdrops: TmdbImageAsset[];
		posters: TmdbImageAsset[];
	};
	/** Appended via `append_to_response=external_ids` — may include MAL when TMDb has it. */
	external_ids?: {
		imdb_id?: string | null;
		tvdb_id?: number | null;
		mal_id?: number | null;
	};
};

export type TmdbCredit = {
	id: number;
	credit_id: string;
	name: string;
	character?: string;
	department?: string;
	job?: string;
	order?: number;
	profile_path: string | null;
	known_for_department?: string;
	popularity?: number;
};

export type TmdbVideo = {
	id: string;
	key: string;
	site: string;
	type: string;
	name: string;
};

export type TmdbProvider = {
	provider_id: number;
	provider_name: string;
	logo_path: string;
};

export type TmdbPaged<T> = {
	page: number;
	total_pages: number;
	total_results: number;
	results: T[];
};

/** Combined `movie_credits` entries append role fields on top of the movie summary. */
export type TmdbPersonMovieCredit = TmdbMovieSummary & {
	character?: string;
	job?: string;
};

/** Combined `tv_credits` entries append role fields on top of the TV summary. */
export type TmdbPersonTvCredit = TmdbTvSummary & {
	character?: string;
	job?: string;
};

export type TmdbPersonDetail = {
	id: number;
	name: string;
	biography: string;
	birthday: string | null;
	deathday: string | null;
	profile_path: string | null;
	known_for_department?: string;
	popularity?: number;
	homepage?: string | null;
	movie_credits?: {
		cast: TmdbPersonMovieCredit[];
		crew: TmdbPersonMovieCredit[];
	};
	tv_credits?: {
		cast: TmdbPersonTvCredit[];
		crew: TmdbPersonTvCredit[];
	};
};

/** Optional TMDb v3 `language` — drives localized titles and regional poster picks. */
export type TmdbFetchOptions = {
	language?: string;
	/** When true, TMDb may return adult titles in search/discover list endpoints. */
	showAdultContent?: boolean;
	/** Optional primary release year filter for `/search/movie`. */
	year?: number | null;
};

function tmdbIncludeAdult(showAdult?: boolean): "true" | "false" {
	return showAdult === true ? "true" : "false";
}

/** Gunzip when Bun’s fetch leaves `content-encoding: gzip` bytes on the wire. */
function gunzipTmdbBody(bytes: Uint8Array): Uint8Array {
	// Prefer Bun’s gunzip — Node `zlib.gunzipSync` can fail on some TMDb payloads.
	// Cast: `ArrayBuffer` from `Response` is narrower than Bun’s `ArrayBufferLike` param.
	return new Uint8Array(Bun.gunzipSync(bytes as Uint8Array<ArrayBuffer>));
}

/** Decode a TMDb response body — Bun fetch may or may not transparently gunzip. */
function parseTmdbResponseBody<T>(res: Response, body: ArrayBuffer): T {
	const bytes = new Uint8Array(body);
	const looksGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
	const attempts: Uint8Array[] = [bytes];
	if (looksGzip || res.headers.get("content-encoding") === "gzip") {
		try {
			attempts.unshift(gunzipTmdbBody(bytes));
		} catch {
			// Body may already be plain JSON while the header still says gzip.
		}
	}
	for (const chunk of attempts) {
		try {
			return JSON.parse(new TextDecoder().decode(chunk)) as T;
		} catch {
			// try next decoding strategy
		}
	}
	throw new Error(
		`TMDb response was not JSON (${res.url}, ${bytes.length} bytes)`,
	);
}

/** Internal fetch wrapper with timeout, error formatting, and language defaults. */
async function tmdb<T>(
	path: string,
	params: Record<string, string | number | undefined> = {},
	fetchOpts: TmdbFetchOptions = {},
) {
	if (!env.TMDB_API_KEY) {
		// Dev fallback — return an empty paged shape so callers can keep going.
		return {
			page: 1,
			total_pages: 0,
			total_results: 0,
			results: [],
		} as unknown as T;
	}
	const url = new URL(`${TMDB_BASE}${path}`);
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined) url.searchParams.set(k, String(v));
	}
	// TMDb `language` is a locale tag (e.g. `de-DE`); callers pass the patron’s catalogue locale.
	const lang = fetchOpts.language?.trim();
	url.searchParams.set("language", lang && lang.length > 0 ? lang : "en-US");

	// TMDb supports either Bearer (v4 token, starts with eyJ...) or api_key query (v3 key).
	const isBearer = env.TMDB_API_KEY.startsWith("eyJ");
	if (!isBearer) {
		url.searchParams.set("api_key", env.TMDB_API_KEY);
	}

	const res = await fetch(url, {
		headers: isBearer
			? {
					Authorization: `Bearer ${env.TMDB_API_KEY}`,
					Accept: "application/json",
				}
			: { Accept: "application/json" },
		signal: AbortSignal.timeout(8000),
	});
	if (!res.ok) {
		throw new Error(`TMDb ${res.status} on ${path}: ${await res.text()}`);
	}
	const body = await res.arrayBuffer();
	return parseTmdbResponseBody<T>(res, body);
}

export const tmdbApi = {
	searchMovies(query: string, page = 1, fetchOpts: TmdbFetchOptions = {}) {
		const { year, ...rest } = fetchOpts;
		return tmdb<TmdbPaged<TmdbMovieSummary>>(
			"/search/movie",
			{
				query,
				page,
				include_adult: tmdbIncludeAdult(rest.showAdultContent),
				...(year != null ? { year } : {}),
			},
			rest,
		);
	},
	/** TMDb `/search/tv` — list rows use `name`; callers map to `title` for shared grid components. */
	searchTv(query: string, page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbTvSummary>>(
			"/search/tv",
			{
				query,
				page,
				include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent),
			},
			fetchOpts,
		);
	},
	/** TMDb `/search/person` — rows carry `known_for` (notable titles) and `known_for_department`. */
	searchPerson(query: string, page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbPersonSummary>>(
			"/search/person",
			{
				query,
				page,
				include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent),
			},
			fetchOpts,
		);
	},
	movieDetail(id: number, fetchOpts: TmdbFetchOptions = {}) {
		// `keywords` surfaces user-facing tags (often festivals, movements); keep append list in sync with movie UI.
		// `include_image_language` keeps language-less backdrops (most stills) when patron locale filters images.
		return tmdb<TmdbMovieDetail>(
			`/movie/${id}`,
			{
				append_to_response:
					"credits,similar,recommendations,videos,watch/providers,release_dates,keywords,images",
				include_image_language: "null,en",
			},
			fetchOpts,
		);
	},
	/** Lightweight company check — `/search/movie` rows omit `production_company_ids`. */
	movieProductionCompanies(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<{ production_companies?: { id: number }[] }>(
			`/movie/${id}`,
			{},
			fetchOpts,
		);
	},
	/** Company membership for TV search filtering (search rows omit company ids). */
	tvProductionCompanies(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<{ production_companies?: { id: number }[] }>(
			`/tv/${id}`,
			{},
			fetchOpts,
		);
	},
	/** TMDb `/tv/{id}` — append bundle mirrors film detail for shared show-page chrome. */
	tvDetail(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbTvDetail>(
			`/tv/${id}`,
			{
				append_to_response:
					"credits,similar,recommendations,videos,watch/providers,keywords,images,external_ids",
				include_image_language: "null,en",
			},
			fetchOpts,
		);
	},
	/** Full TMDb image bundle — used when cached detail lacks backdrops (legacy rows). */
	movieImages(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbMovieDetail["images"]>(
			`/movie/${id}/images`,
			{ include_image_language: "null,en" },
			fetchOpts,
		);
	},
	tvImages(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbTvDetail["images"]>(
			`/tv/${id}/images`,
			{ include_image_language: "null,en" },
			fetchOpts,
		);
	},
	/** Season list embedded on the TV detail payload — powers progress pickers. */
	tvSeasons(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<{ seasons: TmdbSeasonSummary[] }>(`/tv/${id}`, {}, fetchOpts);
	},
	/** Full episode list for one season — checklist UI + next-episode math. */
	tvSeasonDetail(
		id: number,
		seasonNumber: number,
		fetchOpts: TmdbFetchOptions = {},
	) {
		return tmdb<TmdbSeasonDetail>(
			`/tv/${id}/season/${seasonNumber}`,
			{},
			fetchOpts,
		);
	},
	popular(page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>(
			"/movie/popular",
			{ page, include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent) },
			fetchOpts,
		);
	},
	upcoming(page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>(
			"/movie/upcoming",
			{ page, include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent) },
			fetchOpts,
		);
	},
	nowPlaying(page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>(
			"/movie/now_playing",
			{ page, include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent) },
			fetchOpts,
		);
	},
	trending(
		window: "day" | "week" = "day",
		page = 1,
		fetchOpts: TmdbFetchOptions = {},
	) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>(
			`/trending/movie/${window}`,
			{
				page,
				include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent),
			},
			fetchOpts,
		);
	},
	/**
	 * TMDb `/discover/movie` — filterable catalogue (genre + sort). `vote_count.gte`
	 * avoids “top rated” surfacing 1-vote 10★ noise.
	 */
	discoverMovies(
		page = 1,
		opts: {
			withGenres?: number | number[];
			/** TMDb `with_keywords` — comma-joined AND when array. */
			withKeywords?: number | number[];
			/** TMDb `with_companies` — production company id (e.g. A24 = 41077). */
			withCompanies?: number;
			sortBy?: string;
			/** TMDb `with_release_type` — e.g. `2|3` theatrical, `4` digital. */
			withReleaseTypes?: string;
			/** TMDb `region` (ISO 3166-1) — scopes `primary_release_date.*` filters to that territory. */
			region?: string;
			/** TMDb `primary_release_date.lte` — YYYY-MM-DD (e.g. cap “newest” to already-released). */
			primaryReleaseDateLte?: string;
			/** TMDb `primary_release_date.gte` — YYYY-MM-DD (e.g. streaming titles with a future window). */
			primaryReleaseDateGte?: string;
			/** TMDb `watch_region` — pairs with `with_watch_monetization_types`. */
			watchRegion?: string;
			/** TMDb `with_watch_monetization_types` — e.g. `flatrate` for subscription streaming. */
			withWatchMonetizationTypes?: string;
			/** TMDb `language` — regional poster/title for the patron’s catalogue locale. */
			language?: string;
			/** TMDb `with_text_query` — AND with other discover filters. */
			withTextQuery?: string;
			showAdultContent?: boolean;
		} = {},
	) {
		const sortBy = opts.sortBy ?? "popularity.desc";
		const params: Record<string, string | number | undefined> = {
			page,
			sort_by: sortBy,
			include_adult: tmdbIncludeAdult(opts.showAdultContent),
			include_video: "false",
		};
		if (Array.isArray(opts.withGenres) && opts.withGenres.length > 0) {
			params.with_genres = opts.withGenres
				.map((id) => String(Math.floor(id)))
				.join(",");
		} else if (
			typeof opts.withGenres === "number" &&
			Number.isFinite(opts.withGenres)
		) {
			params.with_genres = String(Math.floor(opts.withGenres));
		}
		if (Array.isArray(opts.withKeywords) && opts.withKeywords.length > 0) {
			params.with_keywords = opts.withKeywords
				.map((id) => String(Math.floor(id)))
				.join(",");
		} else if (
			typeof opts.withKeywords === "number" &&
			Number.isFinite(opts.withKeywords)
		) {
			params.with_keywords = String(Math.floor(opts.withKeywords));
		}
		if (
			opts.withCompanies !== undefined &&
			Number.isFinite(opts.withCompanies)
		) {
			params.with_companies = String(Math.floor(opts.withCompanies));
		}
		const reg = opts.region?.trim().toUpperCase();
		if (reg && /^[A-Z]{2}$/.test(reg)) {
			params.region = reg;
		}
		const prLte = opts.primaryReleaseDateLte?.trim();
		if (prLte && /^\d{4}-\d{2}-\d{2}$/.test(prLte)) {
			params["primary_release_date.lte"] = prLte;
		}
		const prGte = opts.primaryReleaseDateGte?.trim();
		if (prGte && /^\d{4}-\d{2}-\d{2}$/.test(prGte)) {
			params["primary_release_date.gte"] = prGte;
		}
		const wr = opts.watchRegion?.trim().toUpperCase();
		if (wr && /^[A-Z]{2}$/.test(wr)) {
			params.watch_region = wr;
		}
		const wm = opts.withWatchMonetizationTypes?.trim();
		if (wm) {
			params.with_watch_monetization_types = wm;
		}
		const rt = opts.withReleaseTypes?.trim();
		if (rt) {
			params.with_release_type = rt;
		}
		if (sortBy === "vote_average.desc" || sortBy === "vote_average.asc") {
			params["vote_count.gte"] = 200;
		}
		const textQ = opts.withTextQuery?.trim();
		if (textQ) {
			params.with_text_query = textQ;
		}
		return tmdb<TmdbPaged<TmdbMovieSummary>>("/discover/movie", params, {
			language: opts.language,
		});
	},
	/** Static-ish list of official TMDb movie genre ids — powers browse chips. */
	genreMovieList(fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<{ genres: { id: number; name: string }[] }>(
			"/genre/movie/list",
			{},
			fetchOpts,
		);
	},
	genreTvList(fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<{ genres: { id: number; name: string }[] }>(
			"/genre/tv/list",
			{},
			fetchOpts,
		);
	},
	popularTv(page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbTvSummary>>(
			"/tv/popular",
			{ page, include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent) },
			fetchOpts,
		);
	},
	/** TMDb `/tv/on_the_air` — series with episodes airing in the current window. */
	onTheAirTv(page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbTvSummary>>(
			"/tv/on_the_air",
			{ page, include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent) },
			fetchOpts,
		);
	},
	/**
	 * TMDb `/discover/tv` — same contract as `discoverMovies` but `first_air_date.*` replaces
	 * `primary_release_date.*` for “what’s new on air” sorts.
	 */
	discoverTv(
		page = 1,
		opts: {
			withGenres?: number | number[];
			withKeywords?: number | number[];
			withCompanies?: number;
			sortBy?: string;
			/** TMDb `first_air_date.gte` — e.g. lobby “TV upcoming” from today onward. */
			firstAirDateGte?: string;
			/** TMDb `first_air_date.lte` — cap “latest aired” to dates ≤ this day (UTC). */
			firstAirDateLte?: string;
			/** Pairs with `with_watch_monetization_types` on `/discover/tv`. */
			watchRegion?: string;
			withWatchMonetizationTypes?: string;
			/** TMDb `language` — regional show poster for the patron’s locale. */
			language?: string;
			/** TMDb `with_status` — e.g. `3` ended, `0` returning. */
			withStatus?: number | number[];
			/** TMDb `with_text_query` — AND with other discover filters. */
			withTextQuery?: string;
			showAdultContent?: boolean;
		} = {},
	) {
		const sortBy = opts.sortBy ?? "popularity.desc";
		const params: Record<string, string | number | undefined> = {
			page,
			sort_by: sortBy,
			include_adult: tmdbIncludeAdult(opts.showAdultContent),
		};
		if (Array.isArray(opts.withGenres) && opts.withGenres.length > 0) {
			params.with_genres = opts.withGenres
				.map((id) => String(Math.floor(id)))
				.join(",");
		} else if (
			typeof opts.withGenres === "number" &&
			Number.isFinite(opts.withGenres)
		) {
			params.with_genres = String(Math.floor(opts.withGenres));
		}
		if (Array.isArray(opts.withKeywords) && opts.withKeywords.length > 0) {
			params.with_keywords = opts.withKeywords
				.map((id) => String(Math.floor(id)))
				.join(",");
		} else if (
			typeof opts.withKeywords === "number" &&
			Number.isFinite(opts.withKeywords)
		) {
			params.with_keywords = String(Math.floor(opts.withKeywords));
		}
		if (
			opts.withCompanies !== undefined &&
			Number.isFinite(opts.withCompanies)
		) {
			params.with_companies = String(Math.floor(opts.withCompanies));
		}
		const faGte = opts.firstAirDateGte?.trim();
		if (faGte && /^\d{4}-\d{2}-\d{2}$/.test(faGte)) {
			params["first_air_date.gte"] = faGte;
		}
		const faLte = opts.firstAirDateLte?.trim();
		if (faLte && /^\d{4}-\d{2}-\d{2}$/.test(faLte)) {
			params["first_air_date.lte"] = faLte;
		}
		const wr = opts.watchRegion?.trim().toUpperCase();
		if (wr && /^[A-Z]{2}$/.test(wr)) {
			params.watch_region = wr;
		}
		const wm = opts.withWatchMonetizationTypes?.trim();
		if (wm) {
			params.with_watch_monetization_types = wm;
		}
		if (Array.isArray(opts.withStatus) && opts.withStatus.length > 0) {
			params.with_status = opts.withStatus
				.map((id) => String(Math.floor(id)))
				.join(",");
		} else if (
			typeof opts.withStatus === "number" &&
			Number.isFinite(opts.withStatus)
		) {
			params.with_status = String(Math.floor(opts.withStatus));
		}
		if (sortBy === "vote_average.desc" || sortBy === "vote_average.asc") {
			params["vote_count.gte"] = 200;
		}
		const textQ = opts.withTextQuery?.trim();
		if (textQ) {
			params.with_text_query = textQ;
		}
		return tmdb<TmdbPaged<TmdbTvSummary>>("/discover/tv", params, {
			language: opts.language,
		});
	},
	person(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPersonDetail>(
			`/person/${id}`,
			{
				append_to_response: "movie_credits,tv_credits",
			},
			fetchOpts,
		);
	},
	/** Production company metadata — powers search-dialog studio logo rail. */
	company(id: number, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<{ id: number; name: string; logo_path: string | null }>(
			`/company/${id}`,
			{},
			fetchOpts,
		);
	},
};

/**
 * Image URL helpers. TMDb serves multiple sizes; we never bake size into
 * the DB so we can change the on-screen quality without re-syncing.
 */
const TMDB_IMG = "https://image.tmdb.org/t/p";

export const tmdbImg = {
	poster(
		path: string | null | undefined,
		size: "w185" | "w342" | "w500" | "w780" | "original" = "w500",
	) {
		return path ? `${TMDB_IMG}/${size}${path}` : null;
	},
	backdrop(
		path: string | null | undefined,
		size: "w780" | "w1280" | "original" = "w1280",
	) {
		return path ? `${TMDB_IMG}/${size}${path}` : null;
	},
	profile(
		path: string | null | undefined,
		size: "w185" | "h632" | "original" = "w185",
	) {
		return path ? `${TMDB_IMG}/${size}${path}` : null;
	},
	logo(path: string | null | undefined, size: "w92" | "w185" = "w92") {
		return path ? `${TMDB_IMG}/${size}${path}` : null;
	},
};
