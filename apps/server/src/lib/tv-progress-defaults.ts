import type { TvProgressMode } from "@still/db";

/** Inputs for defaulting season vs episode progress mode on “Start watching”. */
export interface TvProgressDefaultInput {
	genreIds: number[];
	numberOfSeasons: number | null;
	inProduction: boolean | null;
}

/**
 * Heuristic defaults — Animation (16) and long in-production series skew episode-first;
 * shorter limited runs default to season milestones.
 */
export function defaultProgressModeForTv(
	detail: TvProgressDefaultInput,
): TvProgressMode {
	if (detail.genreIds.includes(16)) return "episode";
	if (detail.inProduction && (detail.numberOfSeasons ?? 0) >= 3) {
		return "episode";
	}
	return "season";
}
