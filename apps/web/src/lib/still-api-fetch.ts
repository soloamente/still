import { env } from "@still/env/web";

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

export async function fetchMoviesSearch(qRaw: string, init?: Pick<RequestInit, "signal">) {
  const url = new URL("/api/movies/search", env.NEXT_PUBLIC_SERVER_URL);
  url.searchParams.set("q", qRaw.trim());
  const response = await fetch(url, { credentials: "include", signal: init?.signal });
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
export async function fetchProfileHandleAvailable(handleParam: string, init?: Pick<RequestInit, "signal">) {
  const handle = handleParam.trim().toLowerCase();
  const url = new URL(`/api/profiles/check-handle/${encodeURIComponent(handle)}`, env.NEXT_PUBLIC_SERVER_URL);
  const response = await fetch(url, { credentials: "include", signal: init?.signal });
  const data = (await response.json()) as { available: boolean; reason: string } | null;
  return {
    data: response.ok ? data : null,
    error: response.ok ? null : { status: response.status },
    response,
  };
}

/** Current-user diary rows for one TMDb title — canonical for “already logged?” on movie pages. */
export async function fetchMyLogsForMovie(movieId: number, init?: Pick<RequestInit, "signal">) {
  const url = new URL(`/api/logs/me/by-movie/${movieId}`, env.NEXT_PUBLIC_SERVER_URL);
  const response = await fetch(url, { credentials: "include", signal: init?.signal });
  const data = (await response.json()) as unknown;
  return {
    data: response.ok ? data : null,
    error: response.ok ? null : { status: response.status },
    response,
  };
}

/** Whether this film sits on the viewer’s watchlist. */
export async function fetchWatchlistCheck(movieId: number, init?: Pick<RequestInit, "signal">) {
  const url = new URL(`/api/watchlist/check/${movieId}`, env.NEXT_PUBLIC_SERVER_URL);
  const response = await fetch(url, { credentials: "include", signal: init?.signal });
  const data = (await response.json()) as { inWatchlist?: boolean };
  return {
    data: response.ok ? data : null,
    error: response.ok ? null : { status: response.status },
    response,
  };
}

export async function deleteWatchlistItem(movieId: number) {
  const url = new URL(`/api/watchlist/${movieId}`, env.NEXT_PUBLIC_SERVER_URL);
  const response = await fetch(url, { method: "DELETE", credentials: "include" });
  const data = (await response.json().catch(() => null)) as unknown;
  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? null : { status: response.status, raw: data },
  };
}

export async function deleteLog(logId: string) {
  const url = new URL(`/api/logs/${encodeURIComponent(logId)}`, env.NEXT_PUBLIC_SERVER_URL);
  const response = await fetch(url, { method: "DELETE", credentials: "include" });
  const data = (await response.json().catch(() => null)) as unknown;
  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? null : { status: response.status, raw: data },
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
  movieId: number;
  watchedAt?: string;
  liked?: boolean;
  rating?: number;
  note?: string;
}) {
  const response = await fetch(new URL("/api/logs", env.NEXT_PUBLIC_SERVER_URL), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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
    rating: number;
    watchedAt: string;
    note: string;
    containsSpoilers: boolean;
    rewatch: boolean;
  }>,
) {
  const response = await fetch(new URL(`/api/logs/${encodeURIComponent(logId)}`, env.NEXT_PUBLIC_SERVER_URL), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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

/** Add (or bump) watchlist membership. */
export async function postWatchlistAdd(movieId: number, note?: string) {
  const response = await fetch(new URL("/api/watchlist", env.NEXT_PUBLIC_SERVER_URL), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ movieId, note }),
  });
  const data = await parseJsonBlob(response);
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? data : null,
    error: response.ok ? null : { status: response.status, raw: data },
  };
}
