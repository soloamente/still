/** Person row from `GET /api/people/search` — mirrors the server `PeopleSearchRow`. */
export interface CastCrewSearchHit {
	id: number;
	name: string;
	profileUrl: string | null;
	knownForDepartment: string | null;
	knownForTitles: string[];
}

/** Secondary line for a cast/crew row, e.g. "Director · Inception, Oppenheimer". */
export function castCrewMetaLine(hit: CastCrewSearchHit): string {
	const parts: string[] = [];
	if (hit.knownForDepartment) parts.push(hit.knownForDepartment);
	if (hit.knownForTitles.length > 0) parts.push(hit.knownForTitles.join(", "));
	return parts.join(" · ");
}
