import { Heart, RotateCcw } from "lucide-react";

import { TicketStub } from "@/components/cinema/ticket-stub";
import { StarRating } from "@/components/rating/star-rating";
import { formatDate } from "@/lib/format";

export type DiaryLogRow = {
  log: {
    id: string;
    watchedAt: string;
    rating: number | null;
    liked: boolean;
    rewatch: boolean;
    note: string | null;
  };
  movie: {
    tmdbId: number;
    title: string;
    posterPath: string | null;
    year: number | null;
    runtime?: number | null;
    /** Extra fields from `/api/logs/me` are ignored here — we only surface diary essentials. */
    tagline?: string | null;
    overview?: string | null;
    genreIds?: number[] | null;
    tmdbJson?:
      | {
          genres?: { id: number; name: string }[];
          credits?: { crew?: { name: string; job?: string | null }[] };
        }
      | null;
  } | null;
};

/**
 * Diary row as admission ticket — `TicketStub` handles geometry; this layer binds log metadata.
 */
export function DiaryEntry({ row }: { row: DiaryLogRow }) {
  if (!row.movie) return null;

  const date = new Date(row.log.watchedAt);
  const m = row.movie;

  const watchedLine = [
    formatDate(date, { month: "short", day: "numeric", year: "numeric" }),
    m.runtime != null ? `${m.runtime} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ariaTitle = `${m.title}${m.year ? ` (${m.year})` : ""}, watched ${formatDate(date)}`;

  return (
    <TicketStub
      href={`/movies/${m.tmdbId}`}
      ariaLabel={`Open film: ${ariaTitle}`}
      posterUrl={m.posterPath}
      posterAlt=""
      stubBackground="#821c2e"
      size="default"
    >
      <h2 className="font-display text-center text-[1.25rem] leading-snug font-normal tracking-[-0.02em]">
        {m.title}
        {m.year != null ? (
          <span className="font-[family-name:var(--font-inter)] text-[0.72em] font-normal text-white/65">
            {" "}
            ({m.year})
          </span>
        ) : null}
      </h2>

      <p className="mt-1.5 text-center text-[11px] tabular-nums tracking-wide text-white/72">
        {watchedLine}
      </p>

      {row.log.rating != null || row.log.liked || row.log.rewatch ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {row.log.rating != null ? (
            <StarRating
              value={row.log.rating}
              readOnly
              size="sm"
              className="[&_svg]:text-white/30 [&_span.ml-1]:text-white/90"
            />
          ) : null}
          {row.log.liked ? (
            <Heart
              className="size-3.5 fill-[color:var(--color-desert-orange)] text-[color:var(--color-desert-orange)]"
              aria-label="Liked"
            />
          ) : null}
          {row.log.rewatch ? <RotateCcw className="size-3.5 text-white/85" aria-label="Rewatch" /> : null}
        </div>
      ) : null}

      {row.log.note ? (
        <p className="mt-2 line-clamp-3 text-center text-[11px] leading-snug text-white/70">{row.log.note}</p>
      ) : null}
    </TicketStub>
  );
}
