import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import type { HomeVenue } from "@/lib/home-venue";
import type {
	MembersLeaderboardPayload,
	MembersLeaderboardSort,
} from "@/lib/members-leaderboard-types";
import { stillApiOrigin } from "@/lib/still-api-origin";
import { dispatchTasteTitleConsumed } from "@/lib/taste-title-consumed-events";
import type {
	TvEpisodeSummary,
	TvProgressMode,
	TvSeasonSummary,
	TvWatchBundle,
	TvWatchStatus,
} from "@/lib/tv-watch-types";
import {
	isWatchlistRowWithListing,
	type WatchlistLobbyRow,
	watchlistRowToPopularSeed,
} from "@/lib/watchlist-lobby-order";

/**
 * Hand-rolled GET helpers for URLs that Eden Treaty mishandles today:
 *
 * • **Query string**: runtime merges only `$query` (arg 1) or `query` (arg 2). A single-arg
 *   `{ query: { q } }` matches TypeScript but is dropped on the wire, so `/movies/search`
 *   always saw an empty `q` and returned no rows.
 *
 * • **AbortSignal on dynamic GET**: `{ fetch }` on arg 1 is not wired like `$fetch` — pass
 *   `signal` here so debounced lookups cancel correctly.
 */

/** Shared shape for hand-rolled catalogue GET helpers used from RSC. */
export type StillApiPagedGetResult = {
	data: unknown;
	error: { status: number; raw?: unknown; nonJson?: boolean } | null;
	response: Response;
};

/** True when `fetch` rejected because the caller aborted the in-flight request. */
export function isFetchAbortError(
	error: unknown,
	signal?: AbortSignal,
): boolean {
	if (signal?.aborted) return true;
	return (
		(error instanceof DOMException && error.name === "AbortError") ||
		(error instanceof Error && error.name === "AbortError")
	);
}

/** Avoid throwing when the API returns a plain-text 500 (e.g. Drizzle `Failed query: …`). */
async function readStillApiJsonBody(
	response: Response,
): Promise<unknown | null> {
	const text = await response.text();
	if (!text.trim()) return null;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

async function finishStillApiPagedGet(
	response: Response,
): Promise<StillApiPagedGetResult> {
	const raw = await readStillApiJsonBody(response);
	if (response.ok && raw != null) {
		return { data: raw, error: null, response };
	}
	return {
		data: null,
		error: {
			status: response.status,
			...(raw != null ? { raw } : { nonJson: true }),
		},
		response,
	};
}

export async function fetchMoviesSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal"> & {
		companyId?: number;
		page?: number;
		cookieHeader?: string;
	},
) {
	const url = new URL("/api/movies/search", stillApiOrigin());
	url.searchParams.set("q", qRaw.trim());
	const cid = init?.companyId;
	if (cid !== undefined && Number.isFinite(cid) && cid > 0) {
		url.searchParams.set("company", String(Math.floor(cid)));
	}
	// Server defaults to page 1; explicit page enables infinite scroll on committed search.
	const page = init?.page;
	if (page !== undefined && Number.isFinite(page) && page >= 1) {
		url.searchParams.set("page", String(Math.floor(page)));
	}
	const { cookieHeader, signal } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Public profile typeahead — `GET /api/profiles/search`. */
export async function fetchProfileSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal"> & { limit?: number },
) {
	const url = new URL("/api/profiles/search", stillApiOrigin());
	const q = qRaw.trim().replace(/^@+/, "").trim();
	url.searchParams.set("q", q);
	const limit = init?.limit;
	if (limit !== undefined && Number.isFinite(limit) && limit > 0) {
		url.searchParams.set("limit", String(Math.floor(limit)));
	}
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

export type FollowSuggestionRow = {
	user_id: string;
	name: string;
	image: string | null;
	handle: string | null;
	shared_follows: number;
};

/** Taste-overlap patron picks — `GET /api/taste/suggested-patrons` (SN.16). */
export async function fetchTasteSuggestedPatrons(
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL("/api/taste/suggested-patrons", stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** People followed by people you follow — empty-query search rail. */
export async function fetchFollowSuggestions(
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL("/api/follows/suggestions", stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Signed-in patron list search — `GET /api/lists/search`. */
export async function fetchListsSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal"> & { limit?: number },
) {
	const url = new URL("/api/lists/search", stillApiOrigin());
	const q = qRaw.trim();
	if (q) url.searchParams.set("q", q);
	const limit = init?.limit;
	if (limit !== undefined && Number.isFinite(limit) && limit > 0) {
		url.searchParams.set("limit", String(Math.floor(limit)));
	}
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** TMDb TV search proxy — same response shape as `fetchMoviesSearch` (`title` + `poster_url` on rows). */
export async function fetchTvSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal"> & {
		companyId?: number;
		page?: number;
		cookieHeader?: string;
	},
) {
	const url = new URL("/api/tv/search", stillApiOrigin());
	url.searchParams.set("q", qRaw.trim());
	const cid = init?.companyId;
	if (cid !== undefined && Number.isFinite(cid) && cid > 0) {
		url.searchParams.set("company", String(Math.floor(cid)));
	}
	const page = init?.page;
	if (page !== undefined && Number.isFinite(page) && page >= 1) {
		url.searchParams.set("page", String(Math.floor(page)));
	}
	const { cookieHeader, signal } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** TMDb person search proxy — rows are slim `PeopleSearchRow`s ({id,name,profileUrl,knownForDepartment,knownForTitles}). */
export async function fetchPeopleSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal"> & { page?: number; cookieHeader?: string },
) {
	const url = new URL("/api/people/search", stillApiOrigin());
	url.searchParams.set("q", qRaw.trim());
	const page = init?.page;
	if (page !== undefined && Number.isFinite(page) && page >= 1) {
		url.searchParams.set("page", String(Math.floor(page)));
	}
	const { cookieHeader, signal } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/**
 * TMDb `/movie/popular` — page is 1-based; newest/most-famous first per provider sort.
 * Optional `cookieHeader` forwards Better Auth cookies from an RSC (browser calls omit it).
 */
export async function fetchMoviesPopular(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/movies/popular", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** TMDb `/movie/now_playing` — same paging contract as `fetchMoviesPopular`. */
export async function fetchMoviesNowPlaying(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/movies/now-playing", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** Theatrical “opening soon” sheet — server uses TMDb discover (not `/movie/upcoming`) so past regional dates are excluded. */
export async function fetchMoviesUpcoming(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		/** Optional ISO 3166-1 alpha-2 — forwarded as `?region=` for TMDb theatrical primary-release scope. */
		region?: string;
	},
) {
	const url = new URL("/api/movies/upcoming", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const { cookieHeader, region, signal, cache } = init ?? {};
	const reg = region?.trim().toUpperCase();
	if (reg && reg.length === 2 && /^[A-Z]{2}$/.test(reg)) {
		url.searchParams.set("region", reg);
	}
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** TMDb `/discover/movie` — genre + sort; mirrors server `GET /api/movies/discover`. */
export async function fetchMoviesDiscover(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		genreId?: number;
		/** Comma-joined TMDb genre ids (AND) — server `?genre=`. */
		genreIds?: number[];
		/** Comma-joined TMDb keyword ids (AND) — server `?keywords=`. */
		keywordIds?: number[];
		/** TMDb production company id — server `?company=`. */
		companyId?: number;
		sortBy?: string;
		/** Matches server `GET /api/movies/discover?venue=` — theatrical vs digital window. */
		venue?: "theaters" | "streaming";
		/** Matches server `?monetization=` — e.g. `flatrate` for subscription streaming (uses `watch_region`). */
		monetization?: string;
		/** Optional ISO 3166-1 alpha-2 — forwarded when set (otherwise server uses `TMDB_WATCH_REGION` / US). */
		watchRegion?: string;
		/** TMDb `region` for theatrical release-date filters (optional; server defaults for “in cinemas” discover). */
		region?: string;
		/** Optional YYYY-MM-DD — server maps to TMDb `primary_release_date.gte`. */
		releaseGte?: string;
		/** TMDb discover `with_text_query` — server `?q=`. */
		q?: string;
	},
) {
	const url = new URL("/api/movies/discover", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const genreIds = init?.genreIds?.filter(
		(id) => Number.isFinite(id) && id > 0,
	);
	if (genreIds && genreIds.length > 0) {
		url.searchParams.set(
			"genre",
			genreIds.map((id) => String(Math.floor(id))).join(","),
		);
	} else {
		const gid = init?.genreId;
		if (gid !== undefined && Number.isFinite(gid) && gid > 0) {
			url.searchParams.set("genre", String(Math.floor(gid)));
		}
	}
	const keywordIds = init?.keywordIds?.filter(
		(id) => Number.isFinite(id) && id > 0,
	);
	if (keywordIds && keywordIds.length > 0) {
		url.searchParams.set(
			"keywords",
			keywordIds.map((id) => String(Math.floor(id))).join(","),
		);
	}
	const cid = init?.companyId;
	if (cid !== undefined && Number.isFinite(cid) && cid > 0) {
		url.searchParams.set("company", String(Math.floor(cid)));
	}
	const sort = init?.sortBy?.trim();
	if (sort) {
		url.searchParams.set("sort", sort);
	}
	if (init?.venue === "theaters" || init?.venue === "streaming") {
		url.searchParams.set("venue", init.venue);
	}
	const mon = init?.monetization?.trim().toLowerCase();
	if (mon) {
		url.searchParams.set("monetization", mon);
	}
	const wr = init?.watchRegion?.trim().toUpperCase();
	if (wr === "ALL" || wr === "ANY" || wr === "WORLD") {
		url.searchParams.set("watch_region", "ALL");
	} else if (wr && /^[A-Z]{2}$/.test(wr)) {
		url.searchParams.set("watch_region", wr);
	}
	const reg = init?.region?.trim().toUpperCase();
	if (reg && /^[A-Z]{2}$/.test(reg)) {
		url.searchParams.set("region", reg);
	}
	const rg = init?.releaseGte?.trim();
	if (rg && /^\d{4}-\d{2}-\d{2}$/.test(rg)) {
		url.searchParams.set("release_gte", rg);
	}
	const textQ = init?.q?.trim();
	if (textQ) {
		url.searchParams.set("q", textQ);
	}
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/**
 * TV **Ongoing** feed — `GET /api/tv/on-the-air` maps to discover **Returning Series**
 * (`with_status=0`), not TMDb’s broadcast `on_the_air` sheet (that overlapped Ended).
 */
export async function fetchTvOnTheAir(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		sortBy?: string;
	},
) {
	const url = new URL("/api/tv/on-the-air", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const sort = init?.sortBy?.trim();
	if (sort) {
		url.searchParams.set("sort", sort);
	}
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** TMDb `/tv/popular` — same paging contract as `fetchMoviesPopular`. */
export async function fetchTvPopular(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/tv/popular", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** TMDb `/discover/tv` — mirrors server `GET /api/tv/discover`. */
export async function fetchTvDiscover(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		genreId?: number;
		genreIds?: number[];
		keywordIds?: number[];
		companyId?: number;
		sortBy?: string;
		/** TMDb `first_air_date.gte` — forwarded as `air_date_gte` on the API. */
		airDateGte?: string;
		monetization?: string;
		watchRegion?: string;
		/** `ended` / `completed` for finished series; `returning` / `ongoing` for returning. */
		status?: string;
		/** TMDb discover `with_text_query` — server `?q=`. */
		q?: string;
	},
) {
	const url = new URL("/api/tv/discover", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const tvGenreIds = init?.genreIds?.filter(
		(id) => Number.isFinite(id) && id > 0,
	);
	if (tvGenreIds && tvGenreIds.length > 0) {
		url.searchParams.set(
			"genre",
			tvGenreIds.map((id) => String(Math.floor(id))).join(","),
		);
	} else {
		const gid = init?.genreId;
		if (gid !== undefined && Number.isFinite(gid) && gid > 0) {
			url.searchParams.set("genre", String(Math.floor(gid)));
		}
	}
	const tvKeywordIds = init?.keywordIds?.filter(
		(id) => Number.isFinite(id) && id > 0,
	);
	if (tvKeywordIds && tvKeywordIds.length > 0) {
		url.searchParams.set(
			"keywords",
			tvKeywordIds.map((id) => String(Math.floor(id))).join(","),
		);
	}
	const tvCompanyId = init?.companyId;
	if (
		tvCompanyId !== undefined &&
		Number.isFinite(tvCompanyId) &&
		tvCompanyId > 0
	) {
		url.searchParams.set("company", String(Math.floor(tvCompanyId)));
	}
	const sort = init?.sortBy?.trim();
	if (sort) {
		url.searchParams.set("sort", sort);
	}
	const ag = init?.airDateGte?.trim();
	if (ag && /^\d{4}-\d{2}-\d{2}$/.test(ag)) {
		url.searchParams.set("air_date_gte", ag);
	}
	const m = init?.monetization?.trim().toLowerCase();
	if (m) {
		url.searchParams.set("monetization", m);
	}
	const wr = init?.watchRegion?.trim().toUpperCase();
	if (wr === "ALL" || wr === "ANY" || wr === "WORLD") {
		url.searchParams.set("watch_region", "ALL");
	} else if (wr && /^[A-Z]{2}$/.test(wr)) {
		url.searchParams.set("watch_region", wr);
	}
	const st = init?.status?.trim().toLowerCase();
	if (st) {
		url.searchParams.set("status", st);
	}
	const textQ = init?.q?.trim();
	if (textQ) {
		url.searchParams.set("q", textQ);
	}
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** Official TMDb TV genre list — powers search dialog genre suggestions on TV. */
export async function fetchTvGenres(
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		/** TMDb `language` — search autocomplete uses `en-US` for stable Tab labels. */
		language?: string;
	},
) {
	const url = new URL("/api/tv/genres", stillApiOrigin());
	const lang = init?.language?.trim();
	if (lang) url.searchParams.set("language", lang);
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Official TMDb movie genre list — powers discover chips (same payload as TMDb `genre/movie/list`). */
export async function fetchMovieGenres(
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		language?: string;
	},
) {
	const url = new URL("/api/movies/genres", stillApiOrigin());
	const lang = init?.language?.trim();
	if (lang) url.searchParams.set("language", lang);
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Curated production companies — logos for search dialog and discover studio filter. */
export async function fetchMovieStudios(
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/movies/studios", stillApiOrigin());
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

export async function fetchBadgesRecent(sinceIso: string) {
	const url = new URL("/api/badges/me/recent", stillApiOrigin());
	url.searchParams.set("since", sinceIso);
	const response = await fetch(url, { credentials: "include" });
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
		response,
	};
}

/** Cheap unread-badge count — avoids downloading the full inbox on every poll. */
export async function fetchNotificationsUnreadCount(): Promise<number> {
	const url = new URL("/api/notifications/unread-count", stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
	});
	if (!response.ok) return 0;
	const data = (await response.json()) as { count?: number };
	return typeof data.count === "number" ? data.count : 0;
}

/** Completionist challenge catalog — `GET /api/challenges/catalog`. */
export async function fetchAchievementsChallengesCatalog(
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/challenges/catalog", stillApiOrigin());
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		cache: cache ?? "no-store",
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as { challenges?: unknown[] } | null;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Sign-up availability — `GET /api/profiles/check-handle/:handle` */
export async function fetchProfileHandleAvailable(
	handleParam: string,
	init?: Pick<RequestInit, "signal">,
) {
	const handle = handleParam.trim().toLowerCase();
	const url = new URL(
		`/api/profiles/check-handle/${encodeURIComponent(handle)}`,
		stillApiOrigin(),
	);
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as {
		available: boolean;
		reason: string;
	} | null;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
		response,
	};
}

/** Signed-in saved quotes lobby — Eden Treaty does not type `/api/me/*` yet. */
export async function fetchMySavedQuotes(
	opts: {
		page?: number;
		limit?: number;
		kind?: string;
		visibility?: string;
	},
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/me/quotes/saved", stillApiOrigin());
	if (opts.page != null) url.searchParams.set("page", String(opts.page));
	if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));
	if (opts.kind) url.searchParams.set("kind", opts.kind);
	if (opts.visibility) url.searchParams.set("visibility", opts.visibility);
	const { cookieHeader, signal, cache } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		cache: cache ?? "no-store",
		signal,
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	return finishStillApiPagedGet(response);
}

/** TMDb title wordmark path — used by the home taste hero when spotlight swaps. */
export async function fetchMovieTitleLogoPath(
	movieId: number,
	init?: Pick<RequestInit, "signal">,
): Promise<string | null> {
	const url = new URL(`/api/movies/${movieId}/title-logo`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	if (!response.ok) return null;
	const data = (await response.json()) as { logoPath?: string | null };
	return typeof data.logoPath === "string" && data.logoPath.length > 0
		? data.logoPath
		: null;
}

/** TMDb trailer key — hydrates the taste hero when for-you rows omit `videos`. */
export async function fetchMovieTrailer(
	movieId: number,
	init?: Pick<RequestInit, "signal">,
): Promise<{ trailerKey: string; trailerSite: string } | null> {
	const url = new URL(`/api/movies/${movieId}/trailer`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	if (!response.ok) return null;
	const data = (await response.json()) as {
		trailerKey?: string | null;
		trailerSite?: string | null;
	};
	if (typeof data.trailerKey !== "string" || data.trailerKey.length === 0) {
		return null;
	}
	return {
		trailerKey: data.trailerKey,
		trailerSite:
			typeof data.trailerSite === "string" && data.trailerSite.length > 0
				? data.trailerSite
				: "YouTube",
	};
}

/** Current-user diary rows for one TMDb title — canonical for “already logged?” on movie pages. */
export async function fetchMyLogsForMovie(
	movieId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(`/api/logs/me/by-movie/${movieId}`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
		response,
	};
}

/** Current-user diary rows for one TMDb TV title — mirrors `fetchMyLogsForMovie`. */
export async function fetchMyLogsForTv(
	tvId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(`/api/logs/me/by-tv/${tvId}`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
		response,
	};
}

export type FetchListsMeMedia =
	| { listingKind: "movie"; tmdbId: number }
	| { listingKind: "tv"; tmdbId: number };

/** Patron lists — optional media query adds `containsTitle` per row for add-to-list UI. */
export async function fetchListsMe(
	media?: FetchListsMeMedia,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL("/api/lists/me", stillApiOrigin());
	if (media?.listingKind === "movie" && Number.isFinite(media.tmdbId)) {
		url.searchParams.set("movieId", String(media.tmdbId));
	} else if (media?.listingKind === "tv" && Number.isFinite(media.tmdbId)) {
		url.searchParams.set("tvId", String(media.tmdbId));
	}
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Whether this film sits on the viewer’s watchlist. */
export async function fetchWatchlistCheck(
	movieId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(`/api/watchlist/check/${movieId}`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as { inWatchlist?: boolean };
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
		response,
	};
}

/** Watchlist membership for a series — TMDb TV ids are namespaced separately from films. */
export async function fetchWatchlistCheckTv(
	tvId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(`/api/watchlist/check/tv/${tvId}`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as { inWatchlist?: boolean };
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
		response,
	};
}

export async function deleteWatchlistItem(movieId: number) {
	const url = new URL(`/api/watchlist/${movieId}`, stillApiOrigin());
	const response = await fetch(url, {
		method: "DELETE",
		credentials: "include",
	});
	const data = (await response.json().catch(() => null)) as unknown;
	return {
		ok: response.ok,
		status: response.status,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function deleteWatchlistTvItem(tvId: number) {
	const url = new URL(`/api/watchlist/tv/${tvId}`, stillApiOrigin());
	const response = await fetch(url, {
		method: "DELETE",
		credentials: "include",
	});
	const data = (await response.json().catch(() => null)) as unknown;
	return {
		ok: response.ok,
		status: response.status,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function deleteLog(logId: string) {
	const url = new URL(
		`/api/logs/${encodeURIComponent(logId)}`,
		stillApiOrigin(),
	);
	const response = await fetch(url, {
		method: "DELETE",
		credentials: "include",
	});
	const data = (await response.json().catch(() => null)) as unknown;
	return {
		ok: response.ok,
		status: response.status,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/** Eden Treaty cannot parse plain-text error bodies — use fetch for person filmography. */
export async function fetchPersonFilmography(
	personId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(
		`/api/people/${encodeURIComponent(String(personId))}`,
		stillApiOrigin(),
	);
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = await parseJsonBlob(response);
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

async function parseJsonBlob(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

/** Create a diary log — prefers `fetch` so the JSON body ships reliably beside our GET helpers. */
export async function postLog(payload: {
	/** Exactly one of `movieId` or `tvId` must be sent — enforced server-side. */
	movieId?: number;
	tvId?: number;
	watchedAt?: string;
	liked?: boolean;
	rewatch?: boolean;
	rating?: number;
	note?: string;
	/** In-cinema vs at-home — server defaults to **streaming**. */
	watchVenue?: HomeVenue;
	logScope?: "show" | "season" | "episode";
	seasonNumber?: number;
	episodeNumber?: number;
	/** Omit to apply the account default. */
	visibility?: "public" | "followers" | "friends" | "private";
}) {
	const response = await fetch(new URL("/api/logs", stillApiOrigin()), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(payload),
	});
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/** Update an existing diary row (e.g. toggle heart / rating). */
export async function patchLog(
	logId: string,
	payload: Partial<{
		liked: boolean;
		/** `null` clears half-star score in the API (PATCH body must JSON-null). */
		rating: number | null;
		watchedAt: string;
		/** `null` clears the diary note. */
		note: string | null;
		containsSpoilers: boolean;
		rewatch: boolean;
		/** In-cinema vs at-home — matches `/diary?venue=`. */
		watchVenue?: HomeVenue;
		logScope?: "show" | "season" | "episode";
		seasonNumber?: number | null;
		episodeNumber?: number | null;
		visibility?: "public" | "followers" | "friends" | "private";
	}>,
) {
	const response = await fetch(
		new URL(`/api/logs/${encodeURIComponent(logId)}`, stillApiOrigin()),
		{
			method: "PATCH",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(payload),
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/** Add (or bump) watchlist membership. */
export async function postWatchlistAdd(
	payload: { movieId: number; note?: string } | { tvId: number; note?: string },
) {
	const response = await fetch(new URL("/api/watchlist", stillApiOrigin()), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(payload),
	});
	const data = await parseJsonBlob(response);
	if (
		response.ok &&
		"movieId" in payload &&
		typeof payload.movieId === "number"
	) {
		dispatchTasteTitleConsumed({ tmdbId: payload.movieId });
	}
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/**
 * Client load-more for the watchlist lobby — pages the personal list and maps
 * rows to poster seeds for `PopularMoviesInfinite`'s injected `loadPage`.
 */
export async function fetchMyWatchlist(
	page: number,
	opts: { order: string; signal?: AbortSignal },
): Promise<
	{ results: PopularMovieSeed[]; total_pages: number } | { error: true }
> {
	const url = new URL("/api/watchlist", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	url.searchParams.set("order", opts.order);
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as {
		results?: WatchlistLobbyRow[];
		total_pages?: number;
	} | null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	const results = raw.results
		.filter(isWatchlistRowWithListing)
		.map(watchlistRowToPopularSeed);
	return {
		results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
	};
}

/** One row from `GET /api/logs/me/diary`. */
export type DiaryMovieResultRow = {
	kind: "movie";
	log: {
		id: string;
		watchedAt: string;
		createdAt: string;
		rating: number | null;
		liked: boolean;
		rewatch: boolean;
		watchVenue: "theaters" | "streaming" | null;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null };
};

export type DiaryTvGroupResultRow = {
	kind: "tvGroup";
	tv: { tmdbId: number; title: string; posterPath: string | null };
	logCount: number;
	primaryScope: {
		logScope: "show" | "season" | "episode";
		seasonNumber: number | null;
		episodeNumber: number | null;
	};
	newestWatchedAt: string;
};

export type DiaryResultRow = DiaryMovieResultRow | DiaryTvGroupResultRow;

export type DiaryTabCounts = { movies: number; tv: number };

export type DiaryWatchPeriods = { years: number[]; decades: number[] };

export type FetchMyDiaryOpts = {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	/** Omit / null = all venues. */
	venue?: "theaters" | "streaming" | null;
	year?: number | null;
	decade?: number | null;
	signal?: AbortSignal;
};

/** Client load-more for the diary grid (DiaryLobbyInfinite `loadPage`). */
export async function fetchMyDiary(
	page: number,
	opts: FetchMyDiaryOpts,
): Promise<
	| {
			results: DiaryResultRow[];
			total_pages: number;
			tabCounts: DiaryTabCounts;
	  }
	| { error: true }
> {
	const url = new URL("/api/logs/me/diary", stillApiOrigin());
	url.searchParams.set("media", opts.media);
	url.searchParams.set("order", opts.order);
	if (opts.venue) url.searchParams.set("venue", opts.venue);
	if (opts.year != null) url.searchParams.set("year", String(opts.year));
	else if (opts.decade != null)
		url.searchParams.set("decade", String(opts.decade));
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as {
		results?: DiaryResultRow[];
		total_pages?: number;
		tabCounts?: DiaryTabCounts;
	} | null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	return {
		results: raw.results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
		tabCounts: raw.tabCounts ?? { movies: 0, tv: 0 },
	};
}

/**
 * Ranked list reorder mutation — body must include the **full** ordered set of
 * list item ids so the server can validate and persist canonical positions.
 */
/**
 * Remove one title from a custom list — blocked for system Favorites (diary-synced).
 */
export async function deleteListItem(
	listId: string,
	media:
		| { listingKind: "movie"; tmdbId: number }
		| { listingKind: "tv"; tmdbId: number },
) {
	const path =
		media.listingKind === "movie"
			? `/api/lists/${encodeURIComponent(listId)}/items/${media.tmdbId}`
			: `/api/lists/${encodeURIComponent(listId)}/items/tv/${media.tmdbId}`;
	const response = await fetch(new URL(path, stillApiOrigin()), {
		method: "DELETE",
		credentials: "include",
		headers: { Accept: "application/json" },
	});
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/** PATCH per-title curator note on a list (`SN.10` annotations). */
export async function patchListItemNote(
	listId: string,
	itemId: string,
	note: string,
) {
	const trimmed = note.trim();
	const response = await fetch(
		new URL(
			`/api/lists/${encodeURIComponent(listId)}/items/item/${encodeURIComponent(itemId)}`,
			stillApiOrigin(),
		),
		{
			method: "PATCH",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ note: trimmed.length > 0 ? trimmed : null }),
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function postListReorder(listId: string, itemIds: string[]) {
	const response = await fetch(
		new URL(
			`/api/lists/${encodeURIComponent(listId)}/reorder`,
			stillApiOrigin(),
		),
		{
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ itemIds }),
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/**
 * Marks one notification read (`POST /api/notifications/:id/read`).
 * Uses fetch (not Eden) so the dynamic path is reliable from the client.
 */
/** Active TV watches for continue-watching rail — `GET /api/tv-watch/me`. */
export async function fetchTvWatchMe(
	init?: Pick<RequestInit, "signal"> & { status?: string; limit?: number },
) {
	const url = new URL("/api/tv-watch/me", stillApiOrigin());
	if (init?.status) url.searchParams.set("status", init.status);
	if (init?.limit != null) {
		url.searchParams.set("limit", String(Math.floor(init.limit)));
	}
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? (data as TvWatchBundle[]) : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Progress + status for one show page — `GET /api/tv-watch/me/by-tv/:tvId`. */
export async function fetchTvWatchByTv(
	tvId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(`/api/tv-watch/me/by-tv/${tvId}`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

export async function postTvWatchStart(payload: {
	tvId: number;
	progressMode?: TvProgressMode;
}) {
	const response = await fetch(new URL("/api/tv-watch", stillApiOrigin()), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(payload),
	});
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function patchTvWatch(
	watchId: string,
	payload: Partial<{
		status: TvWatchStatus;
		progressMode: TvProgressMode;
		notifyNewEpisodes: boolean;
	}>,
) {
	const response = await fetch(
		new URL(`/api/tv-watch/${encodeURIComponent(watchId)}`, stillApiOrigin()),
		{
			method: "PATCH",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(payload),
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function postTvWatchMarkEpisode(
	watchId: string,
	seasonNumber: number,
	episodeNumber: number,
) {
	const response = await fetch(
		new URL(
			`/api/tv-watch/${encodeURIComponent(watchId)}/episodes`,
			stillApiOrigin(),
		),
		{
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ seasonNumber, episodeNumber }),
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function deleteTvWatchEpisode(
	watchId: string,
	seasonNumber: number,
	episodeNumber: number,
) {
	const response = await fetch(
		new URL(
			`/api/tv-watch/${encodeURIComponent(watchId)}/episodes`,
			stillApiOrigin(),
		),
		{
			method: "DELETE",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ seasonNumber, episodeNumber }),
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/** Mark every episode in a season watched — single request (fast season mode). */
export async function postTvWatchCompleteSeason(
	watchId: string,
	seasonNumber: number,
) {
	const response = await fetch(
		new URL(
			`/api/tv-watch/${encodeURIComponent(watchId)}/seasons/${seasonNumber}/complete`,
			stillApiOrigin(),
		),
		{
			method: "POST",
			credentials: "include",
			headers: { Accept: "application/json" },
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

export async function postTvWatchMarkNext(watchId: string) {
	const response = await fetch(
		new URL(
			`/api/tv-watch/${encodeURIComponent(watchId)}/mark-next`,
			stillApiOrigin(),
		),
		{
			method: "POST",
			credentials: "include",
			headers: { Accept: "application/json" },
		},
	);
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? (data as TvWatchBundle) : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

/** TMDb season list — `GET /api/tv/:id/seasons`. */
export async function fetchTvSeasons(
	tvId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(`/api/tv/${tvId}/seasons`, stillApiOrigin());
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as { seasons?: TvSeasonSummary[] };
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** Episodes for one season — `GET /api/tv/:id/season/:n`. */
export async function fetchTvSeasonDetail(
	tvId: number,
	seasonNumber: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(
		`/api/tv/${tvId}/season/${seasonNumber}`,
		stillApiOrigin(),
	);
	const response = await fetch(url, {
		credentials: "include",
		signal: init?.signal,
	});
	const data = (await response.json()) as {
		season?: { episodes?: TvEpisodeSummary[] };
	};
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

export async function postNotificationRead(id: string) {
	const url = new URL(
		`/api/notifications/${encodeURIComponent(id)}/read`,
		stillApiOrigin(),
	);
	const response = await fetch(url, {
		method: "POST",
		credentials: "include",
		headers: { Accept: "application/json" },
	});
	const data = await parseJsonBlob(response);
	return {
		ok: response.ok,
		status: response.status,
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
	};
}

type CommunityPeriodQuery = {
	period: HomeLeaderboardPeriod;
	tz: string;
};

function communityPeriodSearchParams({
	period,
	tz,
}: CommunityPeriodQuery): URLSearchParams {
	const params = new URLSearchParams();
	params.set("period", period);
	params.set("tz", tz);
	return params;
}

export const COMMUNITY_LISTS_LIMIT = 24;
export const COMMUNITY_REVIEWS_LIMIT = 20;
export const COMMUNITY_VIRAL_REVIEWS_LIMIT = 6;
export const COMMUNITY_ACTIVITY_LIMIT = 40;

export type CommunityListsPage = {
	items: unknown[];
	total: number;
};

function parseCommunityListsPayload(
	payload: unknown,
): CommunityListsPage | null {
	if (payload == null || typeof payload !== "object") return null;
	const record = payload as { items?: unknown; total?: unknown };
	if (!Array.isArray(record.items)) return null;
	const total =
		typeof record.total === "number" && Number.isFinite(record.total)
			? record.total
			: record.items.length;
	return { items: record.items, total };
}

/** Public lists lobby — respects community period window. */
export async function fetchCommunityLists(
	period: HomeLeaderboardPeriod,
	tz: string,
	opts?: { page?: number; signal?: AbortSignal },
): Promise<CommunityListsPage | null> {
	const url = new URL("/api/lists", stillApiOrigin());
	url.searchParams.set("limit", String(COMMUNITY_LISTS_LIMIT));
	if (opts?.page && opts.page > 1)
		url.searchParams.set("page", String(opts.page));
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return parseCommunityListsPayload(await response.json());
}

/** Recent public reviews — respects community period window. */
export async function fetchCommunityReviewsRecent(
	period: HomeLeaderboardPeriod,
	tz: string,
	opts?: { page?: number; signal?: AbortSignal },
): Promise<unknown[] | null> {
	const url = new URL("/api/reviews/recent", stillApiOrigin());
	url.searchParams.set("limit", String(COMMUNITY_REVIEWS_LIMIT));
	if (opts?.page && opts.page > 1)
		url.searchParams.set("page", String(opts.page));
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as unknown[];
}

/** Engagement-ranked wit-sized reviews for the Community viral rail. */
export async function fetchCommunityReviewsViral(
	period: HomeLeaderboardPeriod,
	tz: string,
	opts?: { limit?: number; signal?: AbortSignal },
): Promise<unknown[] | null> {
	const url = new URL("/api/reviews/viral", stillApiOrigin());
	url.searchParams.set(
		"limit",
		String(opts?.limit ?? COMMUNITY_VIRAL_REVIEWS_LIMIT),
	);
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as unknown[];
}

/** Following or discover activity — respects community period window. */
export async function fetchCommunityActivity(
	period: HomeLeaderboardPeriod,
	tz: string,
	signedIn: boolean,
	opts?: {
		before?: string | null;
		beforeKind?: string | null;
		beforeId?: string | null;
		signal?: AbortSignal;
	},
): Promise<{
	items: { kind: string; at: string | Date; payload: unknown }[];
} | null> {
	const path = signedIn ? "/api/feed" : "/api/feed/discover";
	const url = new URL(path, stillApiOrigin());
	if (signedIn) url.searchParams.set("limit", String(COMMUNITY_ACTIVITY_LIMIT));
	if (signedIn && opts?.before) {
		url.searchParams.set("before", opts.before);
		if (opts.beforeKind) url.searchParams.set("beforeKind", opts.beforeKind);
		if (opts.beforeId) url.searchParams.set("beforeId", opts.beforeId);
	}
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as {
		items: { kind: string; at: string | Date; payload: unknown }[];
	};
}

/** Community rank boards — client refetch with patron IANA `tz` after SSR (UTC). */
export async function fetchCommunityLeaderboard(
	kind: "films" | "tv",
	period: HomeLeaderboardPeriod,
	tz: string,
	init?: Pick<RequestInit, "signal">,
): Promise<LeaderboardPayload | null> {
	const url = new URL(`/api/leaderboard/${kind}`, stillApiOrigin());
	url.searchParams.set("period", period);
	url.searchParams.set("tz", tz);
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: init?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as LeaderboardPayload;
}

/** Members directory — client refetch with patron IANA `tz` and optional paging. */
export async function fetchMembersLeaderboard(
	sort: MembersLeaderboardSort,
	period: HomeLeaderboardPeriod,
	options?: {
		tz?: string;
		page?: number;
		limit?: number;
		signal?: AbortSignal;
	},
): Promise<MembersLeaderboardPayload | null> {
	const url = new URL("/api/members/leaderboard", stillApiOrigin());
	url.searchParams.set("sort", sort);
	url.searchParams.set("period", period);
	if (options?.tz) url.searchParams.set("tz", options.tz);
	if (options?.page != null) {
		url.searchParams.set("page", String(options.page));
	}
	if (options?.limit != null) {
		url.searchParams.set("limit", String(options.limit));
	}
	const response = await fetch(url, {
		credentials: "include",
		signal: options?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as MembersLeaderboardPayload;
}
