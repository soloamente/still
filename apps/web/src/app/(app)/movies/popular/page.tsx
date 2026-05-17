import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { MovieCatalogSurfaceChips } from "@/components/movie/movie-catalog-surface-chips";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { Section } from "@/components/ui/section";

import { fetchMoviesPopular } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = {
	title: "Popular films",
	description: "Browse popular titles from TMDb — most-talked-about first.",
};

export const dynamic = "force-dynamic";

type PopularPayload = {
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

export default async function PopularMoviesPage() {
	const jar = await cookies();
	/** Cookie jar mirroring `serverApi()` — keeps auth aligned for RSC fetches. */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const { data, error } = await fetchMoviesPopular(SEED_PAGE, { cookieHeader });
	const payload = (data ?? null) as PopularPayload | null;

	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);

	/** Blocking reason stops automatic scroll fetch (TMDB provisioning or transport failure). */
	const blockedReason =
		error || unconfiguredHint
			? (unconfiguredHint ?? "Could not load popular films right now.")
			: null;

	return (
		<div className="space-y-8">
			<Section
				kicker="Billboard"
				title="Popular right now"
				subtitle="Full TMDb “popular” catalogue — same ordering as Lobby’s Now showing rail, widest titles first. Scroll to load more; use ⌘K when you already know the title."
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
						{totalPages ? ` · ${totalPages} sheets behind the curtain` : ""},{" "}
						<span className="opacity-90">sorted by fame on TMDb</span> — more
						load as you scroll.
					</p>
				) : null}

				<MovieCatalogSurfaceChips />

				<PopularMoviesInfinite
					catalogKind="popular"
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
