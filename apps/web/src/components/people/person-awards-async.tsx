import { PersonAwardsSection } from "@/components/people/person-awards-section";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
import { buildPersonAwardRows } from "@/lib/person-awards";
import { fetchWikidataPersonAwards } from "@/lib/wikidata-person-awards";

/** Stream Wikidata awards under About stills without blocking the person shell. */
export async function PersonAwardsAsync({
	tmdbPersonId,
	imdbId,
	personName,
}: {
	tmdbPersonId: number;
	imdbId: string | null;
	personName: string;
}) {
	const raw = await fetchWikidataPersonAwards({
		tmdbPersonId,
		imdbId,
	});
	const rows = buildPersonAwardRows(raw);
	if (rows.length === 0) return null;
	return (
		<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
			<PersonAwardsSection personName={personName} rows={rows} />
		</div>
	);
}
