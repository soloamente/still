import { cn } from "@still/ui/lib/utils";
import type { CSSProperties } from "react";
import { CastCrewViewAllDrawer } from "@/components/movie/cast-crew-view-all-drawer";
import type { CreditsCastMember } from "@/components/movie/credits-catalog";
import { MovieCastCrewArcRow } from "@/components/movie/movie-cast-crew-arc-cards";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import {
	type ArcCreditCard,
	CAST_CREW_ARC_EDGE_OFFSET_PX,
} from "@/lib/movie-cast-crew-arc";
import { MOVIE_DETAIL_SECTION } from "@/lib/movie-detail-sections";
import type { CrewRow } from "@/lib/movie-detail-tmdb";

export type CreditsCatalogData = {
	title: string;
	cast: CreditsCastMember[];
	crewRows: CrewRow[];
};

/**
 * Mobbin-style cast & crew spotlight: two mirrored arcs (cast up, crew down) with
 * uniform card size and vertical offset only; center “View all” opens a Vaul drawer.
 */
export function MovieCastCrewArc({
	movieId: _movieId,
	cast,
	crew,
	creditsCatalog,
}: {
	movieId: number;
	cast: ArcCreditCard[];
	crew: ArcCreditCard[];
	/** Full catalog payload for the bottom drawer (same content as the credits route). */
	creditsCatalog: CreditsCatalogData;
}) {
	if (!cast.length && !crew.length) return null;

	return (
		<MovieDetailBodySection
			id={MOVIE_DETAIL_SECTION.cast}
			title="Cast & Crew"
			className={cn(
				// Break out of the film page `max-w-7xl` column on large viewports so 11 portraits can scale up.
				"pt-2 pb-4 sm:pb-6",
				"lg:left-1/2 lg:w-[min(100vw-2rem,96rem)] lg:max-w-none lg:-translate-x-1/2",
				"xl:w-[min(100vw-3rem,108rem)]",
			)}
			contentClassName="mt-8"
		>
			<div
				className="relative flex flex-col items-center gap-2 overflow-visible sm:gap-3"
				style={
					{
						"--cast-crew-arc-edge": `${CAST_CREW_ARC_EDGE_OFFSET_PX}px`,
					} as CSSProperties
				}
			>
				{cast.length ? <MovieCastCrewArcRow cards={cast} row="cast" /> : null}

				<div className="relative z-20 -my-3 flex shrink-0 items-center justify-center sm:-my-4">
					<CastCrewViewAllDrawer
						title={creditsCatalog.title}
						cast={creditsCatalog.cast}
						crewRows={creditsCatalog.crewRows}
					/>
				</div>

				{crew.length ? <MovieCastCrewArcRow cards={crew} row="crew" /> : null}
			</div>
		</MovieDetailBodySection>
	);
}
