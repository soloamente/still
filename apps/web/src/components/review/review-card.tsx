import { formatDistanceToNowStrict } from "@/lib/format";
import { Heart, MessageCircle } from "lucide-react";
import Link from "next/link";

import { StarRating } from "@/components/rating/star-rating";

type Review = {
  id: string;
  userId: string;
  movieId: number;
  title: string | null;
  body: string;
  rating: number | null;
  likesCount: number;
  commentsCount: number;
  publishedAt: string;
};

/**
 * Public review preview card. Body is clamped — clicking opens the
 * dedicated review page where comments live.
 */
export function ReviewCard({ review }: { review: Review }) {
  return (
    <Link
      href={`/reviews/${review.id}`}
      className="group block rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-desert-orange/40"
    >
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDistanceToNowStrict(new Date(review.publishedAt))} ago</span>
        {review.rating ? <StarRating value={review.rating} readOnly size="sm" /> : null}
      </header>
      {review.title ? <h3 className="mt-2 font-serif text-lg">{review.title}</h3> : null}
      <p className="font-editorial mt-2 line-clamp-4 text-sm text-foreground/85">{review.body}</p>
      <footer className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3" /> {review.likesCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-3" /> {review.commentsCount}
        </span>
      </footer>
    </Link>
  );
}
