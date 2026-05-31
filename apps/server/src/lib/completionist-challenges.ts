/**
 * Curated completionist challenges (Sense Tier 1) — static catalog, TMDB film ids.
 * Medium-term arcs: finish the set from your diary to earn a prestige badge.
 */

export type CompletionistChallengeKind = "director" | "studio" | "curator_set";

export interface CompletionistChallengeDefinition {
	id: string;
	slug: string;
	title: string;
	description: string;
	kind: CompletionistChallengeKind;
	/** Short label for the chip row (e.g. director name). */
	subtitle: string;
	badgeId: string;
	movieIds: readonly number[];
}

export const COMPLETIONIST_CHALLENGES: readonly CompletionistChallengeDefinition[] =
	[
		{
			id: "challenge_nolan_essentials",
			slug: "nolan-essentials",
			title: "Nolan essentials",
			description:
				"Log eight films from Christopher Nolan's core filmography — time, scale, and precision.",
			kind: "director",
			subtitle: "Christopher Nolan",
			badgeId: "prestige_challenge_nolan",
			movieIds: [77, 1124, 272, 155, 27205, 157336, 374720, 872585] as const,
		},
		{
			id: "challenge_horror_canon",
			slug: "horror-canon",
			title: "Horror canon",
			description: "Seven modern horror landmarks — dread over cheap jumps.",
			kind: "curator_set",
			subtitle: "Curated set",
			badgeId: "prestige_challenge_horror",
			movieIds: [694, 348, 1091, 419430, 493922, 310131, 530385] as const,
		},
		{
			id: "challenge_ghibli_magic",
			slug: "ghibli-magic",
			title: "Ghibli magic",
			description:
				"Six Studio Ghibli essentials — hand-drawn worlds worth revisiting.",
			kind: "studio",
			subtitle: "Studio Ghibli",
			badgeId: "prestige_challenge_ghibli",
			movieIds: [129, 8392, 4935, 12429, 16859, 15370] as const,
		},
		{
			id: "challenge_a24_highlights",
			slug: "a24-highlights",
			title: "A24 highlights",
			description:
				"Seven defining A24 titles — the taste label that became a movement.",
			kind: "studio",
			subtitle: "A24",
			badgeId: "prestige_challenge_a24",
			movieIds: [
				376867, 391713, 546554, 254320, 545611, 671986, 496243,
			] as const,
		},
	] as const;

const byId = new Map(COMPLETIONIST_CHALLENGES.map((c) => [c.id, c] as const));

export function getCompletionistChallengeById(
	id: string,
): CompletionistChallengeDefinition | undefined {
	return byId.get(id);
}

export interface ChallengeProgress {
	watched: number;
	total: number;
	percent: number;
	completed: boolean;
	remainingMovieIds: number[];
}

/** Diary intersection with a challenge's film list. */
export function computeChallengeProgress(
	movieIds: readonly number[],
	watchedMovieIds: ReadonlySet<number>,
): ChallengeProgress {
	const required = [...new Set(movieIds)];
	let watched = 0;
	const remainingMovieIds: number[] = [];
	for (const id of required) {
		if (watchedMovieIds.has(id)) watched += 1;
		else remainingMovieIds.push(id);
	}
	const total = required.length;
	const percent = total === 0 ? 0 : Math.round((watched / total) * 100);
	return {
		watched,
		total,
		percent,
		completed: total > 0 && watched >= total,
		remainingMovieIds,
	};
}

export function toChallengeListItem(
	def: CompletionistChallengeDefinition,
	watchedMovieIds: ReadonlySet<number>,
	enrollment: { enrolledAt: Date; completedAt: Date | null } | null,
) {
	const progress = computeChallengeProgress(def.movieIds, watchedMovieIds);
	return {
		id: def.id,
		slug: def.slug,
		title: def.title,
		description: def.description,
		kind: def.kind,
		subtitle: def.subtitle,
		badgeId: def.badgeId,
		enrolled: enrollment != null,
		enrolledAt: enrollment?.enrolledAt?.toISOString() ?? null,
		completedAt: enrollment?.completedAt?.toISOString() ?? null,
		progress,
	};
}
