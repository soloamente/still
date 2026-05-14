import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CreditsCrawl, type CreditsCrawlLine } from "@/components/cinema/credits-crawl";
import { MoviePoster } from "@/components/movie/movie-poster";
import { CommentsThread } from "@/components/social/comments-thread";
import { ReactionsBar } from "@/components/social/reactions-bar";
import { Section } from "@/components/ui/section";
import { StarRating } from "@/components/rating/star-rating";
import { formatDistanceToNowStrict } from "@/lib/format";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type ReviewDetail = {
  review: {
    id: string;
    userId: string;
    movieId: number;
    title: string | null;
    body: string;
    rating: number | null;
    likesCount: number;
    commentsCount: number;
    containsSpoilers: boolean;
    publishedAt: string;
  };
  movie: { tmdbId: number; title: string; posterPath: string | null; year: number | null } | null;
  liked: boolean;
  authorProfile: { displayName: string; handle: string | null } | null;
  likedByProfiles: { displayName: string; handle: string | null }[];
};

/** Canonical length gate so short blurbs aren’t drowned in ceremonial chrome. */
const LONG_REVIEW_CREDITS_THRESHOLD = 480;

type CommentRow = {
  comment: {
    id: string;
    userId: string;
    body: string;
    createdAt: string;
    replyToId: string | null;
  };
  user: { name: string; image: string | null } | null;
  profile: { handle: string; displayName: string } | null;
};

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const res = await api.api.reviews({ id }).get();
  const detail = res.data as ReviewDetail | null;
  if (!detail) notFound();
  const commentsRes = await api.api
    .comments.of({ parentType: "review" })({ parentId: id })
    .get()
    .catch(() => ({ data: [] }));
  const comments = (commentsRes.data as unknown as CommentRow[]) ?? [];

  const writtenByHandle = detail.authorProfile?.handle?.trim();
  const writtenByDisplay = detail.authorProfile?.displayName?.trim();
  const writtenLine =
    (writtenByHandle?.length ?? 0) > 0
      ? `@${writtenByHandle}`
      : (writtenByDisplay?.length ?? 0) > 0
        ? writtenByDisplay ?? "Still patron"
        : "Still patron";

  const readerLabels = (() => {
    const ids = new Set<string>();
    const names: string[] = [];
    for (const row of comments) {
      if (ids.has(row.comment.userId)) continue;
      ids.add(row.comment.userId);
      const h = row.profile?.handle?.trim();
      names.push(h?.length ? `@${h}` : row.profile?.displayName ?? row.user?.name ?? "Member");
    }
    return names;
  })();

  const likerStrings = (detail.likedByProfiles ?? []).map((p) => {
    const h = p.handle?.trim();
    const d = (p.displayName ?? "").trim();
    return h?.length ? `@${h}` : d.length > 0 ? d : "Member";
  });
  const applausePeople = [...likerStrings];
  const hiddenLikeCount =
    Number(detail.review.likesCount ?? 0) - Number(applausePeople.length);
  if (hiddenLikeCount > 0) {
    applausePeople.push(
      applausePeople.length
        ? `+ ${hiddenLikeCount} additional reader${hiddenLikeCount === 1 ? "" : "s"} tapped like`
        : `${hiddenLikeCount} reader${hiddenLikeCount === 1 ? "" : "s"} showed love`,
    );
  }

  const wrapCredits: CreditsCrawlLine[] = [
    { role: "Written by", people: [writtenLine] },
    readerLabels.length ? { role: "Read by", people: readerLabels } : null,
    applausePeople.length ? { role: "Applauded by", people: applausePeople } : null,
  ].filter((n): n is CreditsCrawlLine => Boolean(n));
  const showClosingCrawl =
    detail.review.body.trim().length >= LONG_REVIEW_CREDITS_THRESHOLD &&
    wrapCredits.length > 0;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Review</p>
        {detail.review.title ? (
          <h1 className="font-display text-4xl font-medium tracking-[-0.02em]">
            {detail.review.title}
          </h1>
        ) : null}
        <p className="text-sm">
          on{" "}
          {detail.movie ? (
            <Link href={`/movies/${detail.movie.tmdbId}`} className="hover:underline">
              <span className="font-serif">{detail.movie.title}</span>
              {detail.movie.year ? ` (${detail.movie.year})` : ""}
            </Link>
          ) : null}{" "}
          · {formatDistanceToNowStrict(new Date(detail.review.publishedAt))} ago
        </p>
        {detail.review.rating ? <StarRating value={detail.review.rating} readOnly size="lg" /> : null}
      </header>
      <div className="grid grid-cols-[1fr] items-start gap-6 md:grid-cols-[1fr_auto]">
        <div className="font-editorial whitespace-pre-wrap text-lg leading-relaxed text-foreground/90">
          {detail.review.containsSpoilers ? (
            <p className="mb-3 rounded-md border border-desert-orange/30 bg-desert-orange/5 px-3 py-2 text-sm">
              Contains spoilers.
            </p>
          ) : null}
          {detail.review.body}
        </div>
        {detail.movie ? (
          <MoviePoster
            className="w-full shrink-0 md:w-[13rem]"
            movieId={detail.movie.tmdbId}
            title={detail.movie.title}
            posterUrl={
              detail.movie.posterPath
                ? `https://image.tmdb.org/t/p/w342${detail.movie.posterPath}`
                : null
            }
            size="md"
          />
        ) : null}
      </div>
      <div className="flex items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        <ReactionsBar
          targetKind="review"
          targetId={detail.review.id}
          initialLikes={detail.review.likesCount}
          initialLiked={detail.liked}
        />
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-3.5" /> {detail.review.commentsCount}
        </span>
      </div>
      <Section title="Comments">
        <CommentsThread targetKind="review" targetId={detail.review.id} initialComments={comments} />
      </Section>

      {showClosingCrawl ? (
        <footer className="space-y-4 border-t border-border/70 pt-10">
          <p className="text-center font-display text-xs font-medium uppercase tracking-[0.5em] text-muted-foreground">
            And that’s a wrap
          </p>
          <CreditsCrawl lines={wrapCredits} durationSec={140} />
        </footer>
      ) : null}
    </article>
  );
}
