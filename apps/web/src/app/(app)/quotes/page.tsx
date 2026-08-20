import type { Metadata } from "next";
import { cache, Suspense } from "react";

import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { QuotesLobbyBrowseLink } from "@/components/quotes/quotes-kind-chips";
import { QuotesLobbyFallback } from "@/components/quotes/quotes-lobby-fallback";
import { QuotesLobbyInfinite } from "@/components/quotes/quotes-lobby-infinite";
import { QuotesPatronLobbyShell } from "@/components/quotes/quotes-patron-lobby-shell";
import { QuotesSubmissionsInfinite } from "@/components/quotes/quotes-submissions-infinite";
import { authServer } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { fetchMyQuoteSubmissionsServer } from "@/lib/fetch-my-quote-submissions-server";
import { fetchMySavedQuotesServer } from "@/lib/fetch-my-saved-quotes-server";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import { readCatalogTmdbWatchRegionPref } from "@/lib/profile-preferences";
import {
	type QuotesLobbyKind,
	type QuotesLobbyView,
	type QuotesSubmissionStatusFilter,
	quotesLobbySearchState,
} from "@/lib/quotes-lobby";
import { quotesLobbyEmptyCopy } from "@/lib/quotes-lobby-empty-copy";
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

function QuotesLobbyEmptyState({
	title,
	body,
	ctaLabel,
}: {
	title: string;
	body: string;
	ctaLabel: string;
}) {
	return (
		<div
			className="flex min-h-[min(40vh,20rem)] flex-1 flex-col items-center justify-center px-4 py-10 text-center"
			role="status"
		>
			<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background px-6 py-12 sm:px-10 sm:py-14">
				<div className="space-y-2">
					<p className="text-balance font-semibold text-foreground text-lg tracking-tight">
						{title}
					</p>
					<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
						{body}
					</p>
				</div>
				<QuotesLobbyBrowseLink label={ctaLabel} />
			</div>
		</div>
	);
}

async function QuotesSavedLobbyData({ kind }: { kind: QuotesLobbyKind }) {
	const page = await fetchMySavedQuotesServer({ kind, page: 1 });
	const emptyCopy = quotesLobbyEmptyCopy({
		view: "saved",
		kind,
		status: "all",
	});

	if (page.items.length === 0) {
		return (
			<QuotesLobbyEmptyState
				title={emptyCopy.title}
				body={emptyCopy.body}
				ctaLabel={emptyCopy.ctaLabel}
			/>
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

async function QuotesSubmittedLobbyData({
	kind,
	status,
}: {
	kind: QuotesLobbyKind;
	status: QuotesSubmissionStatusFilter;
}) {
	const page = await fetchMyQuoteSubmissionsServer({ kind, status, page: 1 });
	const emptyCopy = quotesLobbyEmptyCopy({
		view: "submitted",
		kind,
		status,
	});

	if (page.items.length === 0) {
		return (
			<QuotesLobbyEmptyState
				title={emptyCopy.title}
				body={emptyCopy.body}
				ctaLabel={emptyCopy.ctaLabel}
			/>
		);
	}

	return (
		<QuotesSubmissionsInfinite
			seeds={page.items}
			initialHasMore={page.hasMore}
			kind={kind}
			status={status}
		/>
	);
}

async function QuotesLobbyData({
	view,
	kind,
	status,
}: {
	view: QuotesLobbyView;
	kind: QuotesLobbyKind;
	status: QuotesSubmissionStatusFilter;
}) {
	if (view === "submitted") {
		return <QuotesSubmittedLobbyData kind={kind} status={status} />;
	}
	return <QuotesSavedLobbyData kind={kind} />;
}

export default async function QuotesPage({
	searchParams,
}: {
	searchParams: Promise<{ kind?: string; view?: string; status?: string }>;
}) {
	const sp = await searchParams;
	const { kind, view, status } = quotesLobbySearchState(sp);
	const lobbyKey = `${view}-${kind}-${status}`;

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={null}>
				<QuotesChrome />
			</Suspense>

			<QuotesPatronLobbyShell>
				<Suspense key={lobbyKey} fallback={<QuotesLobbyFallback />}>
					<QuotesLobbyData view={view} kind={kind} status={status} />
				</Suspense>
			</QuotesPatronLobbyShell>
		</div>
	);
}
