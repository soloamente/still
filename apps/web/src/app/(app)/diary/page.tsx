import type { Metadata } from "next";
import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import { DiaryPatronLobbyShell } from "@/components/diary/diary-patron-lobby-shell";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { authServer } from "@/lib/auth-server";
import {
	parseDiaryLedgerTab,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
	parseDiaryWatchDecade,
	parseDiaryWatchYear,
} from "@/lib/diary-lobby-order";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { fetchMyDiaryServer } from "@/lib/fetch-my-diary-server";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Diary" };
export const dynamic = "force-dynamic";

function toEndpointOrder(
	o: ReturnType<typeof parseDiaryLobbyOrder>,
): "latest" | "earliest" | "title" {
	return o === "earliest_seen"
		? "earliest"
		: o === "title_az"
			? "title"
			: "latest";
}

export default async function DiaryPage({
	searchParams,
}: {
	searchParams: Promise<{
		tab?: string;
		order?: string;
		venue?: string;
		year?: string;
		decade?: string;
	}>;
}) {
	const sp = await searchParams;
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));
	const profileData = profileRes.data as Exclude<MeProfile, null> | null;
	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const needsCatalogWatchRegionPrompt = Boolean(
		session && catalogWatchPref === null,
	);

	const stickyUser = buildPatronNavUserOrNull(session, profileData);

	const order = parseDiaryLobbyOrder(sp?.order ?? null);
	const venue = parseDiaryLobbyVenue(sp?.venue ?? null);
	const watchYear = parseDiaryWatchYear(sp?.year ?? null);
	const watchDecade =
		watchYear != null ? null : parseDiaryWatchDecade(sp?.decade ?? null);
	const endpointOrder = toEndpointOrder(order);

	const explicitTab = parseDiaryLedgerTab(sp?.tab ?? null);
	const firstMedia: "movie" | "tv" = explicitTab === "tv" ? "tv" : "movie";
	const diaryQuery = {
		order: endpointOrder,
		venue,
		year: watchYear,
		decade: watchDecade,
	} as const;
	let seed = await fetchMyDiaryServer({
		media: firstMedia,
		...diaryQuery,
	});
	// No explicit tab + movies empty but TV has rows → default to TV (matches resolveDiaryLedgerTab).
	let media: "movie" | "tv" = firstMedia;
	if (!explicitTab && seed.tabCounts.movies === 0 && seed.tabCounts.tv > 0) {
		media = "tv";
		seed = await fetchMyDiaryServer({ media, ...diaryQuery });
	}

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<DiaryPatronLobbyShell
				seed={seed}
				media={media}
				endpointOrder={endpointOrder}
				venue={venue}
				watchYear={watchYear}
				watchDecade={watchDecade}
				monochromePeersOnHover={monochromePeersOnHover}
			/>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
