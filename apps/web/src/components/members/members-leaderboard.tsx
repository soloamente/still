"use client";

import { Button } from "@still/ui/components/button";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { MembersLeaderboardPodium } from "@/components/members/members-leaderboard-podium";
import { MembersLeaderboardRow } from "@/components/members/members-leaderboard-row";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import { membersLeaderboardSortLabel } from "@/lib/members-leaderboard";
import type {
	MembersLeaderboardPayload,
	MembersLeaderboardSort,
} from "@/lib/members-leaderboard-types";
import { fetchMembersLeaderboard } from "@/lib/still-api-fetch";

/**
 * Community Ranks patron slices — tier podium for top 3, list from #4, follow on rows.
 */
export function MembersLeaderboard({
	initialData,
	memberSort,
	period,
	viewerUserId,
}: {
	initialData: MembersLeaderboardPayload | null;
	memberSort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	viewerUserId: string | null;
}) {
	const [data, setData] = useState(initialData);
	const [loadingMore, setLoadingMore] = useState(false);

	useEffect(() => {
		setData(initialData);
	}, [initialData]);

	// SSR uses UTC; refetch in the patron's zone so week/month boundaries match local midnight.
	useEffect(() => {
		const tz = readViewerTimeZone();
		if (tz === "UTC") return;

		const controller = new AbortController();
		void (async () => {
			try {
				const next = await fetchMembersLeaderboard(memberSort, period, {
					tz,
					page: 1,
					limit: initialData?.limit,
					signal: controller.signal,
				});
				if (controller.signal.aborted) return;
				if (next) setData(next);
			} catch (err) {
				if (
					controller.signal.aborted ||
					(err instanceof DOMException && err.name === "AbortError") ||
					(err instanceof Error && err.name === "AbortError")
				) {
					return;
				}
				console.error("[members-leaderboard] tz refetch failed", err);
			}
		})();

		return () => controller.abort();
	}, [memberSort, period, initialData?.limit]);

	const items = data?.items ?? [];
	const nextPage = data?.nextPage ?? null;
	const sortLabel = membersLeaderboardSortLabel(memberSort);
	const podiumItems = items.slice(0, 3);
	const rest = items.slice(3);

	async function handleLoadMore() {
		if (!nextPage || loadingMore) return;
		setLoadingMore(true);
		try {
			const tz = readViewerTimeZone();
			const pagePayload = await fetchMembersLeaderboard(memberSort, period, {
				tz: tz === "UTC" ? undefined : tz,
				page: nextPage,
				limit: data?.limit,
			});
			if (!pagePayload) return;
			setData((prev) => {
				if (!prev) return pagePayload;
				return {
					...pagePayload,
					items: [...prev.items, ...pagePayload.items],
				};
			});
		} catch (err) {
			console.error("[members-leaderboard] load more failed", err);
		} finally {
			setLoadingMore(false);
		}
	}

	if (items.length === 0) {
		return (
			<HomeCommunityEmpty
				title={`No members ranked by ${sortLabel.toLowerCase()}`}
				description="When patrons contribute in this window, the directory fills in here."
				primaryHref={buildHomeLobbyHref({
					browse: "community",
					sort: "reviews",
					period,
				})}
				primaryLabel="Browse reviews"
				secondaryHref={buildHomeLobbyHref({
					browse: "movies",
					sort: "popular",
				})}
				secondaryLabel="Browse films"
			/>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-4">
			<MembersLeaderboardPodium
				items={podiumItems}
				sort={memberSort}
				period={period}
			/>
			{rest.length > 0 ? (
				<ul className="flex flex-col gap-2 rounded-2xl bg-card p-3 sm:p-4">
					{rest.map((entry) => (
						<MembersLeaderboardRow
							key={entry.userId}
							entry={entry}
							sort={memberSort}
							period={period}
							viewerUserId={viewerUserId}
						/>
					))}
				</ul>
			) : null}
			{nextPage ? (
				<div className="flex justify-center pb-2">
					<Button
						type="button"
						variant="ghost-light"
						size="pill"
						disabled={loadingMore}
						onClick={() => void handleLoadMore()}
					>
						{loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
						Load more
					</Button>
				</div>
			) : null}
		</div>
	);
}
