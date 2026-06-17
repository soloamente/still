"use client";

import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import { LayoutGrid } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { useReviewDetail } from "@/components/review/review-detail-sheet";
import type {
	ListingEngagementListItem,
	ListingEngagementPatronItem,
	ListingEngagementWatchItem,
} from "@/lib/fetch-listing-engagement";
import { formatDistanceToNowStrict, formatTimeAgoLabel } from "@/lib/format";
import {
	isListCoverProxySrc,
	listBoardRowPosterUrl,
} from "@/lib/list-cover-image";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

const COMMUNITY_CARD = "rounded-2xl bg-background";

function PatronAvatarRow({
	item,
	subtitle,
}: {
	item: ListingEngagementPatronItem | ListingEngagementWatchItem;
	subtitle?: string | null;
}) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<PatronPortraitWithMetalTier
				handle={item.handle}
				avatarUrl={item.image}
				name={item.displayName}
				className="size-11 shrink-0 rounded-full"
				width={44}
				height={44}
				isAnimated={inferAnimatedFromProfileUrl(
					item.image,
					item.avatarIsAnimated,
				)}
				diaryMetalTier={item.diaryMetalTier}
			/>
			<div className="min-w-0 text-left">
				<p className="truncate font-medium text-foreground text-sm">
					{item.displayName}
				</p>
				<p className="truncate text-muted-foreground text-xs">@{item.handle}</p>
				{subtitle ? (
					<p className="mt-0.5 truncate text-muted-foreground text-xs tabular-nums">
						{subtitle}
					</p>
				) : null}
			</div>
		</div>
	);
}

/** Watched / favorited row — patron byline plus optional review excerpt. */
export function ListingEngagementWatchRow({
	item,
	movieId,
}: {
	item: ListingEngagementWatchItem;
	movieId?: number;
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const scoreLabel = formatStoredLogRatingDisplay(item.rating);
	const subtitleParts: string[] = [];
	if (scoreLabel) subtitleParts.push(scoreLabel);
	if (item.liked) subtitleParts.push("Favorite");
	if (subtitleParts.length === 0) subtitleParts.push("Logged");
	subtitleParts.push(formatTimeAgoLabel(item.watchedAt));

	const review = item.review;
	const reviewExcerpt =
		review?.headline?.trim() || review?.body?.trim() || null;

	return (
		<article className={cn(COMMUNITY_CARD, "p-4")}>
			<div className="flex items-start justify-between gap-3">
				<Link
					href={`/profile/${item.handle}`}
					className="min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55"
				>
					<PatronAvatarRow item={item} subtitle={subtitleParts.join(" · ")} />
				</Link>
				{item.liked ? (
					<IconHeartFilled
						aria-label="Favorite"
						className="size-4 shrink-0 text-orange-400/90"
					/>
				) : null}
			</div>
			{review && reviewExcerpt ? (
				<DetailMotionButton
					type="button"
					className="mt-3 w-full rounded-2xl bg-card px-4 py-3 text-left"
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
								author: {
									handle: item.handle,
									displayName: item.displayName,
									image: item.image,
									avatarIsAnimated: item.avatarIsAnimated,
									diaryMetalTier: item.diaryMetalTier,
								},
							},
						})
					}
				>
					<p className="line-clamp-3 font-editorial text-foreground/85 text-sm leading-relaxed">
						{reviewExcerpt}
					</p>
					<p className="mt-2 font-medium text-desert-orange text-xs">
						See full review
					</p>
				</DetailMotionButton>
			) : null}
		</article>
	);
}

/** List card row — mirrors community tab list tiles. */
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
	const listCountLabel = item.itemsCount === 1 ? "title" : "titles";

	return (
		<article className={cn(COMMUNITY_CARD, "overflow-hidden")}>
			<Link
				href={`/lists/${item.id}`}
				className="flex items-stretch gap-4 p-4 text-left transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100"
			>
				<aside
					className="relative w-[5.25rem] shrink-0 self-stretch sm:w-[6.5rem]"
					aria-hidden
				>
					<div className="relative size-full min-h-[9.5rem] overflow-hidden rounded-2xl bg-muted/30">
						{coverSrc ? (
							<Image
								src={coverSrc}
								alt=""
								fill
								sizes="(max-width: 640px) 88px, 104px"
								className="object-cover"
								unoptimized={isListCoverProxySrc(coverSrc)}
							/>
						) : (
							<div className="grid size-full place-items-center text-desert-orange">
								<LayoutGrid className="size-6" aria-hidden />
							</div>
						)}
					</div>
				</aside>
				<div className="min-w-0 flex-1">
					<p className="font-serif text-foreground text-lg leading-snug [@media(hover:hover)]:hover:text-desert-orange">
						{item.title}
					</p>
					<p className="mt-1 text-muted-foreground text-xs tabular-nums">
						by <span className="text-foreground/85">@{item.ownerHandle}</span>
						{" · "}
						{item.itemsCount} {listCountLabel} · {item.likesCount}{" "}
						{item.likesCount === 1 ? "like" : "likes"} · updated{" "}
						{formatDistanceToNowStrict(new Date(item.updatedAt))} ago
					</p>
					{item.description ? (
						<p className="mt-2 line-clamp-2 font-editorial text-foreground/80 text-sm leading-relaxed">
							{item.description}
						</p>
					) : null}
				</div>
			</Link>
		</article>
	);
}

/** Watchlist / simple patron row without review body. */
export function ListingEngagementPatronRow({
	item,
}: {
	item: ListingEngagementPatronItem;
}) {
	const scoreLabel = formatStoredLogRatingDisplay(item.rating);
	const subtitle = formatTimeAgoLabel(item.sortAt);

	return (
		<article className={cn(COMMUNITY_CARD, "p-4")}>
			<Link
				href={`/profile/${item.handle}`}
				className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55"
			>
				<PatronAvatarRow
					item={item}
					subtitle={
						scoreLabel ? `${scoreLabel} · ${subtitle}` : `Saved ${subtitle}`
					}
				/>
			</Link>
		</article>
	);
}
