import type { ShowcaseItem, ShowcaseTvLogScope } from "@/lib/profile-showcase";
import { showcaseItemKey } from "@/lib/profile-showcase";
import { formatTvLogScopeLabel } from "@/lib/tv-log-scope-display";

/** Diary row shape from `GET /api/logs/me/by-movie|by-tv`. */
export type ShowcaseDiaryLogRow = {
	logScope?: ShowcaseTvLogScope | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
};

export type ShowcaseTvScopeOption = {
	item: Extract<ShowcaseItem, { kind: "tv" }>;
	label: string;
};

/** Distinct TV diary scopes a patron can pin on their showcase. */
export function distinctShowcaseTvScopeOptions(
	tvId: number,
	logs: readonly ShowcaseDiaryLogRow[],
): ShowcaseTvScopeOption[] {
	const seen = new Set<string>();
	const options: ShowcaseTvScopeOption[] = [];

	for (const row of logs) {
		const logScope = row.logScope ?? "show";
		const seasonNumber = row.seasonNumber ?? null;
		const episodeNumber = row.episodeNumber ?? null;
		const item: Extract<ShowcaseItem, { kind: "tv" }> =
			logScope === "show"
				? { kind: "tv", id: tvId, logScope: "show" }
				: logScope === "season"
					? {
							kind: "tv",
							id: tvId,
							logScope: "season",
							seasonNumber: seasonNumber ?? undefined,
						}
					: {
							kind: "tv",
							id: tvId,
							logScope: "episode",
							seasonNumber: seasonNumber ?? undefined,
							episodeNumber: episodeNumber ?? undefined,
						};
		const key = showcaseItemKey(item);
		if (seen.has(key)) continue;
		seen.add(key);
		options.push({
			item,
			label: formatTvLogScopeLabel(logScope, seasonNumber, episodeNumber),
		});
	}

	return options;
}
