import { NextResponse } from "next/server";

import { fetchMovieDetailTmdbJson } from "@/lib/movie-hero-media-route";
import { pickTitleLogoFromTmdbJson } from "@/lib/tmdb-title-logo";

/**
 * Taste hero title wordmark — served from the web app when the API deploy lags behind.
 * Next explicit routes win over `/api/*` rewrites to Elysia.
 */
export async function GET(
	_req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const { id } = await ctx.params;
	const tmdbJson = await fetchMovieDetailTmdbJson(id);
	const logoPath = pickTitleLogoFromTmdbJson(tmdbJson);
	return NextResponse.json({ logoPath });
}
