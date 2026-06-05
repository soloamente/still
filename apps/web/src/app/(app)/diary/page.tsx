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
} from "@/lib/diary-lobby-order";
import { fetchMyDiaryServer } from "@/lib/fetch-my-diary-server";
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
	searchParams: Promise<{ tab?: string; order?: string; venue?: string }>;
}) {
	const sp = await searchParams;
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));
	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		isPro?: boolean;
		preferences?: Record<string, unknown> | null;
	} | null;
	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const needsCatalogWatchRegionPrompt = Boolean(
		session && catalogWatchPref === null,
	);

	const stickyUser =
		session && profileData?.handle
			? {
					id: session.user.id,
					name: session.user.name ?? profileData.displayName ?? "You",
					image: session.user.image ?? null,
					handle: profileData.handle,
					email: session.user.email ?? null,
					isPro: Boolean(profileData.isPro),
				}
			: null;

	const order = parseDiaryLobbyOrder(sp?.order ?? null);
	const venue = parseDiaryLobbyVenue(sp?.venue ?? null);
	const endpointOrder = toEndpointOrder(order);

	const explicitTab = parseDiaryLedgerTab(sp?.tab ?? null);
	const firstMedia: "movie" | "tv" = explicitTab === "tv" ? "tv" : "movie";
	let seed = await fetchMyDiaryServer({
		media: firstMedia,
		order: endpointOrder,
		venue,
	});
	// No explicit tab + movies empty but TV has rows → default to TV (matches resolveDiaryLedgerTab).
	let media: "movie" | "tv" = firstMedia;
	if (!explicitTab && seed.tabCounts.movies === 0 && seed.tabCounts.tv > 0) {
		media = "tv";
		seed = await fetchMyDiaryServer({ media, order: endpointOrder, venue });
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
				monochromePeersOnHover={monochromePeersOnHover}
			/>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
