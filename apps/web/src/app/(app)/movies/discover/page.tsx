import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { MovieCatalogSurfaceChips } from "@/components/movie/movie-catalog-surface-chips";
import { MovieDiscoverToolbar } from "@/components/movie/movie-discover-toolbar";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { Section } from "@/components/ui/section";
import { normalizeDiscoverSort } from "@/lib/discover-catalog-url";
import { fetchMovieGenres, fetchMoviesDiscover } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = {
	title: "Discover films",
	description:
		"Browse TMDb by genre and sort — mood-led discovery beside Popular and Opening soon.",
};

export const dynamic = "force-dynamic";

type DiscoverPayload = {
	page: number;
	total_pages?: number;
	total_results?: number;
	results?: { id: number; title: string; poster_url: string | null }[];
	code?: string;
	hint?: string;
	applied?: { genre: number | null; sort: string };
};

/** Always hydrate from sheet 1 — the client sentinel requests 2…N as you scroll. */
const SEED_PAGE = 1;

function parseGenreId(raw: string | undefined): number | null {
	if (!raw?.trim()) return null;
	const n = Math.floor(Number(raw));
	return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function DiscoverMoviesPage({
	searchParams,
}: {
	searchParams: Promise<{ genre?: string; sort?: string }>;
}) {
	const sp = await searchParams;
	const jar = await cookies();
	/** Cookie jar mirroring `serverApi()` — keeps auth aligned for RSC fetches. */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const appliedGenre = parseGenreId(sp.genre);
	const appliedSort = normalizeDiscoverSort(sp.sort);

	const [{ data: discoverData, error: discoverError }, { data: genresData }] =
		await Promise.all([
			fetchMoviesDiscover(SEED_PAGE, {
				cookieHeader,
				genreId: appliedGenre ?? undefined,
				sortBy: appliedSort,
			}),
			fetchMovieGenres({ cookieHeader }),
		]);

	const payload = (discoverData ?? null) as DiscoverPayload | null;
	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const genres =
		(genresData as { genres?: { id: number; name: string }[] } | null)
			?.genres ?? [];
	const unconfiguredHint = tmdbSetupHint(payload) ?? tmdbSetupHint(genresData);
	/** Blocking reason stops automatic scroll fetch (TMDB provisioning or transport failure). */
	const blockedReason =
		discoverError || unconfiguredHint
			? (unconfiguredHint ?? "Could not load discover catalogue right now.")
			: null;

	const emptyCatalog = !blockedReason && totalResults === 0;
	const genreLabel =
		appliedGenre != null
			? genres.find((g) => g.id === appliedGenre)?.name
			: null;

	return (
		<div className="space-y-8">
			<Section
				kicker="Billboard"
				title="Discover"
				subtitle="TMDb’s discover sheet — pick a genre mood, then a sort order. Same chip language as Popular and Opening soon; URLs stay shareable."
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

				{!blockedReason ? (
					<MovieDiscoverToolbar
						genres={genres}
						appliedGenre={appliedGenre}
						appliedSort={appliedSort}
					/>
				) : null}

				{emptyCatalog ? (
					<DiscoverCatalogEmpty genreLabel={genreLabel} />
				) : !blockedReason ? (
					<PopularMoviesInfinite
						key={`${appliedGenre ?? "all"}-${appliedSort}`}
						catalogKind="discover"
						discoverGenreId={appliedGenre}
						discoverSortBy={appliedSort}
						seedMovies={seedMovies}
						seedPage={SEED_PAGE}
						totalPages={totalPages}
						totalResults={totalResults}
						blockedReason={blockedReason}
					/>
				) : null}
			</Section>
		</div>
	);
}

/** When TMDb returns zero rows for this genre + sort pair — keep chips visible so patrons can pivot. */
function DiscoverCatalogEmpty({
	genreLabel,
}: {
	genreLabel: string | null | undefined;
}) {
	return (
		<div
			className="mt-4 rounded-2xl border border-border border-dashed bg-surface-raised/40 p-10 text-center"
			role="status"
		>
			<p className="font-display text-lg">No titles in this slice</p>
			<p className="mt-2 text-muted-foreground text-sm">
				{genreLabel
					? `TMDb did not return any ${genreLabel} films for this combination of filters right now — try another genre or sort order.`
					: "TMDb returned an empty sheet for these filters — widen the mood or pick a different sort."}
			</p>
		</div>
	);
}
