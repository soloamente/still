import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { HomeCatalogSortChips } from "@/components/home/home-catalog-sort-chips";
import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { authServer } from "@/lib/auth-server";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	HOME_COMMUNITY_FEEDS,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import { readCatalogMonochromePeersOnHoverPref } from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import {
	fetchMoviesDiscover,
	fetchMoviesPopular,
	fetchTvDiscover,
	fetchTvPopular,
} from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const dynamic = "force-dynamic";

/** First sheet from TMDb — client infinite scroll asks for page 2…N the same way as `/movies/popular`. */
const SEED_PAGE = 1;

/** “Latest” movie lobby rail — TMDb discover by primary release date (same vocabulary as `/movies/discover`). */
const LATEST_DISCOVER_SORT = "primary_release_date.desc" as const;

/** “Latest” TV lobby rail — TMDb discover TV by first air date (TV has no `primary_release_date`). */
const LATEST_TV_DISCOVER_SORT = "first_air_date.desc" as const;

type MovieSheetPayload = {
	page: number;
	total_pages?: number;
	total_results?: number;
	results?: { id: number; title: string; poster_url: string | null }[];
	code?: string;
	hint?: string;
};

export default async function HomePage({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string; browse?: string }>;
}) {
	const sp = await searchParams;
	const sort = parseHomeCatalogSort(sp.sort);
	const browse = parseHomeBrowseSurface(sp.browse);
	const communityFeed =
		browse === "community" ? parseHomeCommunityFeed(sp.sort) : null;
	const communityFeedMeta = HOME_COMMUNITY_FEEDS.find(
		(f) => f.id === communityFeed,
	);
	const communityFeedLabel = communityFeedMeta?.label ?? "Lists";
	const communityFeedHint =
		communityFeedMeta?.hint ??
		"Member lists, reviews, diary, and activity will appear here.";

	const jar = await cookies();
	/** Forward session cookies so RSC `fetch` hits the API as the signed-in user (mirrors other catalogue pages). */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const api = await serverApi();
	const session = await authServer();

	const lobbySheet =
		browse === "community"
			? Promise.resolve({ data: null, error: null })
			: browse === "tv"
				? sort === "popular"
					? fetchTvPopular(SEED_PAGE, { cookieHeader })
					: fetchTvDiscover(SEED_PAGE, {
							cookieHeader,
							sortBy: LATEST_TV_DISCOVER_SORT,
						})
				: sort === "popular"
					? fetchMoviesPopular(SEED_PAGE, { cookieHeader })
					: fetchMoviesDiscover(SEED_PAGE, {
							cookieHeader,
							sortBy: LATEST_DISCOVER_SORT,
						});

	const [{ data, error }, profileRes] = await Promise.all([
		lobbySheet,
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);

	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;

	const mePrefs = profileData?.preferences;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);

	const stickyUser =
		session && profileData?.handle
			? {
					id: session.user.id,
					name: session.user.name ?? profileData.displayName ?? "You",
					image: session.user.image ?? null,
					handle: profileData.handle,
					email: session.user.email ?? null,
				}
			: null;

	const payload = (data ?? null) as MovieSheetPayload | null;
	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);
	const blockedReason =
		browse === "community"
			? null
			: error || unconfiguredHint
				? (unconfiguredHint ?? "Could not load titles for the lobby right now.")
				: null;

	const discoverSortForLobby =
		sort === "popular"
			? "popularity.desc"
			: browse === "tv"
				? LATEST_TV_DISCOVER_SORT
				: LATEST_DISCOVER_SORT;

	return (
		// Fills `<main>` from `AppShell` (`flex-1 min-h-0` + bottom reserve) — do not use `min-h-svh` here or the card ignores shell padding above the nav inset.
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			{/*
				Middle column `minmax(20rem, 56rem)` gives the search a real width band;
				`1fr auto 1fr` + `auto` alone shrink-wraps to input min-content so width
				never grew past the old `48rem` cap even when `max-w-*` increased.
			*/}
			<Suspense
				fallback={
					<div
						className="sticky top-0 z-20 h-14 w-full animate-pulse rounded-[2rem] bg-card/60"
						aria-hidden
					/>
				}
			>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<section
				className={cn(
					/* `flex-1` + `min-h-0` lets this card fill the viewport under the sticky chrome so community can center a true empty state. */
					"flex min-h-0 flex-1 flex-col gap-2.5 rounded-[2.5rem] bg-card p-4",
					browse === "community" ? "overflow-hidden" : "overflow-visible",
				)}
			>
				{/*
						`useSearchParams` — keep inside Suspense so the home RSC shell can still
						stream; the bar is tiny so a short fallback is acceptable.
					*/}
				<div className="flex shrink-0 items-center justify-between gap-3">
					<Suspense
						fallback={
							<div
								className="h-10 w-44 animate-pulse rounded-full bg-background"
								aria-hidden
							/>
						}
					>
						<HomeCatalogSortChips />
					</Suspense>
					{browse !== "community" ? (
						<Suspense
							fallback={
								<div
									className="h-10 min-w-66 shrink-0 animate-pulse rounded-full bg-background"
									aria-hidden
								/>
							}
						>
							<HomeCatalogViewModeToolbar />
						</Suspense>
					) : null}
				</div>

				{browse === "community" ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
						{/*
							Dashed “plate” matches `/lists` empty rows — reads as intentional negative
							space, not a broken grid (Mobbin-style empty states on dark chrome).
						*/}
						<div
							className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
							role="status"
						>
							<div className="space-y-2">
								{/* `font-sans` = SF Pro Rounded stack (`--font-proxima-nova`) — not Fraunces display. */}
								<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
									{communityFeedLabel} — coming soon
								</p>
								<p className="text-muted-foreground text-sm leading-relaxed">
									{communityFeedHint} This lobby will fill in as we ship
									community surfaces. Until then, the TMDb catalogues are ready
									below the header.
								</p>
							</div>
							<div className="flex flex-wrap items-center justify-center gap-2">
								<Link
									href={buildHomeLobbyHref({
										browse: "movies",
										sort: "latest",
									})}
									className={buttonVariants({
										variant: "outline",
										size: "pill",
									})}
								>
									Browse movies
								</Link>
								<Link
									href={buildHomeLobbyHref({ browse: "tv", sort: "latest" })}
									className={buttonVariants({
										variant: "outline",
										size: "pill",
									})}
								>
									Browse TV
								</Link>
							</div>
						</div>
					</div>
				) : blockedReason ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12">
						<p
							className="max-w-md text-center text-muted-foreground text-sm"
							role="status"
						>
							{blockedReason}
						</p>
					</div>
				) : (
					// `rounded-[3rem]` on links matches the poster frame so hover elevation shadow follows the curve.
					<PopularMoviesInfinite
						blockedReason={blockedReason}
						catalogKind={sort === "popular" ? "popular" : "discover"}
						catalogLabel={sort === "popular" ? "popular" : "latest"}
						catalogMedia={browse === "tv" ? "tv" : "movie"}
						discoverSortBy={discoverSortForLobby}
						gridClassName="isolate grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 md:gap-2 lg:grid-cols-5 lg:gap-2 xl:grid-cols-6 xl:gap-2"
						posterFrameClassName="rounded-[3rem] border-0 bg-background"
						posterHoverEffect="elevation"
						posterLinkClassName="min-w-0 rounded-[3rem]"
						monochromePeersOnHover={monochromePeersOnHover}
						seedMovies={seedMovies}
						seedPage={SEED_PAGE}
						showTitle={false}
						staggerPosterEntrance
						totalPages={totalPages}
						totalResults={totalResults}
					/>
				)}
			</section>
		</div>
	);
}
