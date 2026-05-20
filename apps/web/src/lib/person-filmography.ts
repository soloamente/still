/** One film or series credit row from `GET /api/people/:id`. */
export type PersonFilmographyRow = {
	tmdbId: number;
	mediaKind: "movie" | "tv";
	title: string;
	posterUrl: string | null;
	releaseDate: string | null;
	roles: string[];
};

export type PersonFilmographyPayload = {
	code?: "TMDB_UNCONFIGURED";
	hint?: string;
	person: {
		id: number;
		name: string;
		knownForDepartment?: string;
		profilePath: string | null;
		profileUrl: string | null;
	} | null;
	filmography: PersonFilmographyRow[];
};

/** Seed shown instantly while TMDb filmography loads in a drawer. */
export type PersonFilmographySeed = {
	personId: number;
	name: string;
	profilePath: string | null;
	/** Role on the title the user tapped from (character or crew job). */
	roleHint?: string;
};

/**
 * Filmography rows use `releaseDate` for sorting and display; treat strings and
 * revived `Date` instances the same so `.slice` never runs on non-strings.
 */
export function filmographyReleaseYear(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		const s = raw.trim();
		return s.length >= 4 ? s.slice(0, 4) : s || null;
	}
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		return String(raw.getFullYear());
	}
	return null;
}
