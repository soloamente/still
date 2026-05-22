import type { TvWatchNextEpisode } from "@/lib/tv-watch-types";

/** Human label for hero continue line and mark-next CTA. */
export function formatTvNextEpisodeLabel(next: TvWatchNextEpisode | null) {
	if (!next) return null;
	const code = `S${String(next.seasonNumber).padStart(2, "0")}E${String(next.episodeNumber).padStart(2, "0")}`;
	if (next.episodeName?.trim()) {
		return `Next: ${code} · ${next.episodeName.trim()}`;
	}
	return `Next: ${code}`;
}
