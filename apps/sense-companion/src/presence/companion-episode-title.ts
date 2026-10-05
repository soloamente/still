import type { CompanionActivityPayload } from "./activity-log";

/**
 * Episode name for the profile row — same sources Discord uses when the
 * show title lives on `details` and the episode name is elsewhere.
 */
export function inferCompanionEpisodeTitle(
	showTitle: string,
	activity: CompanionActivityPayload,
): string | null {
	const title = showTitle.trim();
	const details = activity.details?.trim() ?? "";
	const state = activity.state?.trim() ?? "";
	if (details && details !== title) return details;
	if (!state || state === title) return null;
	// Netflix often sends "S4 E1 Chapter One" on state.
	const fromMark = state.match(/^S\d+\s+E\d+\s*[-–—]\s*(.+)$/i);
	if (fromMark?.[1]?.trim()) return fromMark[1].trim();
	if (!/^S\d+\s+E\d+$/i.test(state)) return state;
	return null;
}

/** Pull the episode name off a Discord-style state line (S4 E1 - Chapter One). */
export function parseEpisodeTitleFromStateLine(
	state: string,
	showTitle: string,
): string | null {
	const trimmed = state.trim();
	if (!trimmed || trimmed === showTitle.trim() || /^on\s+/i.test(trimmed)) {
		return null;
	}
	const fromMark = trimmed.match(/^S\d+\s+E\d+\s*[-–—]\s*(.+)$/i);
	if (fromMark?.[1]?.trim()) return fromMark[1].trim();
	if (!/^S\d+\s+E\d+$/i.test(trimmed)) return trimmed;
	return null;
}

/** Attach episode title when the player reports season/episode metadata. */
export function withCompanionEpisodeTitle(
	media: {
		kind: "movie" | "episode";
		title: string;
		episodeTitle?: string;
	},
	activity: CompanionActivityPayload,
): { episodeTitle?: string } {
	if (media.kind !== "episode") return {};
	if (typeof media.episodeTitle === "string" && media.episodeTitle.trim()) {
		return { episodeTitle: media.episodeTitle.trim().slice(0, 300) };
	}
	const inferred = inferCompanionEpisodeTitle(media.title, activity);
	return inferred ? { episodeTitle: inferred.slice(0, 300) } : {};
}
