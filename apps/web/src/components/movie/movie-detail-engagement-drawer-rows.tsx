"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

import { DiaryLogRatingLabel } from "@/components/diary/diary-log-rating-label";
import { ACTIVITY_ROW_CLASS } from "@/components/feed/activity-item";
import { FeedActivityFavoriteChip } from "@/components/feed/feed-activity-kind-badge";
import { FeedListingThumb } from "@/components/feed/feed-listing-thumb";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PatronPortraitWithAura } from "@/components/profile/patron-portrait-with-aura";
import { useReviewDetail } from "@/components/review/review-detail-sheet";
import { ReviewSpoilerPreview } from "@/components/review/review-spoiler-preview";
import type {
	ListingEngagementListItem,
	ListingEngagementPatronItem,
	ListingEngagementWatchItem,
} from "@/lib/fetch-listing-engagement";
import { formatDistanceToNowStrict, formatTimeAgoLabel } from "@/lib/format";
import { listBoardRowPosterUrl } from "@/lib/list-cover-image";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

/** Centered patron tile — display name, large portrait, timestamp. */
const ENGAGEMENT_PATRON_TILE_CLASS =
	"group flex flex-col items-center gap-3 rounded-2xl bg-background p-4 text-center transition-[transform,background-color] duration-[var(--aker-duration)] ease-[var(--aker-ease)] [@media(hover:hover)]:hover:bg-foreground/5 active:scale-[0.96] motion-reduce:active:scale-100";

/** Large portrait used in stacked engagement tiles (watchlist, etc.). */
const ENGAGEMENT_PATRON_TILE_AVATAR_PX = 80;

function EngagementMetaRow({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs tabular-nums",
				className,
			)}
		>
			{children}
		</div>
	);
}

function EngagementPatronStackedTile({
	item,
	timestampLabel,
	timestampDateTime,
}: {
	item: ListingEngagementPatronItem | ListingEngagementWatchItem;
	timestampLabel: string;
	timestampDateTime: string;
}) {
	return (
		<Link
			href={`/profile/${item.handle}`}
			className={cn(
				ENGAGEMENT_PATRON_TILE_CLASS,
				"outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
			)}
			aria-label={`${item.displayName}, ${timestampLabel}`}
		>
			<span className="relative isolate size-16 shrink-0 overflow-visible rounded-full bg-muted sm:size-20">
				<PatronPortraitWithAura
					handle={item.handle}
					avatarUrl={item.image}
					name={item.displayName}
					className="size-full rounded-full"
					width={ENGAGEMENT_PATRON_TILE_AVATAR_PX}
					height={ENGAGEMENT_PATRON_TILE_AVATAR_PX}
					isAnimated={inferAnimatedFromProfileUrl(
						item.image,
						item.avatarIsAnimated,
					)}
					planTier={item.planTier}
					staffRole={item.staffRole}
				/>
			</span>
			{/* Portrait first — display name + handle stack directly under it. */}
			<span className="flex w-full min-w-0 flex-col items-center gap-0.5">
				<span className="max-w-full truncate font-semibold text-foreground text-sm leading-snug">
					{item.displayName}
				</span>
				<span className="max-w-full truncate text-muted-foreground text-xs leading-snug">
					@{item.handle}
				</span>
			</span>
			<time
				dateTime={timestampDateTime}
				className="text-balance text-muted-foreground text-xs tabular-nums leading-relaxed"
			>
				{timestampLabel}
			</time>
		</Link>
	);
}

/** Patron rows with inline review/meta keep the horizontal feed layout. */
const ENGAGEMENT_PATRON_ROW_CLASS = cn(ACTIVITY_ROW_CLASS, "gap-4");

function EngagementPatronAvatarLink({
	item,
}: {
	item: ListingEngagementPatronItem | ListingEngagementWatchItem;
}) {
	return (
		<Link
			href={`/profile/${item.handle}`}
			className={cn(
				"relative isolate size-11 shrink-0 overflow-visible rounded-full bg-muted",
				"transition-[transform,colors] duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"[@media(hover:hover)]:hover:bg-foreground/10",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				"select-none active:scale-[0.96] motion-reduce:active:scale-100",
			)}
			aria-label={`${item.displayName} profile`}
		>
			<PatronPortraitWithAura
				handle={item.handle}
				avatarUrl={item.image}
				name={item.displayName}
				className="size-full rounded-full"
				width={44}
				height={44}
				isAnimated={inferAnimatedFromProfileUrl(
					item.image,
					item.avatarIsAnimated,
				)}
				planTier={item.planTier}
				staffRole={item.staffRole}
			/>
		</Link>
	);
}

function EngagementPatronNameLink({
	item,
}: {
	item: ListingEngagementPatronItem | ListingEngagementWatchItem;
}) {
	return (
		<Link
			href={`/profile/${item.handle}`}
			className="font-medium text-foreground hover:underline"
		>
			{item.displayName}
		</Link>
	);
}

/** Watched / favorited row — single feed-style tile; review excerpt stays on the same surface. */
export function ListingEngagementWatchRow({
	item,
	movieId,
	kind = "watched",
}: {
	item: ListingEngagementWatchItem;
	movieId?: number;
	kind?: "watched" | "favorited";
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const review = item.review;
	const reviewExcerpt =
		review?.headline?.trim() || review?.body?.trim() || null;
	const verbLabel = kind === "favorited" ? "Favorited" : "Watched";
	const watchedLabel = formatTimeAgoLabel(item.watchedAt);

	return (
		<article className={ENGAGEMENT_PATRON_ROW_CLASS}>
			<EngagementPatronAvatarLink item={item} />
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<p className="min-w-0 text-pretty text-sm leading-snug">
					<EngagementPatronNameLink item={item} />
					<span className="text-muted-foreground"> {verbLabel}</span>
					<span className="text-muted-foreground"> · </span>
					<time
						dateTime={item.watchedAt}
						className="text-muted-foreground tabular-nums"
					>
						{watchedLabel}
					</time>
				</p>

				<EngagementMetaRow>
					<DiaryLogRatingLabel stored={item.rating} />
					{item.liked ? <FeedActivityFavoriteChip /> : null}
					{!item.rating && !item.liked ? (
						<span className="text-muted-foreground">Logged</span>
					) : null}
				</EngagementMetaRow>

				{review && reviewExcerpt ? (
					<>
						<ReviewSpoilerPreview
							containsSpoilers={review.containsSpoilers ?? false}
							movieId={movieId}
							reviewUserId={item.userId}
							align="start"
							nestedInInteractive
						>
							<p className="line-clamp-3 text-pretty font-editorial text-foreground/80 text-sm leading-relaxed">
								{reviewExcerpt}
							</p>
						</ReviewSpoilerPreview>
						<DetailMotionButton
							type="button"
							className="w-fit font-medium text-foreground text-sm transition-colors duration-150 [@media(hover:hover)]:hover:text-desert-orange"
							onClick={() =>
								openReviewDetail({
									reviewId: review.id,
									movieId,
									preview: {
										id: review.id,
										userId: item.userId,
										title: review.headline,
										body: review.body,
										rating: review.rating,
										likesCount: review.likesCount,
										commentsCount: 0,
										publishedAt: review.publishedAt,
										containsSpoilers: review.containsSpoilers,
										author: {
											handle: item.handle,
											displayName: item.displayName,
											image: item.image,
											avatarIsAnimated: item.avatarIsAnimated,
											planTier: item.planTier,
											staffRole: item.staffRole,
										},
									},
								})
							}
						>
							Read review
						</DetailMotionButton>
					</>
				) : null}
			</div>
		</article>
	);
}

/** List row — same horizontal rhythm as community activity list tiles. */
export function ListingEngagementListRow({
	item,
}: {
	item: ListingEngagementListItem;
}) {
	const coverSrc = listBoardRowPosterUrl(
		{
			id: item.id,
			coverImageUrl: item.coverImageUrl,
			coverPosterPaths: item.coverPosterPaths,
			updatedAt: item.updatedAt,
		},
		"w342",
	);
	const listHref = `/lists/${item.id}`;
	const listCountLabel = item.itemsCount === 1 ? "title" : "titles";

	return (
		<article className={ACTIVITY_ROW_CLASS}>
			<FeedListingThumb
				layout="activity"
				title={item.title}
				posterUrl={coverSrc}
				href={listHref}
				linkable
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<Link
					href={listHref}
					className="block text-balance font-serif text-foreground text-lg leading-snug tracking-tight transition-colors duration-150 [@media(hover:hover)]:group-hover:text-desert-orange"
				>
					{item.title}
				</Link>
				<EngagementMetaRow>
					<span>
						by{" "}
						<Link
							href={`/profile/${item.ownerHandle}`}
							className="font-medium text-foreground transition-colors duration-150 [@media(hover:hover)]:hover:text-desert-orange"
						>
							@{item.ownerHandle}
						</Link>
					</span>
					<span>
						{item.itemsCount} {listCountLabel}
					</span>
					<span>
						{item.likesCount} {item.likesCount === 1 ? "like" : "likes"}
					</span>
					<span>
						updated {formatDistanceToNowStrict(new Date(item.updatedAt))} ago
					</span>
				</EngagementMetaRow>
				{item.description ? (
					<p className="line-clamp-2 text-pretty font-editorial text-foreground/80 text-sm leading-relaxed">
						{item.description}
					</p>
				) : null}
			</div>
		</article>
	);
}

/** Watchlist patron — centered name, large avatar, added timestamp. */
export function ListingEngagementPatronRow({
	item,
}: {
	item: ListingEngagementPatronItem;
}) {
	const savedLabel = formatTimeAgoLabel(item.sortAt);

	return (
		<EngagementPatronStackedTile
			item={item}
			timestampDateTime={item.sortAt}
			timestampLabel={`Added to watchlist · ${savedLabel}`}
		/>
	);
}
