"use client";

import { Film } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { StarRating } from "@/components/rating/star-rating";
import { formatDate } from "@/lib/format";

/** Build a TMDb `w342` poster URL from a path fragment or full URL (same contract as `MoviePoster`). */
function tmdbPosterSrc(path: string | null): string | null {
	if (!path?.length) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w342${fragment}`;
}

/**
 * Masonry diary cell — poster-first “still” with optional rating chip.
 * Used only in diary masonry mode (Track B.5.5); list mode keeps full `DiaryEntry` tickets.
 */
export function DiaryStillTile({ row }: { row: DiaryLogRow }) {
	const m = row.movie;
	if (!m) return null;

	const watched = new Date(row.log.watchedAt);
	const watchedLabel = Number.isNaN(watched.getTime())
		? "Unknown date"
		: formatDate(watched, { month: "short", day: "numeric", year: "numeric" });

	const src = tmdbPosterSrc(m.posterPath);
	const aria = `${m.title}${m.year ? ` (${m.year})` : ""}, watched ${watchedLabel}`;

	return (
		<Link
			href={`/movies/${m.tmdbId}`}
			className="group block select-none"
			aria-label={`Open film: ${aria}`}
		>
			<div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-card shadow-sm transition-transform duration-[var(--aker-duration-fast)] ease-[var(--aker-ease)] group-hover:-translate-y-0.5 group-hover:border-desert-orange/35">
				{src ? (
					<Image
						src={src}
						alt=""
						fill
						sizes="(max-width:640px) 45vw, (max-width:1024px) 30vw, 200px"
						className="object-cover"
					/>
				) : (
					<div className="grid size-full place-items-center text-muted-foreground">
						<Film className="size-8" aria-hidden />
					</div>
				)}
				{/* Bottom scrim so half-stars stay legible on bright key art. */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pt-10" />
				{row.log.rating != null ? (
					<div className="pointer-events-none absolute right-1.5 bottom-1.5 left-1.5 flex justify-center">
						<StarRating
							value={row.log.rating}
							readOnly
							size="sm"
							className="[&_span.ml-1]:text-white/95 [&_svg]:text-white/35"
						/>
					</div>
				) : null}
			</div>
		</Link>
	);
}
