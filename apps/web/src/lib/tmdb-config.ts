/**
 * API movie list/search payloads may include this when `TMDB_API_KEY` is
 * unset on the server (`apps/server`); see `moviesRoute` in the Elysia app.
 */
export function tmdbSetupHint(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { code?: string; hint?: string };
  return o.code === "TMDB_UNCONFIGURED" && typeof o.hint === "string" ? o.hint : null;
}
