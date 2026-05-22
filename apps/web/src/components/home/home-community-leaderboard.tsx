"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";

import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { HomeLeaderboardPodium } from "@/components/home/home-leaderboard-podium";
import { HomeLeaderboardRow } from "@/components/home/home-leaderboard-row";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { fetchCommunityLeaderboard } from "@/lib/still-api-fetch";

/**
 * Community rank feeds — period chips, tier podium, list from #4, optional viewer footer.
 */
export function HomeCommunityLeaderboard({
	feed,
	data: initialData,
	viewerUserId,
}: {
	feed: "film-ranks" | "tv-ranks";
	data: LeaderboardPayload;
	viewerUserId: string | null;
}) {
	const kind = feed === "film-ranks" ? "films" : "tv";
	const [data, setData] = useState(initialData);

	// SSR uses UTC; refetch in the patron's zone so week/month boundaries match local midnight.
	useEffect(() => {
		setData(initialData);
	}, [initialData]);

	useEffect(() => {
		const tz = readViewerTimeZone();
		if (tz === "UTC") return;

		const controller = new AbortController();
		void fetchCommunityLeaderboard(kind, initialData.period, tz, {
			signal: controller.signal,
		}).then((next) => {
			if (next) setData(next);
		});

		return () => controller.abort();
	}, [kind, initialData.period]);

	const rest = data.entries.slice(3);

	if (data.entries.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<HomeCommunityEmpty
					title={
						feed === "film-ranks"
							? "No film logs this period"
							: "No TV logs this period"
					}
					description="When patrons log watches in this window, rankings show up here."
					primaryHref="/home?browse=movies"
					primaryLabel="Browse movies"
					secondaryHref="/diary"
					secondaryLabel="Your diary"
				/>
			</div>
		);
	}

	const viewerInList = viewerUserId
		? data.entries.some((e) => e.userId === viewerUserId)
		: false;
	const showViewerFooter =
		viewerUserId && data.viewer && !viewerInList && data.viewer.count > 0;

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-4">
			<HomeLeaderboardPodium
				entries={data.entries}
				kind={kind}
				period={data.period}
			/>
			{rest.length > 0 ? (
				<ul className="flex flex-col gap-2 rounded-2xl bg-card p-3 sm:p-4">
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
						"flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3 text-sm",
					)}
				>
					<span className="font-medium text-foreground">Your rank</span>
					<span className="text-muted-foreground tabular-nums">
						#{data.viewer.rank} · {data.viewer.count}{" "}
						{kind === "tv" ? "logs" : "films"}
					</span>
				</div>
			) : null}
		</div>
	);
}
