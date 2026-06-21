# Home Page Load Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate two sequential network RTTs on the `/home` Server Component to reduce skeleton-to-content time during client-side navigation.

**Architecture:** Two changes in `home/page.tsx` only — (1) parallelize `authServer()` + `fetchMeProfile()` using `Promise.all`, (2) extract the lobby fetch branch into an inline async IIFE and merge it into the second `Promise.all` so it runs concurrently with the personal rails.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Eden/Elysia API client

---

## Files

- **Modify:** `apps/web/src/app/(app)/home/page.tsx` (lines ~305–526)

---

### Task 1: Parallelize auth + profile fetches

Currently `authServer()` and `fetchMeProfile()` are called sequentially even though they are fully independent. This task merges them into one `Promise.all`.

**Files:**
- Modify: `apps/web/src/app/(app)/home/page.tsx`

- [ ] **Step 1: Open the file and locate the sequential awaits**

In `apps/web/src/app/(app)/home/page.tsx`, find this block around line 305:

```ts
const api = await serverApi();
const session = await authServer();
const profileResult = await fetchMeProfile();
const profileDataEarly =
	profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
const catalogLanguage = resolveCatalogTmdbLanguage(
	profileDataEarly?.preferences ?? null,
);
```

- [ ] **Step 2: Replace with parallel fetch**

Replace the block above with:

```ts
const api = await serverApi();
const [session, profileResult] = await Promise.all([
	authServer(),
	fetchMeProfile(),
]);
const profileDataEarly =
	profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
const catalogLanguage = resolveCatalogTmdbLanguage(
	profileDataEarly?.preferences ?? null,
);
```

`serverApi()` must still run first because it only reads cookies (no network) and returns the `api` client used by the parallel fetches — but it completes synchronously fast, so this is fine.

- [ ] **Step 3: Verify TypeScript is happy**

Run from the repo root:

```bash
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
```

Expected: same baseline errors as before (no new errors). The types are unchanged — `session` is still `ServerSession | null` and `profileResult` is still `MeProfile | typeof PROFILE_FETCH_FAILED`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/home/page.tsx
git commit -m "perf(web): parallelize authServer + fetchMeProfile on home page"
```

---

### Task 2: Merge lobbyResult into the second Promise.all

Currently `lobbyResult` is fetched sequentially *after* the `Promise.all([continueWatching, tasteMatchedRail, committedSearchPayload])` resolves. Since `lobbyResult` only depends on profile prefs (computed synchronously from `profileResult`), it can run concurrently with the personal rails.

**Files:**
- Modify: `apps/web/src/app/(app)/home/page.tsx`

- [ ] **Step 1: Locate the second Promise.all and the lobbyResult block**

Find the existing `Promise.all` around line 314:

```ts
const [continueWatching, tasteMatchedRail, committedSearchPayload] =
	await Promise.all([
		session && browse === "tv" && !catalogueSearchActive
			? fetchTvWatchMeServer(api, { status: "watching,rewatching", limit: 12 })
			: Promise.resolve([]),
		session && browse === "movies" && !catalogueSearchActive
			? api.api.taste["for-you"]
					.get()
					.then((res) => {
						if (res.error || !res.data) return null;
						return res.data as TasteMatchedDiscoveryPayload;
					})
					.catch(() => null)
			: Promise.resolve(null),
		catalogueSearchActive && committedSearchRaw
			? loadCommittedCatalogueSearchSeeds({
					searchRaw: committedSearchRaw,
					browse: browse === "tv" ? "tv" : "movies",
					sort: catalogueSearchSort ?? "popular",
					cookieHeader,
					catalogLanguage,
				})
			: Promise.resolve(null),
	]);
```

And the `let lobbyResult` block that follows (lines ~372–526), which looks like:

```ts
let lobbyResult: {
	data: unknown;
	error: { status: number; nonJson?: boolean } | null;
};

if (catalogueSearchActive) {
	lobbyResult = { data: null, error: null };
} else {
	try {
		lobbyResult =
			browse === "community"
				? { data: null, error: null }
				: browse === "tv"
					? animeSeasonActive
						? await fetchTvDiscover(SEED_PAGE, { ... })
						: ...
					: ...
	} catch (err) {
		console.error("[home] catalogue fetch failed", err);
		lobbyResult = { data: null, error: { status: 0 } };
	}
}
```

- [ ] **Step 2: Remove the `let lobbyResult` block and merge it as a 4th slot in the Promise.all**

The prefs variables needed by the lobby fetch (`mePrefs`, `catalogWatchPref`, `streamingWatchRegionApi`, `patronCatalogTheatricalRegion`, `tvLobbySort`, `movieFilter*`, `tvFilter*`, `tvPopularNeedsDiscover`, `catalogReleaseFloorUtc`) are all computed synchronously from `profileResult` before the `Promise.all`. Move those computations *above* the `Promise.all` (currently they sit between the two awaits — move them just after the `catalogLanguage` line), then add the lobby fetch as a fourth slot.

Replace the full block from `const [continueWatching...` through the closing `}` of the `lobbyResult` try/catch with:

```ts
const profileData =
	profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
const mePrefs = profileData?.preferences ?? null;

const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
const streamingWatchRegionApi =
	catalogWatchRegionToApiQuery(catalogWatchPref);
const patronCatalogTheatricalRegion =
	typeof catalogWatchPref === "string" && catalogWatchPref !== "ALL"
		? catalogWatchPref
		: undefined;

const tvLobbySort = sort === "popular" ? "popular" : "latest";

const movieFilterGenreId = catalogFilters.genreId ?? undefined;
const movieFilterMonetization = catalogFilters.monetization ?? "flatrate";
const tvFilterGenreId = catalogFilters.genreId ?? undefined;
const tvFilterMonetization = catalogFilters.monetization ?? "flatrate";
const tvPopularNeedsDiscover =
	browse === "tv" &&
	!animeSeasonActive &&
	catalogRun === "ongoing" &&
	sort === "popular" &&
	(tvFilterGenreId != null ||
		(tvVenue === "streaming" && tvFilterMonetization !== "flatrate"));

const [continueWatching, tasteMatchedRail, committedSearchPayload, lobbyResult] =
	await Promise.all([
		// Personal TV progress rail — skip while committed search replaces the grid.
		session && browse === "tv" && !catalogueSearchActive
			? fetchTvWatchMeServer(api, {
					status: "watching,rewatching",
					limit: 12,
				})
			: Promise.resolve([]),
		// Taste rail — skip during committed search (Movies lobby hidden).
		session && browse === "movies" && !catalogueSearchActive
			? api.api.taste["for-you"]
					.get()
					.then((res) => {
						if (res.error || !res.data) return null;
						return res.data as TasteMatchedDiscoveryPayload;
					})
					.catch(() => null)
			: Promise.resolve(null),
		// Committed ⌘K search seeds.
		catalogueSearchActive && committedSearchRaw
			? loadCommittedCatalogueSearchSeeds({
					searchRaw: committedSearchRaw,
					browse: browse === "tv" ? "tv" : "movies",
					sort: catalogueSearchSort ?? "popular",
					cookieHeader,
					catalogLanguage,
				})
			: Promise.resolve(null),
		// Lobby catalogue fetch — runs concurrently with the personal rails above.
		(async (): Promise<{
			data: unknown;
			error: { status: number; nonJson?: boolean } | null;
		}> => {
			if (catalogueSearchActive) return { data: null, error: null };
			try {
				return browse === "community"
					? { data: null, error: null }
					: browse === "tv"
						? animeSeasonActive
							? await fetchTvDiscover(SEED_PAGE, {
									cookieHeader,
									...animeSeasonTvDiscoverParams(tvLobbySort),
								})
							: catalogRun === "ongoing"
								? await fetchTvDiscover(SEED_PAGE, {
										cookieHeader,
										sortBy: tvDiscoverSortByForLobbySort(tvLobbySort),
										status: TV_ONGOING_DISCOVER_STATUS,
										genreId: tvFilterGenreId,
									})
								: catalogRun === "completed"
									? await fetchTvDiscover(SEED_PAGE, {
											cookieHeader,
											sortBy: tvDiscoverSortByForLobbySort(tvLobbySort),
											status: TV_COMPLETED_DISCOVER_STATUS,
											genreId: tvFilterGenreId,
										})
									: catalogRun === "upcoming"
										? tvLobbyStreamingUpcoming
											? await fetchTvDiscover(SEED_PAGE, {
													cookieHeader,
													sortBy: TV_UPCOMING_DISCOVER_SORT,
													airDateGte: catalogReleaseFloorUtc,
													monetization: tvFilterMonetization,
													watchRegion: streamingWatchRegionApi,
													genreId: tvFilterGenreId,
												})
											: await fetchTvDiscover(SEED_PAGE, {
													cookieHeader,
													sortBy: TV_UPCOMING_DISCOVER_SORT,
													airDateGte: catalogReleaseFloorUtc,
													genreId: tvFilterGenreId,
												})
										: tvPopularNeedsDiscover
											? await fetchTvDiscover(SEED_PAGE, {
													cookieHeader,
													sortBy: "popularity.desc",
													genreId: tvFilterGenreId,
													monetization:
														tvVenue === "streaming"
															? tvFilterMonetization
															: undefined,
													watchRegion:
														tvVenue === "streaming"
															? streamingWatchRegionApi
															: undefined,
												})
											: sort === "popular"
												? await fetchTvPopular(SEED_PAGE, { cookieHeader })
												: await fetchTvDiscover(SEED_PAGE, {
														cookieHeader,
														sortBy: LATEST_TV_DISCOVER_SORT,
														genreId: tvFilterGenreId,
													})
						: movieLobbyStreamingUpcoming
							? await fetchMoviesDiscover(SEED_PAGE, {
									cookieHeader,
									sortBy: "primary_release_date.asc",
									venue: "streaming",
									monetization: movieFilterMonetization,
									releaseGte: catalogReleaseFloorUtc,
									watchRegion: streamingWatchRegionApi,
									genreId: movieFilterGenreId,
								})
							: movieLobbyTheatersUpcoming
								? movieFilterGenreId
									? await fetchMoviesDiscover(SEED_PAGE, {
											cookieHeader,
											sortBy: "primary_release_date.asc",
											venue: "theaters",
											region: patronCatalogTheatricalRegion,
											genreId: movieFilterGenreId,
										})
									: await fetchMoviesUpcoming(SEED_PAGE, {
											cookieHeader,
											region: patronCatalogTheatricalRegion,
										})
								: movieLobbyStreamingCatalog
									? await fetchMoviesDiscover(SEED_PAGE, {
											cookieHeader,
											sortBy:
												sort === "popular"
													? "popularity.desc"
													: LATEST_DISCOVER_SORT,
											venue: "streaming",
											monetization: movieFilterMonetization,
											watchRegion: streamingWatchRegionApi,
											genreId: movieFilterGenreId,
										})
									: movieLobbyUsesNowPlayingWithGenre
										? await fetchMoviesDiscover(SEED_PAGE, {
												cookieHeader,
												sortBy: "popularity.desc",
												venue: "theaters",
												region: patronCatalogTheatricalRegion,
												genreId: movieFilterGenreId,
											})
										: movieLobbyUsesNowPlaying
											? await fetchMoviesNowPlaying(SEED_PAGE, {
													cookieHeader,
												})
											: movieLobbyTheatersLatestDiscover
												? await fetchMoviesDiscover(SEED_PAGE, {
														cookieHeader,
														sortBy: LATEST_DISCOVER_SORT,
														venue: "theaters",
														region: patronCatalogTheatricalRegion,
														genreId: movieFilterGenreId,
													})
												: sort === "latest"
													? await fetchMoviesDiscover(SEED_PAGE, {
															cookieHeader,
															sortBy: LATEST_DISCOVER_SORT,
															venue:
																movieVenue === "streaming"
																	? "streaming"
																	: "theaters",
															monetization:
																movieVenue === "streaming"
																	? movieFilterMonetization
																	: undefined,
															watchRegion:
																movieVenue === "streaming"
																	? streamingWatchRegionApi
																	: undefined,
															region:
																movieVenue === "theaters"
																	? patronCatalogTheatricalRegion
																	: undefined,
															genreId: movieFilterGenreId,
														})
													: await fetchMoviesNowPlaying(SEED_PAGE, {
															cookieHeader,
														});
			} catch (err) {
				console.error("[home] catalogue fetch failed", err);
				return { data: null, error: { status: 0 } };
			}
		})(),
	]);
```

- [ ] **Step 3: Remove now-duplicate variable declarations below the Promise.all**

The lines that used to sit between the two `await` blocks are now moved above. Find and delete the following block that will now be duplicated (around line 344 in the original, now orphaned after the refactor):

```ts
const profileData =
	profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
const mePrefs = profileData?.preferences ?? null;

const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
const streamingWatchRegionApi =
	catalogWatchRegionToApiQuery(catalogWatchPref);
/** ISO alpha-2 for TMDb **theatrical** `region` ... */
const patronCatalogTheatricalRegion =
	typeof catalogWatchPref === "string" && catalogWatchPref !== "ALL"
		? catalogWatchPref
		: undefined;

/** TV left-rail sort is only Popular or Latest (Upcoming lives on `?run=`). */
const tvLobbySort = sort === "popular" ? "popular" : "latest";

const movieFilterGenreId = catalogFilters.genreId ?? undefined;
const movieFilterMonetization = catalogFilters.monetization ?? "flatrate";
const tvFilterGenreId = catalogFilters.genreId ?? undefined;
const tvFilterMonetization = catalogFilters.monetization ?? "flatrate";
const tvPopularNeedsDiscover = ...
```

Delete everything from `const profileData =` through the end of `const tvPopularNeedsDiscover = ...` (the whole block — it's now above the `Promise.all`).

- [ ] **Step 4: Verify TypeScript is happy**

```bash
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
```

Expected: same baseline errors as before, no new errors. `lobbyResult` now has type `{ data: unknown; error: { status: number; nonJson?: boolean } | null }` which matches what the rest of the file expects.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/home/page.tsx
git commit -m "perf(web): run lobby fetch concurrently with personal rails on home page"
```
