import { cn } from "@still/ui/lib/utils";
import { formatDistanceToNowStrict } from "@/lib/format";
import { Heart, ListPlus, Star } from "lucide-react";
import Link from "next/link";

import { MoviePoster } from "@/components/movie/movie-poster";
import { StarRating } from "@/components/rating/star-rating";

type ActivityKind = "log" | "review" | "list";
type Item = { kind: ActivityKind; at: string; payload: unknown };

/**
 * Single feed row. Three shapes (log/review/list) share the same anatomy:
 *   ▢ poster — user @handle did X — relative time
 *   small body or rating below.
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

function posterUrl(path: string | null | undefined, size: "w185" | "w342" = "w185") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

function Byline({ profile, user, suffix }: Person & { suffix: string }) {
  const handle = profile?.handle ?? user?.id ?? "user";
  const name = profile?.displayName ?? user?.name ?? "Someone";
  return (
    <Link href={`/profile/${handle}`} className="font-medium text-foreground hover:underline">
      {name} <span className="text-muted-foreground">{suffix}</span>
    </Link>
  );
}

function LogActivity({ payload }: { payload: LogPayload }) {
  const { log, movie } = payload;
  if (!movie) return null;
  return (
    <div className="group flex gap-4 rounded-2xl border border-border bg-card/60 p-3 transition-colors hover:border-desert-orange/40">
      <MoviePoster
        movieId={movie.tmdbId}
        title={movie.title}
        posterUrl={posterUrl(movie.posterPath)}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Byline {...payload} suffix={log.rewatch ? "rewatched" : "watched"} />{" "}
          <Link href={`/movies/${movie.tmdbId}`} className="font-serif text-base hover:underline">
            {movie.title}
          </Link>
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {log.rating ? <StarRating value={log.rating} readOnly size="sm" /> : null}
          {log.liked ? (
            <span className="inline-flex items-center gap-0.5 text-desert-orange">
              <Heart className="size-3 fill-current" /> liked
            </span>
          ) : null}
          <span>· {formatDistanceToNowStrict(new Date(log.watchedAt))} ago</span>
        </div>
        {log.note ? (
          <p className="mt-2 line-clamp-2 font-editorial text-sm text-foreground/85">{log.note}</p>
        ) : null}
      </div>
    </div>
  );
}

function ReviewActivity({ payload }: { payload: ReviewPayload }) {
  const { review, movie } = payload;
  if (!movie) return null;
  return (
    <Link
      href={`/reviews/${review.id}`}
      className={cn(
        "group flex gap-4 rounded-2xl border border-border bg-card/60 p-3 transition-colors",
        "hover:border-desert-orange/40",
      )}
    >
      <MoviePoster
        movieId={movie.tmdbId}
        title={movie.title}
        posterUrl={posterUrl(movie.posterPath)}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Byline {...payload} suffix="reviewed" />{" "}
          <span className="font-serif text-base">{movie.title}</span>
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {review.rating ? <StarRating value={review.rating} readOnly size="sm" /> : null}
          <span>· {formatDistanceToNowStrict(new Date(review.publishedAt))} ago</span>
          <span>· {review.likesCount} likes</span>
        </div>
        {review.title ? <p className="mt-2 font-serif text-lg">{review.title}</p> : null}
        <p className="mt-1 line-clamp-3 font-editorial text-sm text-foreground/85">{review.body}</p>
      </div>
    </Link>
  );
}

function ListActivity({ payload }: { payload: ListPayload }) {
  const { list } = payload;
  return (
    <Link
      href={`/lists/${list.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-3 transition-colors hover:border-desert-orange/40"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-md bg-soft-stone text-desert-orange">
        <ListPlus className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Byline {...payload} suffix="curated a list" />{" "}
          <span className="font-serif text-base">{list.title}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {list.itemsCount} films · updated{" "}
          {formatDistanceToNowStrict(new Date(list.updatedAt))} ago
        </p>
      </div>
      <Star className="size-4 text-muted-foreground opacity-60 group-hover:text-desert-orange" />
    </Link>
  );
}
