import type { Metadata } from "next";
import { cache, Suspense } from "react";

import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { QuotesLobbyBrowseLink } from "@/components/quotes/quotes-kind-chips";
import { QuotesLobbyFallback } from "@/components/quotes/quotes-lobby-fallback";
import { QuotesLobbyInfinite } from "@/components/quotes/quotes-lobby-infinite";
import { QuotesPatronLobbyShell } from "@/components/quotes/quotes-patron-lobby-shell";
import { authServer } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { fetchMySavedQuotesServer } from "@/lib/fetch-my-saved-quotes-server";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import { readCatalogTmdbWatchRegionPref } from "@/lib/profile-preferences";
import { parseQuotesLobbyKind } from "@/lib/quotes-lobby";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Quotes" };
export const dynamic = "force-dynamic";

const loadQuotesChromeContext = cache(async () => {
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));

	const profileData = profileRes.data as Exclude<MeProfile, null> | null;
	const mePrefs = profileData?.preferences ?? null;
	const stickyUser = buildPatronNavUserOrNull(session, profileData);

	return {
		signedIn: Boolean(session),
		stickyUser,
		needsCatalogWatchRegionPrompt: Boolean(
			session && readCatalogTmdbWatchRegionPref(mePrefs) === null,
		),
	};
});

async function QuotesChrome() {
	const { stickyUser, signedIn, needsCatalogWatchRegionPrompt } =
		await loadQuotesChromeContext();
	return (
		<>
			<HomeStickyChrome user={stickyUser} />
			{signedIn ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</>
	);
}

async function QuotesLobbyData({
	kind,
}: {
	kind: ReturnType<typeof parseQuotesLobbyKind>;
}) {
	const page = await fetchMySavedQuotesServer({ kind, page: 1 });

	if (page.items.length === 0) {
		return (
			<div
				className="flex min-h-[min(40vh,20rem)] flex-1 flex-col items-center justify-center px-4 py-10 text-center"
				role="status"
			>
				<p className="text-balance font-sans text-lg">No saved quotes yet</p>
				<p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
					Open a film or show, visit the Quotes tab, and bookmark lines you want
					to keep.
				</p>
				<div className="mt-6">
					<QuotesLobbyBrowseLink />
				</div>
			</div>
		);
	}

	return (
		<QuotesLobbyInfinite
			seeds={page.items}
			initialHasMore={page.hasMore}
			kind={kind}
		/>
	);
}

export default async function QuotesPage({
	searchParams,
}: {
	searchParams: Promise<{ kind?: string }>;
}) {
	const sp = await searchParams;
	const kind = parseQuotesLobbyKind(sp?.kind);

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={null}>
				<QuotesChrome />
			</Suspense>

			<QuotesPatronLobbyShell>
				<header className="mx-auto mb-6 max-w-2xl text-center">
					<h1 className="font-semibold text-foreground text-xl sm:text-2xl">
						Your quotes
					</h1>
					<p className="mt-2 text-pretty font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
						Lines you saved from film and TV detail pages — newest first.
					</p>
				</header>

				<Suspense fallback={<QuotesLobbyFallback />}>
					<QuotesLobbyData kind={kind} />
				</Suspense>
			</QuotesPatronLobbyShell>
		</div>
	);
}
