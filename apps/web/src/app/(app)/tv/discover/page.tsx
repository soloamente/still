import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { Section } from "@/components/ui/section";
import { normalizeDiscoverMonetization } from "@/lib/discover-catalog-url";
import { fetchTvDiscover } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = {
	title: "Discover TV",
	description:
		"Browse TMDb TV discover — sort and first-air window; same vocabulary as the home lobby.",
};

export const dynamic = "force-dynamic";

/** Mirrors server `DISCOVER_TV_SORT_WHITELIST` — keep query strings aligned. */
const TV_DISCOVER_SORT_WHITELIST = new Set([
	"popularity.desc",
	"popularity.asc",
	"first_air_date.desc",
	"first_air_date.asc",
	"vote_average.desc",
	"vote_average.asc",
	"name.asc",
]);

function normalizeTvDiscoverSort(raw: string | undefined): string {
	const s = raw?.trim() ?? "";
	return TV_DISCOVER_SORT_WHITELIST.has(s) ? s : "popularity.desc";
}

type TvDiscoverPayload = {
	page: number;
	total_pages?: number;
	total_results?: number;
	results?: { id: number; title: string; poster_url: string | null }[];
	code?: string;
	hint?: string;
	applied?: {
		genre: number | null;
		sort: string;
		air_date_gte?: string | null;
		monetization?: string | null;
		watch_region?: string | null;
	};
};

const SEED_PAGE = 1;

function parseGenreId(raw: string | undefined): number | null {
	if (!raw?.trim()) return null;
	const n = Math.floor(Number(raw));
	return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function TvDiscoverPage({
	searchParams,
}: {
	searchParams: Promise<{
		genre?: string;
		sort?: string;
		air_date_gte?: string;
		monetization?: string;
		watch_region?: string;
	}>;
}) {
	const sp = await searchParams;
	const jar = await cookies();
	/** Cookie jar mirroring other catalogue RSC pages — keeps auth aligned for TMDb proxy fetches. */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const appliedGenre = parseGenreId(sp.genre);
	const appliedSort = normalizeTvDiscoverSort(sp.sort);
	const appliedMonetization = normalizeDiscoverMonetization(sp.monetization);
	const wrRaw = (sp.watch_region ?? "").trim().toUpperCase();
	const appliedWatchRegion =
		wrRaw === "ALL" || wrRaw === "ANY" || wrRaw === "WORLD"
			? "ALL"
			: wrRaw.length === 2 && /^[A-Z]{2}$/.test(wrRaw)
				? wrRaw
				: null;
	const agRaw = (sp.air_date_gte ?? "").trim();
	const appliedAirDateGte =
		agRaw && /^\d{4}-\d{2}-\d{2}$/.test(agRaw) ? agRaw : null;

	const { data: discoverData, error: discoverError } = await fetchTvDiscover(
		SEED_PAGE,
		{
			cookieHeader,
			genreId: appliedGenre ?? undefined,
			sortBy: appliedSort,
			airDateGte: appliedAirDateGte ?? undefined,
			monetization: appliedMonetization ?? undefined,
			watchRegion: appliedWatchRegion ?? undefined,
		},
	);

	const payload = (discoverData ?? null) as TvDiscoverPayload | null;
	const seedShows = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);
	const blockedReason =
		discoverError || unconfiguredHint
			? (unconfiguredHint ?? "Could not load TV discover right now.")
			: null;

	const emptyCatalog = !blockedReason && totalResults === 0;

	return (
		<div className="space-y-8">
			<Section
				kicker="Billboard"
				title="Discover TV"
				subtitle="TMDb `/discover/tv` — sort and optional first-air floor; URLs match the home lobby Filters link for TV Upcoming."
				rightSlot={
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
						{totalResults.toLocaleString()} shows
						{totalPages ? ` · ${totalPages} sheets` : ""} — scroll to load more
						rows.
					</p>
				) : null}

				{emptyCatalog ? (
					<div
						className="mt-4 rounded-2xl border border-border border-dashed bg-surface-raised/40 p-10 text-center"
						role="status"
					>
						<p className="font-display text-lg">No shows in this slice</p>
						<p className="mt-2 text-muted-foreground text-sm">
							TMDb returned an empty sheet for these filters — try another sort
							or widen the date window.
						</p>
					</div>
				) : !blockedReason ? (
					<PopularMoviesInfinite
						key={`${appliedGenre ?? "all"}-${appliedSort}-${appliedMonetization ?? "no-mon"}-${appliedWatchRegion ?? "no-wr"}-${appliedAirDateGte ?? "no-air"}`}
						blockedReason={blockedReason}
						catalogKind="discover"
						catalogMedia="tv"
						discoverAirDateGte={appliedAirDateGte}
						discoverGenreId={appliedGenre}
						discoverMonetization={appliedMonetization}
						discoverSortBy={appliedSort}
						discoverWatchRegion={appliedWatchRegion}
						seedMovies={seedShows}
						seedPage={SEED_PAGE}
						totalPages={totalPages}
						totalResults={totalResults}
					/>
				) : null}
			</Section>
		</div>
	);
}
