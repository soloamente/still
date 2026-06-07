"use client";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import {
	filmographyReleaseYear,
	type PersonFilmographyRow,
} from "@/lib/person-filmography";

/** Filmography tiles — rounder than default `rounded-md` lobby posters. */
const FILMOGRAPHY_POSTER_FRAME_CLASSNAME = "rounded-2xl border-0";

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
			{rows.map((m, index) => {
				const yearLabel = filmographyReleaseYear(m.releaseDate);
				const listingKind = m.mediaKind === "tv" ? "tv" : "movie";

				return (
					<div
						key={`${m.mediaKind}-${m.tmdbId}`}
						className="min-w-0 text-center"
					>
						<CataloguePosterTile
							surface="drawer"
							listingKind={listingKind}
							tmdbId={m.tmdbId}
							title={m.title}
							posterUrl={m.posterUrl}
							priority={index < 6}
							hoverEffect="elevation"
							hoverStacking="sheet"
							frameClassName={FILMOGRAPHY_POSTER_FRAME_CLASSNAME}
							posterCaption={m.posterCaption}
						/>
						{m.posterUrl ? (
							<p className="mt-2 line-clamp-2 min-w-0 text-pretty text-center text-[0.8rem] text-muted-foreground leading-snug sm:text-sm">
								{m.title}
							</p>
						) : null}
						<p className="mt-1 line-clamp-3 text-center text-[10px] text-muted-foreground leading-snug">
							{m.roles.join(" · ")}
						</p>
						{yearLabel ? (
							<p className="mt-0.5 text-center text-[10px] text-muted-foreground/80 tabular-nums">
								{yearLabel}
							</p>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
