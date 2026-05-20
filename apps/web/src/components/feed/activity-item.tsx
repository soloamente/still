import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight, Film, Heart, ListPlus, Star, Tv } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FeedPersonAvatar } from "@/components/feed/feed-person-avatar";
import { MoviePoster } from "@/components/movie/movie-poster";
import { StarRating } from "@/components/rating/star-rating";
import { formatDistanceToNowStrict } from "@/lib/format";

type ActivityKind = "log" | "review" | "list";
type Item = { kind: ActivityKind; at: string; payload: unknown };

/**
 * Single feed row (Track B.5 home / following). Shared anatomy:
 *   avatar — who — film line — rating/meta — poster thumb — icon action
 * Avoids nested interactive elements (no `<Link>` wrapping other links).
 */
export function ActivityItem({ item }: { item: Item }) {
	switch (item.kind) {
		case "log":
			return <LogActivity payload={item.payload as LogPayload} />;
		case "review":
			return <ReviewActivity payload={item.payload as ReviewPayload} />;
		case "list":
			return <ListActivity payload={item.payload as ListPayload} />;
		default:
			return null;
	}
}

type Person = {
	user: { id: string; name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
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
		updatedAt: string;
	};
};

function posterUrl(
	path: string | null | undefined,
	size: "w185" | "w342" = "w185",
) {
	return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

function Byline({ profile, user, suffix }: Person & { suffix: string }) {
	const handle = profile?.handle ?? user?.id ?? "user";
	const name = profile?.displayName ?? user?.name ?? "Someone";
	return (
		<Link
			href={`/profile/${handle}`}
			className="font-medium text-foreground hover:underline"
		>
			{name} <span className="text-muted-foreground">{suffix}</span>
		</Link>
	);
}

/** 44px icon affordance beside the poster — complements the thumb for motor accessibility. */
function FeedIconAction({
	href,
	label,
	children,
}: {
	href: string;
	label: string;
	children: ReactNode;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-overlay/40",
				"text-muted-foreground transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"hover:border-desert-orange/40 hover:text-foreground",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
			)}
			aria-label={label}
		>
			{children}
		</Link>
	);
}

function LogActivity({ payload }: { payload: LogPayload }) {
	const { log, movie, tv } = payload;
	const listing = movie ?? tv ?? null;
	if (!listing) return null;
	const isTv = movie == null && tv != null;
	const detailHref = isTv
		? `/tv/${listing.tmdbId}`
		: `/movies/${listing.tmdbId}`;
	return (
		<article
			className={cn(
				"group flex gap-3 rounded-2xl border border-border bg-surface-raised/60 p-3 transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"focus-within:border-desert-orange/40 hover:border-desert-orange/40",
			)}
		>
			<FeedPersonAvatar person={payload} />
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug">
					<Byline {...payload} suffix={log.rewatch ? "rewatched" : "watched"} />{" "}
					<Link
						href={detailHref}
						className="font-medium font-serif text-base text-foreground hover:underline"
					>
						{listing.title}
					</Link>
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
					{log.rating ? (
						<StarRating value={log.rating} readOnly size="sm" />
					) : null}
					{log.liked ? (
						<span className="inline-flex items-center gap-0.5 text-desert-orange">
							<Heart className="size-3 fill-current" aria-hidden /> liked
						</span>
					) : null}
					<span>
						· {formatDistanceToNowStrict(new Date(log.watchedAt))} ago
					</span>
				</div>
				{log.note ? (
					<p className="mt-2 line-clamp-2 font-editorial text-foreground/85 text-sm">
						{log.note}
					</p>
				) : null}
			</div>
			<div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
				<MoviePoster
					listingKind={isTv ? "tv" : "movie"}
					movieId={listing.tmdbId}
					title={listing.title}
					posterUrl={posterUrl(listing.posterPath)}
					size="xs"
					className="shrink-0"
				/>
				<FeedIconAction
					href={detailHref}
					label={`Open ${isTv ? "series" : "film"}: ${listing.title}`}
				>
					{isTv ? (
						<Tv className="size-4" aria-hidden />
					) : (
						<Film className="size-4" aria-hidden />
					)}
				</FeedIconAction>
			</div>
		</article>
	);
}

function ReviewActivity({ payload }: { payload: ReviewPayload }) {
	const { review, movie } = payload;
	if (!movie) return null;
	return (
		<article
			className={cn(
				"group flex gap-3 rounded-2xl border border-border bg-surface-raised/60 p-3 transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"focus-within:border-desert-orange/40 hover:border-desert-orange/40",
			)}
		>
			<FeedPersonAvatar person={payload} />
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug">
					<Byline {...payload} suffix="reviewed" />{" "}
					<Link
						href={`/movies/${movie.tmdbId}`}
						className="font-medium font-serif text-base text-foreground hover:underline"
					>
						{movie.title}
					</Link>
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
					{review.rating ? (
						<StarRating value={review.rating} readOnly size="sm" />
					) : null}
					<span>
						· {formatDistanceToNowStrict(new Date(review.publishedAt))} ago
					</span>
					<span>· {review.likesCount} likes</span>
				</div>
				{review.title ? (
					<p className="mt-2 font-serif text-foreground text-lg">
						{review.title}
					</p>
				) : null}
				<p
					className={cn(
						"font-editorial text-foreground/85 text-sm",
						review.title ? "mt-1 line-clamp-3" : "mt-2 line-clamp-3",
					)}
				>
					{review.body}
				</p>
			</div>
			<div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
				<MoviePoster
					movieId={movie.tmdbId}
					title={movie.title}
					posterUrl={posterUrl(movie.posterPath)}
					size="xs"
					className="shrink-0"
				/>
				<FeedIconAction
					href={`/reviews/${review.id}`}
					label={`Read review${review.title ? `: ${review.title}` : ""}`}
				>
					<ArrowUpRight className="size-4" aria-hidden />
				</FeedIconAction>
			</div>
		</article>
	);
}

function ListActivity({ payload }: { payload: ListPayload }) {
	const { list } = payload;
	return (
		<article
			className={cn(
				"group flex gap-3 rounded-2xl border border-border bg-surface-raised/60 p-3 transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"focus-within:border-desert-orange/40 hover:border-desert-orange/40",
			)}
		>
			<FeedPersonAvatar person={payload} />
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug">
					<Byline {...payload} suffix="curated a list" />{" "}
					<Link
						href={`/lists/${list.id}`}
						className="font-medium font-serif text-base text-foreground hover:underline"
					>
						{list.title}
					</Link>
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					{list.itemsCount} films · updated{" "}
					{formatDistanceToNowStrict(new Date(list.updatedAt))} ago
				</p>
			</div>
			<div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
				<span
					className="inline-flex size-14 shrink-0 items-center justify-center rounded-md border border-border bg-soft-stone text-desert-orange"
					aria-hidden
				>
					<ListPlus className="size-5" />
				</span>
				<FeedIconAction
					href={`/lists/${list.id}`}
					label={`Open list: ${list.title}`}
				>
					<Star className="size-4" aria-hidden />
				</FeedIconAction>
			</div>
		</article>
	);
}
