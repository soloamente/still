import type { TvWatchStatus } from "@still/db";

/** When every catalogue episode is checked off, promote to finished (keep abandoned). */
export function statusWhenCatalogComplete(
	current: TvWatchStatus,
): TvWatchStatus {
	if (current === "abandoned") return current;
	return "finished";
}

/** Unchecking an episode while the series was finished returns to active watching. */
export function statusWhenEpisodesRemain(
	current: TvWatchStatus,
): TvWatchStatus {
	if (current === "finished") return "watching";
	return current;
}
