"use client";

import { MoviePoster } from "@/components/movie/movie-poster";
import {
	filmographyReleaseYear,
	type PersonFilmographyRow,
} from "@/lib/person-filmography";

/** Poster grid of a person’s TMDb film + TV credits (drawer or route). */
export function PersonFilmographyGrid({
	rows,
}: {
	rows: PersonFilmographyRow[];
}) {
	if (!rows.length) {
		return (
			<p
				className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				No film or TV credits loaded yet.
			</p>
		);
	}

	return (
		<div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
			{rows.map((m) => {
				const yearLabel = filmographyReleaseYear(m.releaseDate);
				return (
					<div key={`${m.mediaKind}-${m.tmdbId}`} className="min-w-0">
						<MoviePoster
							movieId={m.tmdbId}
							title={m.title}
							posterUrl={m.posterUrl}
							listingKind={m.mediaKind === "tv" ? "tv" : "movie"}
							showTitle
							hoverEffect="elevation"
						/>
						<p className="mt-1 line-clamp-3 text-[10px] text-muted-foreground leading-snug">
							{m.roles.join(" · ")}
						</p>
						{yearLabel ? (
							<p className="mt-0.5 text-[10px] text-muted-foreground/80 tabular-nums">
								{yearLabel}
							</p>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
