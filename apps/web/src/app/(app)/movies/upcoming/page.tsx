import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { MovieCatalogSurfaceChips } from "@/components/movie/movie-catalog-surface-chips";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { Section } from "@/components/ui/section";

import { readCatalogTmdbWatchRegionPref } from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import { fetchMoviesUpcoming } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = {
	title: "Opening soon",
	description: "Browse upcoming theatrical releases from TMDb — soonest first.",
};

export const dynamic = "force-dynamic";

type UpcomingPayload = {
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

export default async function UpcomingMoviesPage() {
	const jar = await cookies();
	/** Cookie jar mirroring `serverApi()` — keeps auth aligned for RSC fetches. */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const api = await serverApi();
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));
	const mePrefs = (
		profileRes.data as { preferences?: Record<string, unknown> | null } | null
	)?.preferences;
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs ?? null);
	/** Match lobby: optional patron territory for TMDb theatrical primary-release filters. */
	const upcomingReleaseRegion =
		typeof catalogWatchPref === "string" && catalogWatchPref !== "ALL"
			? catalogWatchPref
			: undefined;

	const { data, error } = await fetchMoviesUpcoming(SEED_PAGE, {
		cookieHeader,
		region: upcomingReleaseRegion,
	});
	const payload = (data ?? null) as UpcomingPayload | null;

	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);

	/** Blocking reason stops automatic scroll fetch (TMDB provisioning or transport failure). */
	const blockedReason =
		error || unconfiguredHint
			? (unconfiguredHint ?? "Could not load upcoming films right now.")
			: null;

	return (
		<div className="space-y-8">
			<Section
				kicker="Billboard"
				title="Opening soon"
				subtitle="TMDb’s upcoming sheet — titles with a future release date, soonest window first. Switch to Popular for what’s hot right now."
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
					catalogKind="upcoming"
					seedMovies={seedMovies}
					seedPage={SEED_PAGE}
					totalPages={totalPages}
					totalResults={totalResults}
					blockedReason={blockedReason}
					upcomingReleaseRegion={upcomingReleaseRegion ?? null}
				/>
			</Section>
		</div>
	);
}
