"use client";

import { cn } from "@still/ui/lib/utils";
import { Heart, MessageCircle } from "lucide-react";
import {
	type ReviewPreview,
	useReviewDetail,
} from "@/components/review/review-detail-sheet";
import { formatDistanceToNowStrict } from "@/lib/format";
import { formatLogRatingDisplay } from "@/lib/log-rating";

type Review = ReviewPreview & {
	userId: string;
	movieId: number;
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

	return (
		<button
			type="button"
			className={cn(REVIEW_CARD_CLASS, "group cursor-pointer")}
			aria-haspopup="dialog"
			aria-label={review.title ? `Read review: ${review.title}` : "Read review"}
			onClick={() =>
				openReviewDetail({
					reviewId: review.id,
					preview: {
						id: review.id,
						title: review.title,
						body: review.body,
						rating: review.rating,
						likesCount: review.likesCount,
						commentsCount: review.commentsCount,
						publishedAt: review.publishedAt,
					},
				})
			}
		>
			<header className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
				<span className="tabular-nums">
					{formatDistanceToNowStrict(new Date(review.publishedAt))} ago
				</span>
				{review.rating != null ? (
					<span className="font-medium text-foreground tabular-nums">
						{formatLogRatingDisplay(review.rating)}
						<span className="text-muted-foreground">/10</span>
					</span>
				) : null}
			</header>
			{review.title ? (
				<h3 className="mt-3 font-serif text-foreground text-lg leading-snug tracking-tight group-hover:text-desert-orange">
					{review.title}
				</h3>
			) : null}
			<p className="mt-2 line-clamp-4 font-editorial text-foreground/85 text-sm leading-relaxed">
				{review.body}
			</p>
			<footer className="mt-4 flex items-center gap-4 text-muted-foreground text-xs tabular-nums">
				<span className="inline-flex items-center gap-1.5">
					<Heart className="size-3.5 opacity-70" aria-hidden />
					{review.likesCount}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<MessageCircle className="size-3.5 opacity-70" aria-hidden />
					{review.commentsCount}
				</span>
			</footer>
		</button>
	);
}
