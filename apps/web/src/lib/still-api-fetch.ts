import { env } from "@still/env/web";

import type { HomeVenue } from "@/lib/home-venue";

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

export async function fetchMoviesSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL("/api/movies/search", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("q", qRaw.trim());
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
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL("/api/tv/search", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("q", qRaw.trim());
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

/**
 * TMDb `/movie/popular` — page is 1-based; newest/most-famous first per provider sort.
 * Optional `cookieHeader` forwards Better Auth cookies from an RSC (browser calls omit it).
 */
export async function fetchMoviesPopular(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/movies/popular", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
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

/** TMDb `/movie/now_playing` — same paging contract as `fetchMoviesPopular`. */
export async function fetchMoviesNowPlaying(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/movies/now-playing", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
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

/** Theatrical “opening soon” sheet — server uses TMDb discover (not `/movie/upcoming`) so past regional dates are excluded. */
export async function fetchMoviesUpcoming(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		/** Optional ISO 3166-1 alpha-2 — forwarded as `?region=` for TMDb theatrical primary-release scope. */
		region?: string;
	},
) {
	const url = new URL("/api/movies/upcoming", env.NEXT_PUBLIC_SERVER_URL);
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
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}

/** TMDb `/discover/movie` — genre + sort; mirrors server `GET /api/movies/discover`. */
export async function fetchMoviesDiscover(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		genreId?: number;
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
	},
) {
	const url = new URL("/api/movies/discover", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const gid = init?.genreId;
	if (gid !== undefined && Number.isFinite(gid) && gid > 0) {
		url.searchParams.set("genre", String(Math.floor(gid)));
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

/** TMDb `/tv/popular` — same paging contract as `fetchMoviesPopular`. */
export async function fetchTvPopular(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/tv/popular", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
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

/** TMDb `/discover/tv` — mirrors server `GET /api/tv/discover`. */
export async function fetchTvDiscover(
	page: number,
	init?: Pick<RequestInit, "signal" | "cache"> & {
		cookieHeader?: string;
		genreId?: number;
		sortBy?: string;
		/** TMDb `first_air_date.gte` — forwarded as `air_date_gte` on the API. */
		airDateGte?: string;
		monetization?: string;
		watchRegion?: string;
	},
) {
	const url = new URL("/api/tv/discover", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const gid = init?.genreId;
	if (gid !== undefined && Number.isFinite(gid) && gid > 0) {
		url.searchParams.set("genre", String(Math.floor(gid)));
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
	init?: Pick<RequestInit, "signal" | "cache"> & { cookieHeader?: string },
) {
	const url = new URL("/api/movies/genres", env.NEXT_PUBLIC_SERVER_URL);
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
	const url = new URL("/api/badges/me/recent", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("since", sinceIso);
	const response = await fetch(url, { credentials: "include" });
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status },
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
		env.NEXT_PUBLIC_SERVER_URL,
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

/** Current-user diary rows for one TMDb title — canonical for “already logged?” on movie pages. */
export async function fetchMyLogsForMovie(
	movieId: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL(
		`/api/logs/me/by-movie/${movieId}`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
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
	const url = new URL(`/api/logs/me/by-tv/${tvId}`, env.NEXT_PUBLIC_SERVER_URL);
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

/** Patron lists — optional `movieId` adds `containsMovie` per row for add-to-list UI. */
export async function fetchListsMe(
	movieId?: number,
	init?: Pick<RequestInit, "signal">,
) {
	const url = new URL("/api/lists/me", env.NEXT_PUBLIC_SERVER_URL);
	if (movieId != null && Number.isFinite(movieId)) {
		url.searchParams.set("movieId", String(movieId));
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
	const url = new URL(
		`/api/watchlist/check/${movieId}`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
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
	const url = new URL(
		`/api/watchlist/check/tv/${tvId}`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
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
	const url = new URL(`/api/watchlist/${movieId}`, env.NEXT_PUBLIC_SERVER_URL);
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
	const url = new URL(`/api/watchlist/tv/${tvId}`, env.NEXT_PUBLIC_SERVER_URL);
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
		env.NEXT_PUBLIC_SERVER_URL,
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
		env.NEXT_PUBLIC_SERVER_URL,
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
}) {
	const response = await fetch(
		new URL("/api/logs", env.NEXT_PUBLIC_SERVER_URL),
		{
			method: "POST",
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
	}>,
) {
	const response = await fetch(
		new URL(
			`/api/logs/${encodeURIComponent(logId)}`,
			env.NEXT_PUBLIC_SERVER_URL,
		),
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
	const response = await fetch(
		new URL("/api/watchlist", env.NEXT_PUBLIC_SERVER_URL),
		{
			method: "POST",
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

/**
 * Marks one notification read (`POST /api/notifications/:id/read`).
 * Uses fetch (not Eden) so the dynamic path is reliable from the client.
 */
export async function postNotificationRead(id: string) {
	const url = new URL(
		`/api/notifications/${encodeURIComponent(id)}/read`,
		env.NEXT_PUBLIC_SERVER_URL,
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
