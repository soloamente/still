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

/** Flat community tile — same `bg-background` surface as review cards on `bg-card`. */
export const ACTIVITY_ROW_CLASS =
	"group flex items-start gap-6 rounded-2xl bg-background p-4 transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)] [@media(hover:hover)]:hover:bg-foreground/5";

/**
 * Activity feed row: poster | byline + title + light meta.
 * Keeps links separate (no nested interactives) and drops side icon chrome.
 */
export function ActivityItem({ item }: { item: Item }) {
	switch (item.kind) {
		case "log":
			return <LogActivity item={item} payload={item.payload as LogPayload} />;
		case "review":
			return (
				<ReviewActivity item={item} payload={item.payload as ReviewPayload} />
			);
		case "list":
			return <ListActivity item={item} payload={item.payload as ListPayload} />;
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
}: {
	person: Person;
	kind: FeedActivityKind;
	rewatch?: boolean;
	/** ISO anchor for `<time dateTime>` — matches the feed row `at`. */
	dateTime: string;
	/** Preformatted relative label from feed `at`. */
	timeLabel: string;
}) {
	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<FeedPersonAvatar person={person} size="xs" />
			<p className="min-w-0 flex-1 text-pretty text-sm leading-snug">
				<PatronNameLink person={person} />
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

function LogActivity({ item, payload }: { item: Item; payload: LogPayload }) {
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

	return (
		<article className={ACTIVITY_ROW_CLASS}>
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
				<ActivityByline
					person={payload}
					kind="log"
					rewatch={log.rewatch}
					dateTime={item.at}
					timeLabel={formatTimeAgoLabel(item.at)}
				/>
				{listing && detailHref ? (
					<ListingTitleLink href={detailHref} title={listing.title} />
				) : (
					<p className="text-balance font-serif text-foreground text-lg leading-snug tracking-tight">
						{listingTitle}
					</p>
				)}
				{showWatchMeta ? (
					<ActivityMetaRow>
						<span>Watched {formatActivityWatchTimestamp(log.watchedAt)}</span>
					</ActivityMetaRow>
				) : null}
				{log.rating != null || log.liked ? (
					<ActivityMetaRow>
						<DiaryLogRatingLabel stored={log.rating} />
						{log.liked ? <FeedActivityFavoriteChip /> : null}
					</ActivityMetaRow>
				) : null}
				{log.note ? (
					<p className="line-clamp-2 text-pretty text-foreground/80 text-sm leading-relaxed">
						{log.note}
					</p>
				) : null}
			</div>
		</article>
	);
}

function ReviewActivity({
	item,
	payload,
}: {
	item: Item;
	payload: ReviewPayload;
}) {
	const { review, movie } = payload;
	const detailHref = movie ? `/movies/${movie.tmdbId}` : undefined;
	const listingTitle = movie?.title ?? "Unknown title";
	const reviewHref = `/reviews/${review.id}`;
	const reviewUserId = payload.user?.id ?? "";

	return (
		<article className={ACTIVITY_ROW_CLASS}>
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
				<ActivityByline
					person={payload}
					kind="review"
					dateTime={item.at}
					timeLabel={formatTimeAgoLabel(item.at)}
				/>
				{movie && detailHref ? (
					<ListingTitleLink href={detailHref} title={movie.title} />
				) : (
					<p className="text-balance font-serif text-foreground text-lg leading-snug tracking-tight">
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
				<ActivityMetaRow>
					<DiaryLogRatingLabel stored={review.rating} />
					<span>{review.likesCount} likes</span>
					<span>{review.commentsCount} comments</span>
					<ActivityTextLink href={reviewHref}>Read review</ActivityTextLink>
				</ActivityMetaRow>
			</div>
		</article>
	);
}

function ListActivity({ item, payload }: { item: Item; payload: ListPayload }) {
	const { list } = payload;
	const posterUrl = listBoardRowPosterUrl(list, "w185");
	const listHref = `/lists/${list.id}`;

	return (
		<article className={ACTIVITY_ROW_CLASS}>
			{posterUrl ? (
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
			)}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<ActivityByline
					person={payload}
					kind="list"
					dateTime={item.at}
					timeLabel={formatTimeAgoLabel(item.at)}
				/>
				<ListingTitleLink href={listHref} title={list.title} />
				<ActivityMetaRow>
					<span>
						<span className="font-medium text-foreground">
							{list.itemsCount}
						</span>{" "}
						{list.itemsCount === 1 ? "film" : "films"}
					</span>
				</ActivityMetaRow>
				{list.description ? (
					<p className="line-clamp-2 text-pretty text-foreground/75 text-sm leading-relaxed">
						{list.description}
					</p>
				) : null}
			</div>
		</article>
	);
}
