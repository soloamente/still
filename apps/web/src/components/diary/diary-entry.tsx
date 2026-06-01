import { Heart, RotateCcw } from "lucide-react";
import Link from "next/link";

import { TicketStub } from "@/components/cinema/ticket-stub";
import { DiaryLogEditButton } from "@/components/diary/diary-log-edit-button";
import { TvLogScopeChip } from "@/components/diary/tv-log-scope-chip";
import { StarRating } from "@/components/rating/star-rating";
import { formatDate } from "@/lib/format";
import type { HomeVenue } from "@/lib/home-venue";
import type { TvLogScope } from "@/lib/tv-watch-types";

/** Shared poster/title fields for diary rows — either a film or a series. */
export type DiaryListingSnapshot = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
	runtime?: number | null;
};

export type DiaryLogRow = {
	log: {
		id: string;
		watchedAt: string;
		rating: number | null;
		liked: boolean;
		rewatch: boolean;
		note: string | null;
		/** In-cinema vs at-home — matches `/diary?venue=`; absent rows default to **streaming**. */
		watchVenue?: HomeVenue;
		logScope?: TvLogScope;
		seasonNumber?: number | null;
		episodeNumber?: number | null;
		visibility?: "public" | "followers" | "friends" | "private";
	};
	movie: DiaryListingSnapshot | null;
	/** Present when this diary row is for a TV series (`log.tv_id` on the server). */
	tv: DiaryListingSnapshot | null;
};

/**
 * Diary row as admission ticket — `TicketStub` handles geometry; this layer binds log metadata.
 */
export function DiaryEntry({ row }: { row: DiaryLogRow }) {
	const listing = row.movie ?? row.tv;
	if (!listing) return null;

	const date = new Date(row.log.watchedAt);
	const isTv = row.tv != null && row.movie == null;
	const detailHref = isTv
		? `/tv/${listing.tmdbId}`
		: `/movies/${listing.tmdbId}`;

	const watchedLine = [
		formatDate(date, { month: "short", day: "numeric", year: "numeric" }),
		!isTv && listing.runtime != null ? `${listing.runtime} min` : null,
	]
		.filter(Boolean)
		.join(" · ");

	const ariaTitle = `${listing.title}${listing.year ? ` (${listing.year})` : ""}, watched ${formatDate(date)}`;

	return (
		<TicketStub
			posterUrl={listing.posterPath}
			posterAlt=""
			stubBackground="#821c2e"
			size="default"
		>
			<h2 className="text-center font-display font-normal text-[1.25rem] leading-snug tracking-[-0.02em]">
				<Link
					href={detailHref}
					aria-label={`Open ${isTv ? "series" : "film"}: ${ariaTitle}`}
					className="rounded-sm text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
				>
					{listing.title}
					{listing.year != null ? (
						<span className="font-[family-name:var(--font-inter)] font-normal text-[0.72em] text-white/65">
							{" "}
							({listing.year})
						</span>
					) : null}
				</Link>
			</h2>

			<p className="mt-1.5 text-center text-[11px] text-white/72 tabular-nums tracking-wide">
				{watchedLine}
			</p>

			{isTv ? (
				<div className="mt-2 flex justify-center">
					<TvLogScopeChip
						logScope={row.log.logScope}
						seasonNumber={row.log.seasonNumber}
						episodeNumber={row.log.episodeNumber}
					/>
				</div>
			) : null}

			{row.log.rating != null || row.log.liked || row.log.rewatch ? (
				<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
					{row.log.rating != null ? (
						<StarRating
							value={row.log.rating}
							readOnly
							size="sm"
							className="[&_span.ml-1]:text-white/90 [&_svg]:text-white/30"
						/>
					) : null}
					{row.log.liked ? (
						<Heart
							className="size-3.5 fill-[color:var(--color-desert-orange)] text-[color:var(--color-desert-orange)]"
							aria-label="Liked"
						/>
					) : null}
					{row.log.rewatch ? (
						<RotateCcw
							className="size-3.5 text-white/85"
							aria-label="Rewatch"
						/>
					) : null}
				</div>
			) : null}

			{row.log.note ? (
				<p className="mt-2 line-clamp-3 text-center text-[11px] text-white/70 leading-snug">
					{row.log.note}
				</p>
			) : null}

			<DiaryLogEditButton row={row} />
		</TicketStub>
	);
}
