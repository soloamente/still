"use client";

import { cn } from "@still/ui/lib/utils";

import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { HomeLeaderboardPodium } from "@/components/home/home-leaderboard-podium";
import { HomeLeaderboardRow } from "@/components/home/home-leaderboard-row";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";

/**
 * Community rank feeds — period chips, tier podium, list from #4, optional viewer footer.
 */
export function HomeCommunityLeaderboard({
	kind,
	data,
	viewerUserId,
}: {
	kind: "films" | "tv";
	data: LeaderboardPayload;
	viewerUserId: string | null;
}) {
	const rest = data.entries.slice(3);

	if (data.entries.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<HomeCommunityEmpty
					title={
						kind === "films"
							? "No film logs this period"
							: "No show logs this period"
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
