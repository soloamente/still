import type { Metadata } from "next";
import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import { DiaryPatronLobbyShell } from "@/components/diary/diary-patron-lobby-shell";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { authServer } from "@/lib/auth-server";
import { fetchMyLogsMeServer } from "@/lib/fetch-my-logs-me-server";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Diary" };
export const dynamic = "force-dynamic";

export default async function DiaryPage() {
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const [raw, profileRes] = await Promise.all([
		fetchMyLogsMeServer(api),
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);
	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
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
				}
			: null;

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<DiaryPatronLobbyShell
				rawRows={raw}
				monochromePeersOnHover={monochromePeersOnHover}
				signedIn={Boolean(session)}
			/>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
