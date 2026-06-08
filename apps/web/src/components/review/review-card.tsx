"use client";

import { cn } from "@still/ui/lib/utils";
import { Heart, MessageCircle } from "lucide-react";
import { useState } from "react";
import { FeedListingThumb } from "@/components/feed/feed-listing-thumb";
import { ReviewBodyWithMentions } from "@/components/review/review-body-with-mentions";
import {
	type ReviewPreview,
	useReviewDetail,
	useReviewEngagementCounts,
} from "@/components/review/review-detail-sheet";
import { StaffContentActions } from "@/components/staff/staff-content-actions";
import { authClient } from "@/lib/auth-client";
import { formatDistanceToNowStrict } from "@/lib/format";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

/** Film or series shown beside review copy on community surfaces. */
export type ReviewCardListing = {
	title: string;
	posterUrl: string | null;
	href: string;
	listingKind?: "movie" | "tv";
};

type Review = ReviewPreview & {
	userId: string;
	movieId: number;
	listing?: ReviewCardListing;
};

/** Single-surface tile — matches film detail community cards on `bg-card`. */
export const REVIEW_CARD_CLASS =
	"block w-full rounded-2xl bg-background p-5 text-left";

/**
 * Public review preview card. Body is clamped — tapping opens the bottom
 * review reader sheet (comments + reactions) instead of leaving the page.
 */
export function ReviewCard({ review }: { review: Review }) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const { likesCount, commentsCount } = useReviewEngagementCounts(review.id, {
		likesCount: review.likesCount,
		commentsCount: review.commentsCount,
	});
	const { data: session } = authClient.useSession();
	const viewerRole = session?.user?.role ?? "user";
	const listing = review.listing;
	// Local in-session feedback: once a staff member hides/deletes the review,
	// drop it from view (matches next-reload behavior — removed reviews are
	// filtered from public reads). Declared with the other hooks; early-return
	// below runs only after all hooks have been called.
	const [hidden, setHidden] = useState(false);
	if (hidden) return null;

	return (
		<>
			<button
				type="button"
				className={cn(
					REVIEW_CARD_CLASS,
					"group flex cursor-pointer gap-4 transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100",
					listing ? "items-stretch" : "flex-col",
				)}
				aria-haspopup="dialog"
				aria-label={
					review.title ? `Read review: ${review.title}` : "Read review"
				}
				onClick={() =>
					openReviewDetail({
						reviewId: review.id,
						preview: {
							id: review.id,
							title: review.title,
							body: review.body,
							rating: review.rating,
							likesCount: likesCount,
							commentsCount: commentsCount,
							publishedAt: review.publishedAt,
						},
					})
				}
			>
				{listing ? (
					<FeedListingThumb
						title={listing.title}
						posterUrl={listing.posterUrl}
						href={listing.href}
						listingKind={listing.listingKind ?? "movie"}
						layout="card"
						linkable={false}
					/>
				) : null}
				<div className="min-w-0 flex-1">
					<header className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
						<span className="tabular-nums">
							{formatDistanceToNowStrict(new Date(review.publishedAt))} ago
						</span>
						{review.rating != null ? (
							<span className="font-medium text-foreground tabular-nums">
								{formatStoredLogRatingDisplay(review.rating)}
								<span className="text-muted-foreground">/10</span>
							</span>
						) : null}
					</header>
					{review.title ? (
						<h3 className="mt-3 text-balance font-serif text-foreground text-lg leading-snug tracking-tight group-hover:text-desert-orange">
							{review.title}
						</h3>
					) : null}
					<p className="mt-2 line-clamp-4 text-pretty font-editorial text-foreground/85 text-sm leading-relaxed">
						<ReviewBodyWithMentions body={review.body} />
					</p>
					<footer className="mt-4 flex items-center gap-4 text-muted-foreground text-xs tabular-nums">
						<span className="inline-flex items-center gap-1.5">
							<Heart className="size-3.5 opacity-70" aria-hidden />
							{likesCount}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<MessageCircle className="size-3.5 opacity-70" aria-hidden />
							{commentsCount}
						</span>
					</footer>
				</div>
			</button>
			<StaffContentActions
				type="review"
				id={review.id}
				role={viewerRole}
				// The public feed never surfaces removed reviews, so this card is
				// always showing live content.
				isRemoved={false}
				onChanged={() => setHidden(true)}
			/>
		</>
	);
}
