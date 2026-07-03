"use client";

import { cn } from "@still/ui/lib/utils";
import { Film, Heart, MessageCircle } from "lucide-react";
import Image from "next/image";

import { ProfileSocialEmpty } from "@/components/profile/profile-social-empty";
import {
	type ReviewPreview,
	useReviewDetail,
} from "@/components/review/review-detail-sheet";
import { ReviewSpoilerPreview } from "@/components/review/review-spoiler-preview";
import { VisibilityChip } from "@/components/review/visibility-chip";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

export type ProfileReviewRow = {
	review: ReviewPreview & {
		userId: string;
		movieId: number;
		visibility?: "public" | "followers" | "friends" | "private";
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
};

const reviewTileClassName = cn(
	"flex w-full min-w-0 items-stretch gap-4 overflow-hidden rounded-[1.75rem] bg-background p-4 text-left shadow-sm transition-[transform,colors] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none sm:gap-5 sm:p-5",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

function ProfileReviewPoster({
	title,
	posterPath,
}: {
	title: string;
	posterPath: string | null;
}) {
	const src = profilePosterUrlFromPath(posterPath);

	return (
		<aside
			className="relative w-[5.25rem] shrink-0 self-stretch sm:w-[6.5rem]"
			aria-hidden
		>
			<div className="relative size-full min-h-[9.5rem] overflow-hidden rounded-2xl bg-background shadow-sm">
				{src ? (
					<Image
						src={src}
						alt=""
						fill
						sizes="(max-width: 640px) 88px, 104px"
						className="object-cover"
					/>
				) : (
					<div className="grid size-full place-items-center bg-muted/25 p-2">
						<Film className="size-5 text-muted-foreground" strokeWidth={1.5} />
					</div>
				)}
			</div>
			<span className="sr-only">{title}</span>
		</aside>
	);
}

export function ProfileReviewTile({
	row,
	isMe,
}: {
	row: ProfileReviewRow;
	isMe: boolean;
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const { review, movie } = row;

	return (
		<button
			type="button"
			className={cn(reviewTileClassName, "group")}
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
						containsSpoilers: review.containsSpoilers,
					},
				})
			}
		>
			{movie ? (
				<ProfileReviewPoster
					title={movie.title}
					posterPath={movie.posterPath}
				/>
			) : null}

			<span className="flex min-h-0 min-w-0 flex-1 flex-col">
				<span className="flex shrink-0 items-start justify-between gap-3">
					<span className="min-w-0 text-muted-foreground text-xs leading-snug">
						<span className="tabular-nums">
							{formatDistanceToNowStrict(new Date(review.publishedAt))} ago
						</span>
						{movie ? (
							<>
								<span aria-hidden className="text-muted-foreground/50">
									{" "}
									·{" "}
								</span>
								<span className="font-medium text-foreground/90">
									{movie.title}
								</span>
							</>
						) : null}
					</span>
					{review.rating != null ? (
						<span className="shrink-0 font-medium text-foreground text-xs tabular-nums">
							{formatStoredLogRatingDisplay(review.rating)}
							<span className="text-muted-foreground">/10</span>
						</span>
					) : null}
				</span>

				<ReviewSpoilerPreview
					containsSpoilers={review.containsSpoilers ?? false}
					movieId={review.movieId}
					reviewUserId={review.userId}
					align="start"
					nestedInInteractive
				>
					{review.title ? (
						<span className="mt-2.5 block shrink-0 font-medium text-base text-foreground leading-snug tracking-tight [@media(hover:hover)]:group-hover:text-desert-orange">
							{review.title}
						</span>
					) : null}

					<span className="mt-2 line-clamp-4 min-h-0 flex-1 font-editorial text-foreground/85 text-sm leading-relaxed">
						{review.body}
					</span>
				</ReviewSpoilerPreview>

				<span className="mt-4 flex shrink-0 items-center gap-4 pt-0.5 text-muted-foreground text-xs tabular-nums">
					<span className="inline-flex items-center gap-1.5">
						<Heart className="size-3.5 opacity-70" aria-hidden />
						{review.likesCount}
					</span>
					<span className="inline-flex items-center gap-1.5">
						<MessageCircle className="size-3.5 opacity-70" aria-hidden />
						{review.commentsCount}
					</span>
					{isMe && review.visibility && review.visibility !== "public" ? (
						<VisibilityChip visibility={review.visibility} />
					) : null}
				</span>
			</span>
		</button>
	);
}

/**
 * Patron reviews tab — two-up grid on `bg-card`, poster + meta, opens review reader sheet.
 */
export function ProfileReviewsPanel({
	rows,
	isMe = false,
}: {
	rows: ProfileReviewRow[];
	isMe?: boolean;
}) {
	if (!rows.length) {
		return (
			<ProfileSocialEmpty
				icon={MessageCircle}
				title="No reviews yet"
				body="Published write-ups show up here with ratings, reactions, and the film they are about."
			/>
		);
	}

	return (
		<ul className="grid w-full gap-4 md:grid-cols-2">
			{rows.map((row) => (
				<li key={row.review.id} className="min-w-0">
					<ProfileReviewTile row={row} isMe={isMe} />
				</li>
			))}
		</ul>
	);
}
