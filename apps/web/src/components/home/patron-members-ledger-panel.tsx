"use client";

import { env } from "@still/env/web";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PatronMembersLedgerSeed } from "@/components/home/patron-members-ledger-drawer";
import { PatronMembersLedgerGrid } from "@/components/home/patron-members-ledger-grid";
import { PatronMembersLedgerOrderChips } from "@/components/home/patron-members-ledger-order-chips";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { leaderboardHandleLinkClassName } from "@/lib/home-leaderboard-interactive";
import {
	leaderboardPeriodLabel,
	readViewerTimeZone,
} from "@/lib/home-leaderboard-period";
import { membersLeaderboardSortLabel } from "@/lib/members-leaderboard";
import type { MembersLeaderboardItemsPayload } from "@/lib/members-leaderboard-item-types";
import {
	DEFAULT_PATRON_MEMBERS_LEDGER_ORDER,
	type PatronMembersLedgerOrder,
	sortPatronMembersLedgerItems,
} from "@/lib/patron-members-ledger-order";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

async function fetchPatronMembersLedger(
	seed: PatronMembersLedgerSeed,
): Promise<MembersLeaderboardItemsPayload | null> {
	const url = new URL(
		`/api/members/leaderboard/${seed.userId}/items`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
	url.searchParams.set("sort", seed.sort);
	url.searchParams.set("period", seed.period);
	url.searchParams.set("tz", readViewerTimeZone());
	const res = await fetch(url.toString(), { credentials: "include" });
	if (!res.ok) return null;
	return (await res.json()) as MembersLeaderboardItemsPayload;
}

/**
 * Scrollable review/list catalogue for one patron — mirrors {@link PatronWatchLedgerPanel}.
 */
export function PatronMembersLedgerPanel({
	seed,
	active,
}: {
	seed: PatronMembersLedgerSeed;
	active: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = `${seed.userId}:${seed.sort}:${seed.period}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		active,
		contentKey,
	);

	const [payload, setPayload] = useState<MembersLeaderboardItemsPayload | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [order, setOrder] = useState<PatronMembersLedgerOrder>(
		DEFAULT_PATRON_MEMBERS_LEDGER_ORDER,
	);

	useEffect(() => {
		if (!active) return;

		let cancelled = false;
		setLoading(true);
		setError(null);
		setPayload(null);
		setOrder(DEFAULT_PATRON_MEMBERS_LEDGER_ORDER);

		void fetchPatronMembersLedger(seed)
			.then((data) => {
				if (cancelled) return;
				if (!data) {
					setError("Could not load contribution log.");
					setPayload(null);
					return;
				}
				setPayload(data);
			})
			.catch(() => {
				if (!cancelled) setError("Could not load contribution log.");
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
		() => sortPatronMembersLedgerItems(items, order),
		[items, order],
	);
	const titleCount = items.length;
	const periodLabel = leaderboardPeriodLabel(seed.period);
	const sortLabel = membersLeaderboardSortLabel(seed.sort);

	return (
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<DetailDrawerScrollBody scrollRef={scrollRef}>
				<div className="mx-auto w-full max-w-4xl">
					<header className="mx-auto mb-8 max-w-md text-center">
						<div className="mx-auto mb-4 flex justify-center">
							<div className="relative aspect-2/3 w-22 sm:w-24">
								<div
									className="pointer-events-none absolute inset-0 rounded-2xl bg-muted/30 shadow-lg"
									aria-hidden
								/>
								<PatronPortraitWithMetalTier
									handle={handle}
									avatarUrl={avatarImage}
									name={displayName}
									className="size-full rounded-2xl"
									isAnimated={inferAnimatedFromProfileUrl(
										avatarImage,
										avatarIsAnimated,
									)}
									diaryMetalTier={diaryMetalTier}
								/>
							</div>
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
						<div className="mt-2 flex flex-col gap-1">
							<p className="text-balance font-editorial text-muted-foreground text-sm leading-snug">
								{periodLabel} · {sortLabel}
							</p>
							{!loading && !error && titleCount > 0 ? (
								<p className="text-muted-foreground text-sm leading-snug">
									{titleCount} {sortLabel.toLowerCase()} contribution
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
						<PatronMembersLedgerOrderChips
							sort={seed.sort}
							order={order}
							onOrderChange={setOrder}
						/>
					) : null}

					{!loading && !error ? (
						<PatronMembersLedgerGrid items={sortedItems} sort={seed.sort} />
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
