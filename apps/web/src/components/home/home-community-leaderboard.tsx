"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { HomeLeaderboardPodium } from "@/components/home/home-leaderboard-podium";
import { HomeLeaderboardRow } from "@/components/home/home-leaderboard-row";
import { APP_NAME } from "@/lib/app-brand";
import { HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME } from "@/lib/home-community-lobby-layout";
import {
	HOME_COMMUNITY_RANKS_COLUMN_CLASSNAME,
	HOME_COMMUNITY_RANKS_LIST_CLASSNAME,
	HOME_COMMUNITY_RANKS_ROW_CLASSNAME,
	HOME_COMMUNITY_RANKS_VIEWER_ROW_CLASSNAME,
} from "@/lib/home-community-ranks-layout";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import type {
	LeaderboardKind,
	LeaderboardPayload,
} from "@/lib/home-leaderboard-types";
import { leaderboardKindCountLabel } from "@/lib/leaderboard-kind-labels";
import { fetchCommunityLeaderboard } from "@/lib/still-api-fetch";

/**
 * Community rank feeds — tier podium, flat list from #4, optional viewer footer.
 * Includes every public profile (zero-log patrons appear with count 0).
 */
export function HomeCommunityLeaderboard({
	kind,
	data: initialData,
	viewerUserId,
}: {
	kind: LeaderboardKind;
	data: LeaderboardPayload;
	viewerUserId: string | null;
}) {
	const [data, setData] = useState(initialData);
	const [loadingMore, setLoadingMore] = useState(false);

	useEffect(() => {
		setData(initialData);
	}, [initialData]);

	const entries = data.entries;
	const rest = entries.slice(3);
	const nextPage = data.nextPage;

	async function handleLoadMore() {
		if (!nextPage || loadingMore) return;
		setLoadingMore(true);
		try {
			const tz = readViewerTimeZone();
			const pagePayload = await fetchCommunityLeaderboard(
				kind,
				data.period,
				tz,
				{ page: nextPage, limit: data.limit },
			);
			if (!pagePayload) return;
			setData((prev) => ({
				...pagePayload,
				entries: [...prev.entries, ...pagePayload.entries],
			}));
		} catch (err) {
			console.error("[home-community-leaderboard] load more failed", err);
		} finally {
			setLoadingMore(false);
		}
	}

	if (entries.length === 0) {
		return (
			<div className={HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME}>
				<HomeCommunityEmpty
					title="No public profiles yet"
					description="Public profiles appear here with a rank from public diary logs in this period — private profiles are never listed."
					primaryHref="/home?browse=movies"
					primaryLabel="Browse movies"
					secondaryHref="/sign-up"
					secondaryLabel={`Join ${APP_NAME}`}
				/>
			</div>
		);
	}

	const viewerInList = viewerUserId
		? entries.some((e) => e.userId === viewerUserId)
		: false;
	// Show footer when the signed-in patron is public but not on the loaded page slice.
	const showViewerFooter = viewerUserId && data.viewer && !viewerInList;

	return (
		<div className={HOME_COMMUNITY_RANKS_COLUMN_CLASSNAME}>
			<HomeLeaderboardPodium
				entries={entries}
				kind={kind}
				period={data.period}
			/>
			{rest.length > 0 ? (
				<ul className={HOME_COMMUNITY_RANKS_LIST_CLASSNAME}>
					{rest.map((entry) => (
						<HomeLeaderboardRow
							key={entry.userId}
							entry={entry}
							kind={kind}
							period={data.period}
							isViewer={entry.userId === viewerUserId}
						/>
					))}
				</ul>
			) : null}
			{showViewerFooter && data.viewer ? (
				<div
					className={cn(
						HOME_COMMUNITY_RANKS_ROW_CLASSNAME,
						HOME_COMMUNITY_RANKS_VIEWER_ROW_CLASSNAME,
						"justify-between",
					)}
				>
					<span className="font-semibold text-foreground text-sm">
						Your rank
					</span>
					<span className="text-muted-foreground text-sm tabular-nums">
						#{data.viewer.rank} · {data.viewer.count}{" "}
						{leaderboardKindCountLabel(kind, data.viewer.count)}
					</span>
				</div>
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
