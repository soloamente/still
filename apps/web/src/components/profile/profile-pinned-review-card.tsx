"use client";

import { cn } from "@still/ui/lib/utils";
import { Film, Heart, MessageCircle, Tv } from "lucide-react";
import Image from "next/image";
import { ReviewVoiceAttachment } from "@/components/review/review-audio-player";
import type { ReviewCardListing } from "@/components/review/review-card";
import {
	type ReviewPreview,
	useReviewDetail,
} from "@/components/review/review-detail-sheet";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import { isListCoverProxySrc } from "@/lib/list-cover-image";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
import { shouldShowReviewBody } from "@/lib/review-audio-fields";

type ProfilePinnedReview = ReviewPreview & {
	userId?: string;
	listing?: ReviewCardListing;
};

/** Poster column — stretches to the full inner height of the padded card. */
function ProfilePinnedReviewPoster({
	listing,
}: {
	listing: ReviewCardListing;
}) {
	return (
		<div
			className={cn(
				"relative w-20 shrink-0 self-stretch sm:w-24",
				"overflow-hidden rounded-xl bg-muted/20",
				"outline outline-1 outline-black/10 dark:outline-white/10",
			)}
		>
			{listing.posterUrl ? (
				<Image
					src={listing.posterUrl}
					alt={listing.title}
					fill
					sizes="96px"
					className="object-cover"
					unoptimized={isListCoverProxySrc(listing.posterUrl)}
				/>
			) : (
				<div
					className="grid size-full place-items-center bg-soft-stone text-muted-foreground"
					aria-hidden
				>
					{listing.listingKind === "tv" ? (
						<Tv className="size-5 opacity-70" />
					) : (
						<Film className="size-5 opacity-70" />
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Compact signature review row — inset padding with poster filling inner height.
 */
export function ProfilePinnedReviewCard({
	review,
}: {
	review: ProfilePinnedReview;
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const listing = review.listing;
	const showReviewBody = shouldShowReviewBody(review);

	return (
		<button
			type="button"
			className={cn(
				"group flex w-full items-stretch gap-3 rounded-2xl bg-background p-3 text-left sm:gap-3.5 sm:p-3.5",
				"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100",
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
			)}
			aria-haspopup="dialog"
			aria-label={review.title ? `Read review: ${review.title}` : "Read review"}
			onClick={() =>
				openReviewDetail({
					reviewId: review.id,
					preview: {
						id: review.id,
						userId: review.userId,
						title: review.title,
						body: review.body,
						rating: review.rating,
						likesCount: review.likesCount,
						commentsCount: review.commentsCount,
						publishedAt: review.publishedAt,
						audioUrl: review.audioUrl,
						audioDurationMs: review.audioDurationMs,
					},
				})
			}
		>
			{listing ? <ProfilePinnedReviewPoster listing={listing} /> : null}

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<header className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground tabular-nums">
					<time dateTime={review.publishedAt}>
						{formatDistanceToNowStrict(new Date(review.publishedAt))} ago
					</time>
					{review.rating != null ? (
						<span className="font-medium text-foreground">
							{formatStoredLogRatingDisplay(review.rating)}
							<span className="text-muted-foreground">/10</span>
						</span>
					) : null}
				</header>

				{listing ? (
					<p className="truncate text-[11px] text-muted-foreground">
						{listing.title}
					</p>
				) : null}

				{review.title ? (
					<h3 className="line-clamp-2 text-balance font-serif text-foreground text-sm leading-snug tracking-tight transition-colors duration-150 [@media(hover:hover)]:group-hover:text-desert-orange">
						{review.title}
					</h3>
				) : null}

				<ReviewVoiceAttachment
					audioUrl={review.audioUrl}
					audioDurationMs={review.audioDurationMs}
					className="mt-2"
					stopPropagation
				/>

				{showReviewBody ? (
					<p className="line-clamp-2 text-pretty font-editorial text-[11px] text-foreground/75 leading-relaxed">
						{review.body}
					</p>
				) : null}

				<footer className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
					<span className="inline-flex items-center gap-1">
						<Heart className="size-3 opacity-70" aria-hidden />
						{review.likesCount}
					</span>
					<span className="inline-flex items-center gap-1">
						<MessageCircle className="size-3 opacity-70" aria-hidden />
						{review.commentsCount}
					</span>
				</footer>
			</div>
		</button>
	);
}
