import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { MovieCatalogSurfaceChips } from "@/components/movie/movie-catalog-surface-chips";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { Section } from "@/components/ui/section";

import { fetchMoviesNowPlaying } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = {
	title: "In theatres now",
	description:
		"Browse films currently in theatres from TMDb — same feed as the home lobby In cinemas + Popular rail.",
};

export const dynamic = "force-dynamic";

type NowPlayingPayload = {
	page: number;
	total_pages?: number;
	total_results?: number;
	results?: {
		id: number;
		title: string;
		poster_url: string | null;
	}[];
	code?: string;
	hint?: string;
};

/** Always hydrate from sheet 1 — the client sentinel requests 2…N as you scroll. */
const SEED_PAGE = 1;

export default async function NowPlayingMoviesPage() {
	const jar = await cookies();
	/** Cookie jar mirroring `serverApi()` — keeps auth aligned for RSC fetches. */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const { data, error } = await fetchMoviesNowPlaying(SEED_PAGE, {
		cookieHeader,
	});
	const payload = (data ?? null) as NowPlayingPayload | null;

	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);

	/** Blocking reason stops automatic scroll fetch (TMDB provisioning or transport failure). */
	const blockedReason =
		error || unconfiguredHint
			? (unconfiguredHint ?? "Could not load in-theatres films right now.")
			: null;

	return (
		<div className="space-y-8">
			<Section
				kicker="Billboard"
				title="In theatres now"
				subtitle="TMDb’s now-playing sheet — titles currently on cinema screens in your region. Same source as Home → In cinemas when Popular is selected; scroll to load more sheets."
				rightSlot={
					/* Hover tint only on true hover devices — skips the brief “stuck hover” flash on touch. */
					<Link
						href="/home"
						aria-label="Back to home lobby"
						className="text-muted-foreground text-xs [@media(hover:hover)]:hover:text-foreground"
					>
						← Lobby
					</Link>
				}
			>
				{blockedReason ? (
					<p className="text-muted-foreground text-sm" role="status">
						{blockedReason}
					</p>
				) : totalResults > 0 ? (
					<p className="text-muted-foreground text-xs">
						{totalResults.toLocaleString()} titles
						{totalPages ? ` · ${totalPages} sheets` : ""} — scroll to load more
						rows.
					</p>
				) : null}

				<MovieCatalogSurfaceChips />

				<PopularMoviesInfinite
					catalogKind="now_playing"
					catalogLabel="now playing in theatres"
					seedMovies={seedMovies}
					seedPage={SEED_PAGE}
					totalPages={totalPages}
					totalResults={totalResults}
					blockedReason={blockedReason}
				/>
			</Section>
		</div>
	);
}
