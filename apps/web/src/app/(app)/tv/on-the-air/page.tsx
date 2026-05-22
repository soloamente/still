import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { FilterChipLink, FilterChipRow } from "@/components/ui/filter-chip-row";
import { Section } from "@/components/ui/section";

import { TV_ONGOING_DISCOVER_STATUS } from "@/lib/home-catalog-run";
import { fetchTvDiscover } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = {
	title: "Returning TV series",
	description:
		"Browse TV series TMDb marks as Returning — same feed as Home → TV → Ongoing.",
};

export const dynamic = "force-dynamic";

type ReturningTvPayload = {
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

const SEED_PAGE = 1;

/** Full scrolling list for the home TV **Ongoing** slice (`GET /api/tv/discover?status=returning`). */
export default async function TvOnTheAirPage() {
	const jar = await cookies();
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const { data, error } = await fetchTvDiscover(SEED_PAGE, {
		cookieHeader,
		sortBy: "popularity.desc",
		status: TV_ONGOING_DISCOVER_STATUS,
	});
	const payload = (data ?? null) as ReturningTvPayload | null;

	const seedShows = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);
	const blockedReason =
		error || unconfiguredHint
			? (unconfiguredHint ?? "Could not load returning TV series right now.")
			: null;

	return (
		<div className="space-y-8">
			<Section
				kicker="TV catalogue"
				title="Returning series"
				subtitle="TMDb Returning Series — still active, not ended. Matches Home → TV → Ongoing; does not overlap Completed (Ended)."
				rightSlot={
					<Link
						href="/home?browse=tv&run=ongoing"
						aria-label="Back to home TV ongoing lobby"
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
						{totalResults.toLocaleString()} series
						{totalPages ? ` · ${totalPages} sheets` : ""} — scroll to load more
						rows.
					</p>
				) : null}

				<FilterChipRow className="mb-4" aria-label="Browse TV catalogues">
					<FilterChipLink href="/home?browse=tv&run=ongoing" selected>
						Ongoing
					</FilterChipLink>
					<FilterChipLink href="/home?browse=tv&run=completed">
						Completed
					</FilterChipLink>
					<FilterChipLink href="/tv/discover?status=returning">
						Discover
					</FilterChipLink>
				</FilterChipRow>

				<PopularMoviesInfinite
					blockedReason={blockedReason}
					catalogKind="discover"
					catalogLabel="returning series"
					catalogMedia="tv"
					discoverSortBy="popularity.desc"
					discoverTvStatus={TV_ONGOING_DISCOVER_STATUS}
					seedMovies={seedShows}
					seedPage={SEED_PAGE}
					totalPages={totalPages}
					totalResults={totalResults}
				/>
			</Section>
		</div>
	);
}
