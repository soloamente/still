"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import { FeedPersonAvatar } from "@/components/feed/feed-person-avatar";
import { openRecommendBackSheet } from "@/components/recommend/recommend-back-sheet-root";
import { openInviteEarnDialog } from "@/components/referrals/invite-earn-dialog-root";
import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	TODAY_CARD_ACTION_CLASSNAME,
	TODAY_CARD_HEADING_CLASSNAME,
	TODAY_SUPPORTING_CARD_CLASSNAME,
} from "@/lib/today-card-layout";
import {
	type TodayCircleActivity,
	type TodayCirclePayload,
	todayCircleActionLabel,
	todayCircleTitleHref,
} from "@/lib/today-circle";

/**
 * Today "From your circle" — one recent visible watch from someone the viewer
 * follows, or an invite when there is nothing honest to show.
 */
export function TodayCircleCard({
	payload,
}: {
	/** `null` = the read failed — quiet error, not a fake invite or activity. */
	payload: TodayCirclePayload | null;
}) {
	const headingId = useId();

	return (
		<section
			className={TODAY_SUPPORTING_CARD_CLASSNAME}
			aria-labelledby={headingId}
		>
			<h3 id={headingId} className={TODAY_CARD_HEADING_CLASSNAME}>
				From your circle
			</h3>
			{payload == null ? (
				<p className="text-muted-foreground text-sm">
					Couldn’t load activity from people you follow right now.
				</p>
			) : payload.kind === "activity" ? (
				<TodayCircleActivityBody activity={payload} />
			) : (
				<>
					<p className="text-balance font-semibold text-foreground text-lg leading-snug tracking-tight">
						Invite someone who knows what you’d love.
					</p>
					<button
						type="button"
						className={TODAY_CARD_ACTION_CLASSNAME}
						onClick={openInviteEarnDialog}
					>
						Invite a friend
					</button>
				</>
			)}
		</section>
	);
}

function TodayCircleActivityBody({
	activity,
}: {
	activity: TodayCircleActivity;
}) {
	const { actor, title } = activity;
	/** Title just sent from this card — the action swaps to a quiet confirmation. */
	const [sentTitle, setSentTitle] = useState<string | null>(null);

	function handleRecommendBack() {
		openRecommendBackSheet(
			{ recipientUserId: actor.userId, recipientName: actor.displayName },
			(pick) => setSentTitle(pick.title),
		);
	}
	const titleHref = todayCircleTitleHref(title);
	const posterUrl = tmdbPosterUrlFromPath(title.posterPath, "w185");

	return (
		<>
			<div className="flex min-w-0 items-start gap-3">
				<Link
					href={titleHref}
					className="relative block aspect-2/3 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/30"
					aria-label={posterUrl ? title.name : `${title.name} (no poster)`}
				>
					{posterUrl ? (
						<Image
							src={posterUrl}
							alt={`${title.name} poster`}
							fill
							sizes="56px"
							className="object-cover"
							unoptimized={isTmdbCdnUrl(posterUrl)}
						/>
					) : null}
				</Link>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex min-w-0 items-center gap-2">
						<FeedPersonAvatar
							size="xs"
							person={{
								user: {
									id: actor.userId,
									name: actor.displayName,
									image: actor.image,
								},
								profile: {
									handle: actor.handle,
									displayName: actor.displayName,
									planTier: actor.planTier,
									staffRole: actor.staffRole,
								},
							}}
						/>
						<Link
							href={`/profile/${actor.handle}`}
							className="truncate font-medium text-foreground text-sm [@media(hover:hover)]:hover:underline"
						>
							{actor.displayName}
						</Link>
					</div>
					<Link
						href={titleHref}
						className="truncate font-semibold text-foreground leading-snug [@media(hover:hover)]:hover:underline"
					>
						{title.name}
					</Link>
					<p className="text-muted-foreground text-sm tabular-nums">
						{todayCircleActionLabel(activity)}
					</p>
					{activity.excerpt ? (
						<p className="line-clamp-2 text-pretty text-muted-foreground text-sm">
							“{activity.excerpt}”
						</p>
					) : null}
				</div>
			</div>
			<div className="mt-auto" aria-live="polite">
				{sentTitle ? (
					<p className="inline-flex min-h-10 items-center gap-2 font-medium text-foreground text-sm">
						<Check className="size-4 shrink-0" aria-hidden />
						Recommendation sent
						<span className="sr-only">
							{`: ${sentTitle} to ${actor.displayName}`}
						</span>
					</p>
				) : (
					<button
						type="button"
						className={TODAY_CARD_ACTION_CLASSNAME}
						onClick={handleRecommendBack}
					>
						Recommend back
					</button>
				)}
			</div>
		</>
	);
}
