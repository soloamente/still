"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronRight, Heart, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import { DiaryLogRatingLabel } from "@/components/diary/diary-log-rating-label";
import { FeedActivityVerb } from "@/components/feed/feed-activity-kind-badge";
import { FeedListingThumb } from "@/components/feed/feed-listing-thumb";
import {
	type FeedPerson,
	FeedPersonAvatar,
} from "@/components/feed/feed-person-avatar";
import { ReviewActivityCopy } from "@/components/feed/review-activity-copy";
import { ReviewVoiceAttachment } from "@/components/review/review-audio-player";
import {
	useReviewDetail,
	useReviewEngagementCounts,
} from "@/components/review/review-detail-sheet";
import {
	COMMUNITY_FEED_BYLINE_CLASS,
	COMMUNITY_FEED_META_PILL_CLASS,
	COMMUNITY_FEED_META_PILL_ROW_CLASS,
	COMMUNITY_FEED_ROW_BODY_CLASS,
	COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS,
	COMMUNITY_FEED_ROW_COPY_STACK_CLASS,
	COMMUNITY_FEED_ROW_PRESSABLE_CLASS,
} from "@/lib/community-feed-row-layout";
import { formatTimeAgoLabel } from "@/lib/format";
import type { HomeCommunityReviewRow } from "@/lib/home-community-core-fetch";
import { shouldShowReviewBody } from "@/lib/review-audio-fields";

function reviewRowToFeedPerson(review: HomeCommunityReviewRow): FeedPerson {
	const author = review.author;
	return {
		user: author
			? {
					id: author.userId,
					name: author.name,
					image: author.image,
				}
			: null,
		profile: author
			? {
					handle: author.handle,
					displayName: author.name,
					avatarIsAnimated: author.avatarIsAnimated,
				}
			: null,
	};
}

function CommunityFeedStatPill({ children }: { children: ReactNode }) {
	return <span className={COMMUNITY_FEED_META_PILL_CLASS}>{children}</span>;
}

/**
 * Community reviews feed tile — stacked patron row + poster/copy body with stat pills.
 */
export function CommunityReviewFeedRow({
	review,
}: {
	review: HomeCommunityReviewRow;
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const { likesCount, commentsCount } = useReviewEngagementCounts(review.id, {
		likesCount: review.likesCount,
		commentsCount: review.commentsCount,
	});
	const listing = review.listing;
	const showReviewBody = shouldShowReviewBody(review);
	const person = reviewRowToFeedPerson(review);
	const patronName =
		person.profile?.displayName ?? person.user?.name ?? "Member";
	const patronHandle = person.profile?.handle;

	const open = () =>
		openReviewDetail({
			reviewId: review.id,
			preview: {
				id: review.id,
				userId: review.userId,
				title: review.title,
				body: review.body,
				rating: review.rating,
				likesCount,
				commentsCount,
				publishedAt: review.publishedAt,
				containsSpoilers: review.containsSpoilers,
				audioUrl: review.audioUrl,
				audioDurationMs: review.audioDurationMs,
			},
		});

	return (
		<button
			type="button"
			className={COMMUNITY_FEED_ROW_PRESSABLE_CLASS}
			aria-haspopup="dialog"
			aria-label={review.title ? `Read review: ${review.title}` : "Read review"}
			onClick={open}
		>
			<div className={COMMUNITY_FEED_BYLINE_CLASS}>
				<FeedPersonAvatar person={person} size="sm" />
				<p className="min-w-0 flex-1 text-pretty text-sm leading-snug">
					<span className="font-semibold text-foreground">{patronName}</span>
					{patronHandle ? (
						<span className="text-muted-foreground"> @{patronHandle}</span>
					) : null}
					<span className="text-muted-foreground"> · </span>
					<FeedActivityVerb kind="review" />
					<span className="text-muted-foreground"> · </span>
					<time
						dateTime={review.publishedAt}
						className="text-muted-foreground tabular-nums"
					>
						{formatTimeAgoLabel(review.publishedAt)}
					</time>
				</p>
			</div>

			<div className={COMMUNITY_FEED_ROW_BODY_CLASS}>
				{listing ? (
					<FeedListingThumb
						layout="activity"
						title={listing.title}
						posterUrl={listing.posterUrl}
						href={listing.href}
						listingKind={listing.listingKind}
						linkable={false}
					/>
				) : null}
				<div className={COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS}>
					<div className={COMMUNITY_FEED_ROW_COPY_STACK_CLASS}>
						{listing ? (
							<p className="text-balance font-serif text-foreground text-xl leading-snug tracking-tight sm:text-[1.35rem]">
								{listing.title}
							</p>
						) : null}
						<ReviewActivityCopy
							containsSpoilers={review.containsSpoilers}
							movieId={review.movieId}
							reviewUserId={review.userId}
							title={review.title}
							body={showReviewBody ? review.body : ""}
						/>
						<ReviewVoiceAttachment
							audioUrl={review.audioUrl}
							audioDurationMs={review.audioDurationMs}
							stopPropagation
						/>
					</div>
					<div className={COMMUNITY_FEED_META_PILL_ROW_CLASS}>
						<CommunityFeedStatPill>
							<DiaryLogRatingLabel stored={review.rating} />
						</CommunityFeedStatPill>
						<CommunityFeedStatPill>
							<Heart className="size-3.5 opacity-80" aria-hidden />
							{likesCount}
						</CommunityFeedStatPill>
						<CommunityFeedStatPill>
							<MessageCircle className="size-3.5 opacity-80" aria-hidden />
							{commentsCount}
						</CommunityFeedStatPill>
						<span
							className={cn(
								COMMUNITY_FEED_META_PILL_CLASS,
								"font-medium text-foreground",
							)}
						>
							Read review
							<ChevronRight className="size-3.5 opacity-70" aria-hidden />
						</span>
					</div>
				</div>
			</div>
		</button>
	);
}
