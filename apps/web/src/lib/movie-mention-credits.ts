import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

/** One cast/crew row for the `@` mention picker title context rail. */
export type MentionCreditRow = {
	id: number;
	name: string;
	profileUrl: string | null;
	role: string;
};

const CREDIT_CAP = 12;

type MovieCreditsJson = {
	credits?: {
		cast?: Array<{
			id: number;
			name: string;
			profile_path: string | null;
			order?: number;
		}>;
		crew?: Array<{
			id: number;
			name: string;
			job?: string | null;
			profile_path: string | null;
		}>;
	};
};

/** Pull cast + key crew from cached movie `tmdbJson` for title-first `@` search. */
export function extractMovieMentionCredits(
	tmdbJson: MovieCreditsJson | null | undefined,
): MentionCreditRow[] {
	const cast = (tmdbJson?.credits?.cast ?? [])
		.slice()
		.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
		.map((member) => ({
			id: member.id,
			name: member.name,
			profileUrl: tmdbPosterUrlFromPath(member.profile_path, "w185"),
			role: "Cast",
		}));
	const crew = (tmdbJson?.credits?.crew ?? [])
		.filter(
			(member) => member.job === "Director" || member.job === "Screenplay",
		)
		.map((member) => ({
			id: member.id,
			name: member.name,
			profileUrl: tmdbPosterUrlFromPath(member.profile_path, "w185"),
			role: member.job ?? "Crew",
		}));

	const byId = new Map<number, MentionCreditRow>();
	for (const row of [...cast, ...crew]) {
		if (!byId.has(row.id)) byId.set(row.id, row);
	}
	return Array.from(byId.values()).slice(0, CREDIT_CAP);
}

/** Case-insensitive substring filter for the contextual credits rail. */
export function filterMentionCreditsByQuery(
	rows: MentionCreditRow[],
	query: string,
): MentionCreditRow[] {
	const q = query.trim().toLowerCase();
	if (!q) return rows;
	return rows.filter((row) => row.name.toLowerCase().includes(q));
}
