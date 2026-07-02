import { NextResponse } from "next/server";

import { fetchMovieDetailTmdbJson } from "@/lib/movie-hero-media-route";
import { pickTrailerFromTmdbJson } from "@/lib/tmdb-trailer-pick";

/**
 * Taste hero background trailer — served from the web app when the API deploy lags behind.
 * Next explicit routes win over `/api/*` rewrites to Elysia.
 */
export async function GET(
	_req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const { id } = await ctx.params;
	const tmdbJson = await fetchMovieDetailTmdbJson(id);
	const trailer = pickTrailerFromTmdbJson(tmdbJson);
	return NextResponse.json({
		trailerKey: trailer?.key ?? null,
		trailerSite: trailer?.site ?? null,
	});
}
