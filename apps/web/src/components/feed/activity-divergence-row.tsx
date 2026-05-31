"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { ACTIVITY_ROW_CLASS } from "@/components/feed/activity-item";
import { FeedListingThumb } from "@/components/feed/feed-listing-thumb";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import type { FeedRatingDivergencePayload } from "@/lib/feed-rating-divergence";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

function patronHandle(
	profile: FeedRatingDivergencePayload["lowPatron"]["profile"],
	user: FeedRatingDivergencePayload["lowPatron"]["user"],
): string {
	return profile?.handle ?? user.id;
}

function patronName(
	profile: FeedRatingDivergencePayload["lowPatron"]["profile"],
	user: FeedRatingDivergencePayload["lowPatron"]["user"],
): string {
	return profile?.displayName ?? user.name ?? "Someone";
}

function PatronScoreLink({
	patron,
}: {
	patron: FeedRatingDivergencePayload["lowPatron"];
}) {
	const handle = patronHandle(patron.profile, patron.user);
	return (
		<Link
			href={`/profile/${handle}`}
			className="font-medium text-foreground hover:underline"
		>
			{patronName(patron.profile, patron.user)}
		</Link>
	);
}

/**
 * ST.5 — inline Activity row when followed patrons disagree on a rating (Δ ≥ 4.0).
 */
export function ActivityDivergenceRow({
	payload,
}: {
	payload: FeedRatingDivergencePayload;
}) {
	const openQuickLog = useQuickLog((s) => s.open);
	const isTv = payload.mediaKind === "tv" && payload.tvId != null;
	const detailHref = isTv
		? `/tv/${payload.tvId}`
		: payload.movieId != null
			? `/movies/${payload.movieId}`
			: null;
	const posterUrl = tmdbPosterUrlFromPath(payload.posterPath, "w185");

	const handleWeighIn = () => {
		if (isTv && payload.tvId != null) {
			openQuickLog({
				tvId: payload.tvId,
				movieTitle: payload.title,
				posterUrl,
			});
			return;
		}
		if (payload.movieId != null) {
			openQuickLog({
				movieId: payload.movieId,
				movieTitle: payload.title,
				posterUrl,
			});
		}
	};

	return (
		<article className={ACTIVITY_ROW_CLASS}>
			<FeedListingThumb
				layout="activity"
				title={payload.title}
				posterUrl={posterUrl}
				href={detailHref ?? undefined}
				listingKind={isTv ? "tv" : "movie"}
				linkable={Boolean(detailHref)}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<p className="text-pretty text-muted-foreground text-sm leading-snug">
					<span className="font-medium text-foreground">
						Your circle split on this one
					</span>
					<span className="text-muted-foreground">
						{" "}
						— same title, very different scores.
					</span>
				</p>
				{detailHref ? (
					<Link
						href={detailHref}
						className="text-balance font-serif text-foreground text-lg leading-snug tracking-tight transition-colors duration-150 [@media(hover:hover)]:group-hover:text-desert-orange"
					>
						{payload.title}
					</Link>
				) : (
					<p className="text-balance font-serif text-foreground text-lg leading-snug tracking-tight">
						{payload.title}
					</p>
				)}
				<p className="text-pretty text-foreground/85 text-sm leading-relaxed">
					<PatronScoreLink patron={payload.lowPatron} />
					<span className="text-muted-foreground"> rated </span>
					<span className="font-medium text-foreground tabular-nums">
						{formatLogRatingDisplay(payload.lowPatron.displayRating)}
					</span>
					<span className="text-muted-foreground"> · </span>
					<PatronScoreLink patron={payload.highPatron} />
					<span className="text-muted-foreground"> rated </span>
					<span className="font-medium text-foreground tabular-nums">
						{formatLogRatingDisplay(payload.highPatron.displayRating)}
					</span>
					<span className="text-muted-foreground tabular-nums">
						{" "}
						(Δ {formatLogRatingDisplay(payload.delta)})
					</span>
				</p>
				<div className="flex flex-wrap items-center gap-2 pt-0.5">
					<Button
						type="button"
						size="sm"
						className={cn(
							"h-9 rounded-full px-4 font-medium text-sm",
							"bg-background text-foreground",
							"[@media(hover:hover)]:hover:bg-foreground/8",
						)}
						onClick={handleWeighIn}
					>
						Weigh in
					</Button>
					{detailHref ? (
						<Link
							href={detailHref}
							className="font-medium text-muted-foreground text-sm transition-colors duration-150 [@media(hover:hover)]:hover:text-foreground"
						>
							Open title
						</Link>
					) : null}
				</div>
			</div>
		</article>
	);
}
