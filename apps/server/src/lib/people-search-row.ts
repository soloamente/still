import type { TmdbPersonSummary } from "./tmdb";
import { tmdbImg } from "./tmdb";

/** Slim person row returned by `GET /api/people/search` — drives the dialog "Cast & Crew" section. */
export type PeopleSearchRow = {
	id: number;
	name: string;
	profileUrl: string | null;
	knownForDepartment: string | null;
	knownForTitles: string[];
};

/** TMDb `/search/person` row → slim search row. Picks up to 3 known-for titles (movie `title` or TV `name`). */
export function mapTmdbPersonToSearchRow(
	person: TmdbPersonSummary,
): PeopleSearchRow {
	const knownForTitles = (person.known_for ?? [])
		.map((entry) => entry.title ?? entry.name ?? "")
		.filter((t): t is string => t.length > 0)
		.slice(0, 3);
	return {
		id: person.id,
		name: person.name,
		profileUrl: tmdbImg.profile(person.profile_path, "w185"),
		knownForDepartment: person.known_for_department ?? null,
		knownForTitles,
	};
}
