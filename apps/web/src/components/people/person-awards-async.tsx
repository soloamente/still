import { PersonAwardsSection } from "@/components/people/person-awards-section";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
import { buildPersonAwardRows } from "@/lib/person-awards";
import { fetchWikidataPersonAwards } from "@/lib/wikidata-person-awards";

/** Stream Wikidata awards on About (above stills when present) without blocking the shell. */
export async function PersonAwardsAsync({
	tmdbPersonId,
	imdbId,
	personName,
	/** When true, parent already provides `MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME`. */
	embedInColumn = false,
}: {
	tmdbPersonId: number;
	imdbId: string | null;
	personName: string;
	embedInColumn?: boolean;
}) {
	const raw = await fetchWikidataPersonAwards({
		tmdbPersonId,
		imdbId,
	});
	const rows = buildPersonAwardRows(raw);
	if (rows.length === 0) return null;

	const section = <PersonAwardsSection personName={personName} rows={rows} />;
	// Awards-only About: own column. With stills: page owns the shared column.
	if (embedInColumn) return section;
	return <div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>{section}</div>;
}
