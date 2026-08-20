import { cn } from "@still/ui/lib/utils";
import { ListMusic } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DiaryLogRatingLabel } from "@/components/diary/diary-log-rating-label";
import { ActivityDivergenceRow } from "@/components/feed/activity-divergence-row";
import {
	FeedActivityFavoriteChip,
	type FeedActivityKind,
	FeedActivityVerb,
} from "@/components/feed/feed-activity-kind-badge";
import {
	FeedListingThumb,
	FeedListPlaceholderFrame,
} from "@/components/feed/feed-listing-thumb";
import { FeedPersonAvatar } from "@/components/feed/feed-person-avatar";
import { ReviewActivityCopy } from "@/components/feed/review-activity-copy";
import {
	COMMUNITY_FEED_BYLINE_CLASS,
	COMMUNITY_FEED_META_PILL_CLASS,
	COMMUNITY_FEED_META_PILL_ROW_CLASS,
	COMMUNITY_FEED_ROW_BODY_CLASS,
	COMMUNITY_FEED_ROW_CLASS,
	COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS,
	COMMUNITY_FEED_ROW_COPY_STACK_CLASS,
} from "@/lib/community-feed-row-layout";
import { isFeedRatingDivergencePayload } from "@/lib/feed-rating-divergence";
import {
	formatActivityWatchTimestamp,
	formatTimeAgoLabel,
	shouldShowActivityWatchDateMeta,
} from "@/lib/format";
import type { HomeCommunityActivityKind } from "@/lib/home-community-activity";
import { listBoardRowPosterUrl } from "@/lib/list-cover-image";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

type Item = { kind: HomeCommunityActivityKind; at: string; payload: unknown };

export type ActivityItemVariant = "feed" | "community";

/** Flat community tile — same `bg-background` surface as review cards on `bg-card`. */
export const ACTIVITY_ROW_CLASS =
	"group flex items-start gap-6 rounded-2xl bg-background p-4 transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)] [@media(hover:hover)]:hover:bg-foreground/5";

/**
 * Activity feed row: poster | byline + title + light meta.
 * Keeps links separate (no nested interactives) and drops side icon chrome.
 */
export function ActivityItem({
	item,
	variant = "feed",
}: {
	item: Item;
	variant?: ActivityItemVariant;
}) {
	switch (item.kind) {
		case "log":
			return (
				<LogActivity
					item={item}
					payload={item.payload as LogPayload}
					variant={variant}
				/>
			);
		case "review":
			return (
				<ReviewActivity
					item={item}
					payload={item.payload as ReviewPayload}
					variant={variant}
				/>
			);
		case "list":
			return (
				<ListActivity
					item={item}
					payload={item.payload as ListPayload}
					variant={variant}
				/>
			);
		case "divergence":
			return isFeedRatingDivergencePayload(item.payload) ? (
				<ActivityDivergenceRow payload={item.payload} />
			) : null;
		default:
			return null;
	}
}

type Person = {
	user: { id: string; name: string; image: string | null } | null;
	profile: {
		handle: string;
		displayName: string;
		avatarIsAnimated?: boolean;
	} | null;
};

type LogPayload = Person & {
	log: {
		id: string;
		watchedAt: string;
		rating: number | null;
		liked: boolean;
		rewatch: boolean;
		note: string | null;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	tv?: { tmdbId: number; title: string; posterPath: string | null } | null;
};

type ReviewPayload = Person & {
	review: {
		id: string;
		title: string | null;
		body: string;
		rating: number | null;
		likesCount: number;
		commentsCount: number;
		publishedAt: string;
		containsSpoilers?: boolean;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
};

type ListPayload = Person & {
	list: {
		id: string;
		title: string;
		description: string | null;
		itemsCount: number;
		coverMovieIds: number[];
		coverPosterPaths?: (string | null)[];
		coverImageUrl?: string | null;
		updatedAt: string;
	};
};

function patronHandle(person: Person): string {
	return person.profile?.handle ?? person.user?.id ?? "user";
}

function patronName(person: Person): string {
	return person.profile?.displayName ?? person.user?.name ?? "Someone";
}

function PatronNameLink({ person }: { person: Person }) {
	const handle = patronHandle(person);
	const name = patronName(person);
	return (
		<Link
			href={`/profile/${handle}`}
			className="font-medium text-foreground hover:underline"
		>
			{name}
		</Link>
	);
}

function ListingTitleLink({
	href,
	title,
	className,
}: {
	href: string;
	title: string;
	className?: string;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"block text-balance font-serif text-foreground text-lg leading-snug tracking-tight transition-colors duration-150 [@media(hover:hover)]:group-hover:text-desert-orange",
				className,
			)}
		>
			{title}
		</Link>
	);
}

function ActivityByline({
	person,
	kind,
	rewatch,
	dateTime,
	timeLabel,
	avatarSize = "xs",
	showHandle = false,
}: {
	person: Person;
	kind: FeedActivityKind;
	rewatch?: boolean;
	/** ISO anchor for `<time dateTime>` — matches the feed row `at`. */
	dateTime: string;
	/** Preformatted relative label from feed `at`. */
	timeLabel: string;
	avatarSize?: "xs" | "sm";
	showHandle?: boolean;
}) {
	const handle = person.profile?.handle;
	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<FeedPersonAvatar person={person} size={avatarSize} />
			<p className="min-w-0 flex-1 text-pretty text-sm leading-snug">
				<PatronNameLink person={person} />
				{showHandle && handle ? (
					<span className="font-normal text-muted-foreground"> @{handle}</span>
				) : null}
				<span className="text-muted-foreground"> </span>
				<FeedActivityVerb kind={kind} rewatch={rewatch} />
				<span className="text-muted-foreground"> · </span>
				<time
					dateTime={dateTime}
					className="text-muted-foreground tabular-nums"
				>
					{timeLabel}
				</time>
			</p>
		</div>
	);
}

function ActivityMetaRow({
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

function ActivityTextLink({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<Link
			href={href}
			className="font-medium text-foreground text-sm transition-colors duration-150 [@media(hover:hover)]:hover:text-desert-orange"
		>
			{children}
		</Link>
	);
}

function LogActivity({
	item,
	payload,
	variant = "feed",
}: {
	item: Item;
	payload: LogPayload;
	variant?: ActivityItemVariant;
}) {
	const { log, movie, tv } = payload;
	const listing = movie ?? tv ?? null;
	const isTv = movie == null && tv != null;
	const detailHref = listing
		? isTv
			? `/tv/${listing.tmdbId}`
			: `/movies/${listing.tmdbId}`
		: undefined;
	const listingTitle = listing?.title ?? "Unknown title";
	const showWatchMeta = shouldShowActivityWatchDateMeta(log.watchedAt, item.at);
	const rowClass =
		variant === "community" ? COMMUNITY_FEED_ROW_CLASS : ACTIVITY_ROW_CLASS;

	const byline = (
		<ActivityByline
			person={payload}
			kind="log"
			rewatch={log.rewatch}
			dateTime={item.at}
			timeLabel={formatTimeAgoLabel(item.at)}
			avatarSize={variant === "community" ? "sm" : "xs"}
			showHandle={variant === "community"}
		/>
	);

	const copyMain = (
		<>
			{listing && detailHref ? (
				<ListingTitleLink
					href={detailHref}
					title={listing.title}
					className={
						variant === "community" ? "text-xl sm:text-[1.35rem]" : undefined
					}
				/>
			) : (
				<p
					className={cn(
						"text-balance font-serif text-foreground leading-snug tracking-tight",
						variant === "community" ? "text-xl sm:text-[1.35rem]" : "text-lg",
					)}
				>
					{listingTitle}
				</p>
			)}
			{showWatchMeta ? (
				<ActivityMetaRow>
					<span>Watched {formatActivityWatchTimestamp(log.watchedAt)}</span>
				</ActivityMetaRow>
			) : null}
			{log.note ? (
				<p className="line-clamp-3 text-pretty text-foreground/85 text-sm leading-relaxed sm:line-clamp-4">
					{log.note}
				</p>
			) : null}
		</>
	);

	const copyMeta =
		log.rating != null || log.liked ? (
			variant === "community" ? (
				<div className={COMMUNITY_FEED_META_PILL_ROW_CLASS}>
					{log.rating != null ? (
						<span className={COMMUNITY_FEED_META_PILL_CLASS}>
							<DiaryLogRatingLabel stored={log.rating} />
						</span>
					) : null}
					{log.liked ? (
						<span className={COMMUNITY_FEED_META_PILL_CLASS}>
							<FeedActivityFavoriteChip />
						</span>
					) : null}
				</div>
			) : (
				<ActivityMetaRow>
					<DiaryLogRatingLabel stored={log.rating} />
					{log.liked ? <FeedActivityFavoriteChip /> : null}
				</ActivityMetaRow>
			)
		) : null;

	const copy = (
		<>
			{copyMain}
			{variant === "feed" ? copyMeta : null}
		</>
	);

	if (variant === "community") {
		return (
			<article className={rowClass}>
				<div className={COMMUNITY_FEED_BYLINE_CLASS}>{byline}</div>
				<div className={COMMUNITY_FEED_ROW_BODY_CLASS}>
					<FeedListingThumb
						layout="activity"
						title={listingTitle}
						posterUrl={
							listing ? tmdbPosterUrlFromPath(listing.posterPath, "w185") : null
						}
						href={detailHref}
						listingKind={isTv ? "tv" : "movie"}
						linkable={Boolean(detailHref)}
					/>
					<div className={COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS}>
						<div className={COMMUNITY_FEED_ROW_COPY_STACK_CLASS}>
							{copyMain}
						</div>
						{copyMeta}
					</div>
				</div>
			</article>
		);
	}

	return (
		<article className={rowClass}>
			<FeedListingThumb
				layout="activity"
				title={listingTitle}
				posterUrl={
					listing ? tmdbPosterUrlFromPath(listing.posterPath, "w185") : null
				}
				href={detailHref}
				listingKind={isTv ? "tv" : "movie"}
				linkable={Boolean(detailHref)}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{byline}
				{copy}
			</div>
		</article>
	);
}

function ReviewActivity({
	item,
	payload,
	variant = "feed",
}: {
	item: Item;
	payload: ReviewPayload;
	variant?: ActivityItemVariant;
}) {
	const { review, movie } = payload;
	const detailHref = movie ? `/movies/${movie.tmdbId}` : undefined;
	const listingTitle = movie?.title ?? "Unknown title";
	const reviewHref = `/reviews/${review.id}`;
	const reviewUserId = payload.user?.id ?? "";
	const rowClass =
		variant === "community" ? COMMUNITY_FEED_ROW_CLASS : ACTIVITY_ROW_CLASS;

	const byline = (
		<ActivityByline
			person={payload}
			kind="review"
			dateTime={item.at}
			timeLabel={formatTimeAgoLabel(item.at)}
			avatarSize={variant === "community" ? "sm" : "xs"}
			showHandle={variant === "community"}
		/>
	);

	const copyMain = (
		<>
			{movie && detailHref ? (
				<ListingTitleLink
					href={detailHref}
					title={movie.title}
					className={
						variant === "community" ? "text-xl sm:text-[1.35rem]" : undefined
					}
				/>
			) : (
				<p
					className={cn(
						"text-balance font-serif text-foreground leading-snug tracking-tight",
						variant === "community" ? "text-xl sm:text-[1.35rem]" : "text-lg",
					)}
				>
					{listingTitle}
				</p>
			)}
			<ReviewActivityCopy
				containsSpoilers={review.containsSpoilers ?? false}
				movieId={movie?.tmdbId}
				reviewUserId={reviewUserId}
				title={review.title}
				body={review.body}
			/>
		</>
	);

	const copyMeta =
		variant === "community" ? (
			<div className={COMMUNITY_FEED_META_PILL_ROW_CLASS}>
				<span className={COMMUNITY_FEED_META_PILL_CLASS}>
					<DiaryLogRatingLabel stored={review.rating} />
				</span>
				<span className={COMMUNITY_FEED_META_PILL_CLASS}>
					{review.likesCount} likes
				</span>
				<span className={COMMUNITY_FEED_META_PILL_CLASS}>
					{review.commentsCount} comments
				</span>
				<ActivityTextLink href={reviewHref}>Read review</ActivityTextLink>
			</div>
		) : (
			<ActivityMetaRow>
				<DiaryLogRatingLabel stored={review.rating} />
				<span>{review.likesCount} likes</span>
				<span>{review.commentsCount} comments</span>
				<ActivityTextLink href={reviewHref}>Read review</ActivityTextLink>
			</ActivityMetaRow>
		);

	const copy = (
		<>
			{copyMain}
			{variant === "feed" ? copyMeta : null}
		</>
	);

	if (variant === "community") {
		return (
			<article className={rowClass}>
				<div className={COMMUNITY_FEED_BYLINE_CLASS}>{byline}</div>
				<div className={COMMUNITY_FEED_ROW_BODY_CLASS}>
					<FeedListingThumb
						layout="activity"
						title={listingTitle}
						posterUrl={
							movie ? tmdbPosterUrlFromPath(movie.posterPath, "w185") : null
						}
						href={detailHref}
						linkable={Boolean(detailHref)}
					/>
					<div className={COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS}>
						<div className={COMMUNITY_FEED_ROW_COPY_STACK_CLASS}>
							{copyMain}
						</div>
						{copyMeta}
					</div>
				</div>
			</article>
		);
	}

	return (
		<article className={rowClass}>
			<FeedListingThumb
				layout="activity"
				title={listingTitle}
				posterUrl={
					movie ? tmdbPosterUrlFromPath(movie.posterPath, "w185") : null
				}
				href={detailHref}
				linkable={Boolean(detailHref)}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{byline}
				{copy}
			</div>
		</article>
	);
}

function ListActivity({
	item,
	payload,
	variant = "feed",
}: {
	item: Item;
	payload: ListPayload;
	variant?: ActivityItemVariant;
}) {
	const { list } = payload;
	const posterUrl = listBoardRowPosterUrl(list, "w185");
	const listHref = `/lists/${list.id}`;
	const rowClass =
		variant === "community" ? COMMUNITY_FEED_ROW_CLASS : ACTIVITY_ROW_CLASS;

	const byline = (
		<ActivityByline
			person={payload}
			kind="list"
			dateTime={item.at}
			timeLabel={formatTimeAgoLabel(item.at)}
			avatarSize={variant === "community" ? "sm" : "xs"}
			showHandle={variant === "community"}
		/>
	);

	const thumb = posterUrl ? (
		<FeedListingThumb
			layout="activity"
			title={list.title}
			posterUrl={posterUrl}
			href={listHref}
			linkable
		/>
	) : (
		<FeedListPlaceholderFrame>
			<ListMusic className="size-5" />
		</FeedListPlaceholderFrame>
	);

	const copyMain = (
		<>
			<ListingTitleLink
				href={listHref}
				title={list.title}
				className={
					variant === "community" ? "text-xl sm:text-[1.35rem]" : undefined
				}
			/>
			{list.description ? (
				<p className="line-clamp-3 text-pretty text-foreground/85 text-sm leading-relaxed sm:line-clamp-4">
					{list.description}
				</p>
			) : null}
		</>
	);

	const copyMeta =
		variant === "community" ? (
			<div className={COMMUNITY_FEED_META_PILL_ROW_CLASS}>
				<span className={COMMUNITY_FEED_META_PILL_CLASS}>
					<span className="font-medium text-foreground">{list.itemsCount}</span>{" "}
					{list.itemsCount === 1 ? "title" : "titles"}
				</span>
			</div>
		) : (
			<ActivityMetaRow>
				<span>
					<span className="font-medium text-foreground">{list.itemsCount}</span>{" "}
					{list.itemsCount === 1 ? "film" : "films"}
				</span>
			</ActivityMetaRow>
		);

	const copy = (
		<>
			{copyMain}
			{variant === "feed" ? copyMeta : null}
		</>
	);

	if (variant === "community") {
		return (
			<article className={rowClass}>
				<div className={COMMUNITY_FEED_BYLINE_CLASS}>{byline}</div>
				<div className={COMMUNITY_FEED_ROW_BODY_CLASS}>
					{thumb}
					<div className={COMMUNITY_FEED_ROW_COPY_COLUMN_CLASS}>
						<div className={COMMUNITY_FEED_ROW_COPY_STACK_CLASS}>
							{copyMain}
						</div>
						{copyMeta}
					</div>
				</div>
			</article>
		);
	}

	return (
		<article className={rowClass}>
			{thumb}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{byline}
				{copy}
			</div>
		</article>
	);
}
