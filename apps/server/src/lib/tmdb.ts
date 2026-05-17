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
};

/** Internal fetch wrapper with timeout, error formatting, and language defaults. */
async function tmdb<T>(
	path: string,
	params: Record<string, string | number | undefined> = {},
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
	url.searchParams.set("language", "en-US");

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
	return (await res.json()) as T;
}

export const tmdbApi = {
	searchMovies(query: string, page = 1) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>("/search/movie", {
			query,
			page,
			include_adult: "false",
		});
	},
	movieDetail(id: number) {
		// `keywords` surfaces user-facing tags (often festivals, movements); keep append list in sync with movie UI.
		return tmdb<TmdbMovieDetail>(`/movie/${id}`, {
			append_to_response:
				"credits,similar,recommendations,videos,watch/providers,release_dates,keywords",
		});
	},
	popular(page = 1) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>("/movie/popular", { page });
	},
	upcoming(page = 1) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>("/movie/upcoming", { page });
	},
	nowPlaying(page = 1) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>("/movie/now_playing", { page });
	},
	trending(window: "day" | "week" = "day", page = 1) {
		return tmdb<TmdbPaged<TmdbMovieSummary>>(`/trending/movie/${window}`, {
			page,
		});
	},
	/**
	 * TMDb `/discover/movie` — filterable catalogue (genre + sort). `vote_count.gte`
	 * avoids “top rated” surfacing 1-vote 10★ noise.
	 */
	discoverMovies(
		page = 1,
		opts: { withGenres?: number; sortBy?: string } = {},
	) {
		const sortBy = opts.sortBy ?? "popularity.desc";
		const params: Record<string, string | number | undefined> = {
			page,
			sort_by: sortBy,
			include_adult: "false",
			include_video: "false",
		};
		if (opts.withGenres !== undefined && Number.isFinite(opts.withGenres)) {
			params.with_genres = String(opts.withGenres);
		}
		if (sortBy === "vote_average.desc" || sortBy === "vote_average.asc") {
			params["vote_count.gte"] = 200;
		}
		return tmdb<TmdbPaged<TmdbMovieSummary>>("/discover/movie", params);
	},
	/** Static-ish list of official TMDb movie genre ids — powers browse chips. */
	genreMovieList() {
		return tmdb<{ genres: { id: number; name: string }[] }>(
			"/genre/movie/list",
			{},
		);
	},
	popularTv(page = 1) {
		return tmdb<TmdbPaged<TmdbTvSummary>>("/tv/popular", { page });
	},
	/**
	 * TMDb `/discover/tv` — same contract as `discoverMovies` but `first_air_date.*` replaces
	 * `primary_release_date.*` for “what’s new on air” sorts.
	 */
	discoverTv(page = 1, opts: { withGenres?: number; sortBy?: string } = {}) {
		const sortBy = opts.sortBy ?? "popularity.desc";
		const params: Record<string, string | number | undefined> = {
			page,
			sort_by: sortBy,
			include_adult: "false",
		};
		if (opts.withGenres !== undefined && Number.isFinite(opts.withGenres)) {
			params.with_genres = String(opts.withGenres);
		}
		if (sortBy === "vote_average.desc" || sortBy === "vote_average.asc") {
			params["vote_count.gte"] = 200;
		}
		return tmdb<TmdbPaged<TmdbTvSummary>>("/discover/tv", params);
	},
	person(id: number) {
		return tmdb<TmdbPersonDetail>(`/person/${id}`, {
			append_to_response: "movie_credits",
		});
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
