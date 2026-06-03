"use client";

import { env } from "@still/env/web";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PatronWatchLedgerSeed } from "@/components/home/patron-watch-ledger-drawer";
import { PatronWatchLedgerGrid } from "@/components/home/patron-watch-ledger-grid";
import { PatronWatchLedgerOrderChips } from "@/components/home/patron-watch-ledger-order-chips";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import {
	leaderboardPeriodLabel,
	readViewerTimeZone,
} from "@/lib/home-leaderboard-period";
import type { LeaderboardLogsPayload } from "@/lib/home-leaderboard-types";
import {
	type PatronWatchLedgerOrder,
	sortPatronWatchLedgerItems,
} from "@/lib/patron-watch-ledger-order";
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
	const items = payload?.items ?? [];
	const sortedItems = useMemo(
		() => sortPatronWatchLedgerItems(items, order),
		[items, order],
	);
	const titleCount = items.length;
	const periodLabel = leaderboardPeriodLabel(seed.period);
	const kindLabel = seed.kind === "tv" ? "TV" : "Films";

	return (
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<DetailDrawerScrollBody scrollRef={scrollRef}>
				<div className="mx-auto w-full max-w-4xl">
					<header className="mx-auto mb-8 max-w-md text-center">
						<div className="mx-auto mb-4 flex justify-center">
							<div className="relative aspect-2/3 w-22 overflow-hidden rounded-2xl bg-muted/30 shadow-lg sm:w-24">
								<PatronPortraitAvatar
									handle={handle}
									avatarUrl={payload?.user.image ?? seed.image}
									name={displayName}
									className="size-full rounded-2xl"
									width={96}
									height={144}
								/>
							</div>
						</div>
						<h2 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
							{displayName}
						</h2>
						<div className="mt-2 flex flex-col gap-1">
							<p className="text-muted-foreground text-xs">@{handle}</p>
							<p className="text-balance font-editorial text-muted-foreground text-sm leading-snug">
								{periodLabel}
							</p>
							{!loading && !error && titleCount > 0 ? (
								<p className="text-muted-foreground text-sm leading-snug">
									{titleCount} {kindLabel.toLowerCase()} log
									{titleCount === 1 ? "" : "s"} in this period
								</p>
							) : null}
						</div>
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
						<PatronWatchLedgerGrid items={sortedItems} kind={seed.kind} />
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
