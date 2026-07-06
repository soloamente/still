"use client";

import { env } from "@still/env/web";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PatronWatchLedgerSeed } from "@/components/home/patron-watch-ledger-drawer";
import { PatronWatchLedgerGrid } from "@/components/home/patron-watch-ledger-grid";
import { PatronWatchLedgerOrderChips } from "@/components/home/patron-watch-ledger-order-chips";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { leaderboardHandleLinkClassName } from "@/lib/home-leaderboard-interactive";
import {
	leaderboardWatchLedgerSummaryLabel,
	readViewerTimeZone,
} from "@/lib/home-leaderboard-period";
import type { LeaderboardLogsPayload } from "@/lib/home-leaderboard-types";
import {
	type PatronWatchLedgerOrder,
	sortPatronWatchLedgerItems,
} from "@/lib/patron-watch-ledger-order";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

async function fetchPatronWatchLedger(
	seed: PatronWatchLedgerSeed,
): Promise<LeaderboardLogsPayload | null> {
	const base =
		seed.kind === "films"
			? `/api/leaderboard/films/${seed.userId}/logs`
			: `/api/leaderboard/tv/${seed.userId}/logs`;
	const url = new URL(base, env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("period", seed.period);
	url.searchParams.set("tz", readViewerTimeZone());
	const res = await fetch(url.toString(), { credentials: "include" });
	if (!res.ok) return null;
	return (await res.json()) as LeaderboardLogsPayload;
}

/**
 * Scrollable watch catalogue for one patron — mirrors {@link PersonFilmographyPanel}.
 */
export function PatronWatchLedgerPanel({
	seed,
	active,
}: {
	seed: PatronWatchLedgerSeed;
	active: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = `${seed.userId}:${seed.kind}:${seed.period}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		active,
		contentKey,
	);

	const [payload, setPayload] = useState<LeaderboardLogsPayload | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [order, setOrder] = useState<PatronWatchLedgerOrder>("latest_seen");

	useEffect(() => {
		if (!active) return;

		let cancelled = false;
		setLoading(true);
		setError(null);
		setPayload(null);
		setOrder("latest_seen");

		void fetchPatronWatchLedger(seed)
			.then((data) => {
				if (cancelled) return;
				if (!data) {
					setError("Could not load watch log.");
					setPayload(null);
					return;
				}
				setPayload(data);
			})
			.catch(() => {
				if (!cancelled) setError("Could not load watch log.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [active, seed]);

	const displayName = payload?.user.displayName ?? seed.displayName;
	const handle = payload?.user.handle ?? seed.handle;
	const avatarImage = payload?.user.image ?? seed.image;
	const avatarIsAnimated =
		payload?.user.avatarIsAnimated ?? seed.avatarIsAnimated;
	const diaryMetalTier =
		payload?.user.diaryMetalTier ?? seed.diaryMetalTier ?? null;
	const items = payload?.items ?? [];
	const sortedItems = useMemo(
		() => sortPatronWatchLedgerItems(items, order),
		[items, order],
	);
	const hiddenCount = payload?.hiddenCount ?? 0;
	const titleCount = items.length + hiddenCount;

	return (
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<DetailDrawerScrollBody scrollRef={scrollRef}>
				<div className="mx-auto w-full max-w-4xl">
					<header className="mx-auto mb-8 max-w-md text-center">
						<div className="mx-auto mb-2 flex justify-center">
							<Link
								href={`/profile/${handle}`}
								className="relative overflow-visible rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
								title={`Open @${handle}'s profile`}
							>
								<PatronPortraitWithMetalTier
									handle={handle}
									avatarUrl={avatarImage}
									name={displayName}
									className="size-24 rounded-full bg-card object-cover sm:size-28"
									width={112}
									height={112}
									isAnimated={inferAnimatedFromProfileUrl(
										avatarImage,
										avatarIsAnimated,
									)}
									diaryMetalTier={diaryMetalTier}
								/>
							</Link>
						</div>
						<div className="flex flex-col items-center">
							<h2 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
								{displayName}
							</h2>
							<Link
								href={`/profile/${handle}`}
								className={leaderboardHandleLinkClassName(
									"mt-0.5 max-w-full truncate text-xs",
								)}
								title={`Open @${handle}'s profile`}
							>
								@{handle}
							</Link>
						</div>
						{!loading && !error && titleCount > 0 ? (
							<p className="mt-1.5 text-balance font-editorial text-muted-foreground text-sm leading-snug">
								{leaderboardWatchLedgerSummaryLabel(
									titleCount,
									seed.kind,
									seed.period,
								)}
							</p>
						) : null}
					</header>

					{loading ? (
						<div
							className="flex justify-center py-16"
							role="status"
							aria-live="polite"
						>
							<Loader2 className="size-8 animate-spin text-muted-foreground" />
						</div>
					) : null}

					{error ? (
						<p
							className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
							role="alert"
						>
							{error}
						</p>
					) : null}

					{!loading && !error && sortedItems.length > 0 ? (
						<PatronWatchLedgerOrderChips
							order={order}
							onOrderChange={setOrder}
						/>
					) : null}

					{!loading && !error ? (
						<PatronWatchLedgerGrid
							items={sortedItems}
							kind={seed.kind}
							period={seed.period}
							hiddenCount={payload?.hiddenCount ?? 0}
						/>
					) : null}
				</div>
			</DetailDrawerScrollBody>
			<SheetScrollScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
				footerTone="filmography"
			/>
		</div>
	);
}
