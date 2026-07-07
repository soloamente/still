import { FestivalRecognitionGrid } from "@/components/movie/festival-recognition-grid";
import { MovieAwardsViewAllDrawer } from "@/components/movie/movie-awards-view-all-drawer";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MOVIE_DETAIL_SECTION } from "@/lib/movie-detail-sections";
import {
	type FestivalRecognitionEntry,
	MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
} from "@/lib/movie-festival-recognition";

/**
 * Awards & festivals — MUBI-style row: icon, festival name, year then achievement on separate lines.
 */
export function MoviePremieresFestivals({
	entries,
	listingTitle,
}: {
	entries: FestivalRecognitionEntry[];
	listingTitle: string;
}) {
	if (!entries.length) return null;

	const displayEntries = entries.slice(
		0,
		MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
	);
	const hasMoreAwards = entries.length > MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX;

	return (
		<MovieDetailBodySection
			id={MOVIE_DETAIL_SECTION.awards}
			title="Awards & festivals"
			className="pt-2 pb-2 sm:pt-4"
		>
			<div className="relative px-3 pt-1 pb-2 sm:px-5">
				<FestivalRecognitionGrid entries={displayEntries} />
				{hasMoreAwards ? (
					<div className="mt-10 flex justify-center">
						<MovieAwardsViewAllDrawer
							listingTitle={listingTitle}
							entries={entries}
						/>
					</div>
				) : null}
			</div>
		</MovieDetailBodySection>
	);
}
