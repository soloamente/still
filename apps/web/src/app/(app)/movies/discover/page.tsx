import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { MovieCatalogSurfaceChips } from "@/components/movie/movie-catalog-surface-chips";
import { MovieDiscoverToolbar } from "@/components/movie/movie-discover-toolbar";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { Section } from "@/components/ui/section";
import {
	normalizeDiscoverMonetization,
	normalizeDiscoverSort,
} from "@/lib/discover-catalog-url";
import { parseExplicitHomeVenue } from "@/lib/home-venue";
import { readCatalogTmdbWatchRegionPref } from "@/lib/profile-preferences";
import { findSearchDialogStudio } from "@/lib/search-dialog-studios";
import { serverApi } from "@/lib/server-api";
import {
	fetchMovieGenres,
	fetchMovieStudios,
	fetchMoviesDiscover,
} from "@/lib/still-api-fetch";
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
	applied?: {
		genre: number | null;
		sort: string;
		monetization?: string | null;
		watch_region?: string | null;
		region?: string | null;
		primary_release_date_lte?: string | null;
		release_gte?: string | null;
	};
};

/** Always hydrate from sheet 1 — the client sentinel requests 2…N as you scroll. */
const SEED_PAGE = 1;

function parseGenreId(raw: string | undefined): number | null {
	if (!raw?.trim()) return null;
	const n = Math.floor(Number(raw));
	return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCompanyId(raw: string | undefined): number | null {
	if (!raw?.trim()) return null;
	const n = Math.floor(Number(raw));
	return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function DiscoverMoviesPage({
	searchParams,
}: {
	searchParams: Promise<{
		genre?: string;
		sort?: string;
		venue?: string;
		monetization?: string;
		watch_region?: string;
		region?: string;
		company?: string;
		release_gte?: string;
	}>;
}) {
	const sp = await searchParams;
	const jar = await cookies();
	/** Cookie jar mirroring `serverApi()` — keeps auth aligned for RSC fetches. */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const appliedGenre = parseGenreId(sp.genre);
	const appliedCompany = parseCompanyId(sp.company);
	const appliedSort = normalizeDiscoverSort(sp.sort);
	const explicitVenue = parseExplicitHomeVenue(sp.venue);
	const appliedMonetization = normalizeDiscoverMonetization(sp.monetization);
	const wrRaw = (sp.watch_region ?? "").trim().toUpperCase();
	const appliedWatchRegion =
		wrRaw === "ALL" || wrRaw === "ANY" || wrRaw === "WORLD"
			? "ALL"
			: wrRaw.length === 2 && /^[A-Z]{2}$/.test(wrRaw)
				? wrRaw
				: null;
	const regRaw = (sp.region ?? "").trim().toUpperCase();
	const appliedReleaseRegion =
		regRaw.length === 2 && /^[A-Z]{2}$/.test(regRaw) ? regRaw : null;
	const rgRaw = (sp.release_gte ?? "").trim();
	const appliedReleaseGte =
		rgRaw && /^\d{4}-\d{2}-\d{2}$/.test(rgRaw) ? rgRaw : null;

	const api = await serverApi();
	const [profileRes, { data: genresData }, { data: studiosData }] =
		await Promise.all([
			api.api.profiles.me.get().catch(() => ({ data: null })),
			fetchMovieGenres({ cookieHeader }),
			appliedCompany != null
				? fetchMovieStudios({ cookieHeader })
				: Promise.resolve({ data: null }),
		]);
	const mePrefs = (
		profileRes.data as { preferences?: Record<string, unknown> | null } | null
	)?.preferences;
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs ?? null);
	const profileTheatricalRegionIso =
		typeof catalogWatchPref === "string" && catalogWatchPref !== "ALL"
			? catalogWatchPref
			: undefined;
	/** Theatrical discover needs TMDb `region`; URL wins, then Settings catalogue country. */
	const effectiveReleaseRegion =
		appliedReleaseRegion ??
		(explicitVenue === "theaters" ? profileTheatricalRegionIso : undefined);

	const { data: discoverData, error: discoverError } =
		await fetchMoviesDiscover(SEED_PAGE, {
			cookieHeader,
			genreId: appliedGenre ?? undefined,
			companyId: appliedCompany ?? undefined,
			sortBy: appliedSort,
			venue: explicitVenue ?? undefined,
			monetization: appliedMonetization ?? undefined,
			watchRegion: appliedWatchRegion ?? undefined,
			region: effectiveReleaseRegion,
			releaseGte: appliedReleaseGte ?? undefined,
		});

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
	const studioRows =
		(
			studiosData as {
				studios?: { id: number; name: string; logo_url?: string | null }[];
			} | null
		)?.studios?.map((s) => ({
			id: s.id,
			name: s.name,
			logoUrl: s.logo_url ?? null,
		})) ?? [];
	const activeStudio = findSearchDialogStudio(studioRows, appliedCompany);
	const discoverTitle = activeStudio ? activeStudio.name : "Discover";
	const discoverSubtitle = activeStudio
		? `Films from ${activeStudio.name} on TMDb’s discover sheet — same chip language as Popular; URLs stay shareable.`
		: "TMDb’s discover sheet — pick a genre mood, then a sort order. Same chip language as Popular and Opening soon; URLs stay shareable.";

	return (
		<div className="space-y-8">
			<Section
				kicker="Billboard"
				title={discoverTitle}
				subtitle={discoverSubtitle}
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
						appliedVenue={explicitVenue}
						appliedMonetization={appliedMonetization}
						appliedWatchRegion={appliedWatchRegion}
						appliedReleaseRegion={appliedReleaseRegion}
						appliedReleaseGte={appliedReleaseGte}
						genres={genres}
						appliedGenre={appliedGenre}
						appliedCompany={appliedCompany}
						appliedSort={appliedSort}
					/>
				) : null}

				{emptyCatalog ? (
					<DiscoverCatalogEmpty
						genreLabel={genreLabel}
						studioLabel={activeStudio?.name}
					/>
				) : !blockedReason ? (
					<PopularMoviesInfinite
						key={`${appliedGenre ?? "all"}-${appliedCompany ?? "all-co"}-${appliedSort}-${explicitVenue ?? "all-venues"}-${appliedMonetization ?? "no-mon"}-${appliedWatchRegion ?? "no-wr"}-${effectiveReleaseRegion ?? "no-reg"}-${appliedReleaseGte ?? "no-rg"}`}
						catalogKind="discover"
						discoverGenreId={appliedGenre}
						discoverCompanyId={appliedCompany}
						discoverSortBy={appliedSort}
						discoverVenue={explicitVenue}
						discoverMonetization={appliedMonetization}
						discoverWatchRegion={appliedWatchRegion}
						discoverReleaseRegion={effectiveReleaseRegion ?? null}
						discoverReleaseGte={appliedReleaseGte}
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
	studioLabel,
}: {
	genreLabel: string | null | undefined;
	studioLabel?: string | null;
}) {
	return (
		<div
			className="mt-4 rounded-2xl border border-border border-dashed bg-surface-raised/40 p-10 text-center"
			role="status"
		>
			<p className="font-display text-lg">No titles in this slice</p>
			<p className="mt-2 text-muted-foreground text-sm">
				{studioLabel
					? `TMDb did not return any ${studioLabel} films for this combination of filters right now — try another studio or sort order.`
					: genreLabel
						? `TMDb did not return any ${genreLabel} films for this combination of filters right now — try another genre or sort order.`
						: "TMDb returned an empty sheet for these filters — widen the mood or pick a different sort."}
			</p>
		</div>
	);
}
