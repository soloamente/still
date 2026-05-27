import type { TvLogScope } from "@/lib/tv-watch-types";

/** Chip text for diary tickets and poster overlays — `null` for whole-show logs. */
export function formatTvLogScopeChip(
	scope: TvLogScope | null | undefined,
	seasonNumber: number | null | undefined,
	episodeNumber: number | null | undefined,
): string | null {
	const s = scope ?? "show";
	if (s === "show") return null;
	if (s === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	if (s === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
	}
	return null;
}

/** Always returns a label — whole-show logs read as **Whole series** on diary tiles. */
export function formatTvLogScopeLabel(
	scope: TvLogScope | null | undefined,
	seasonNumber: number | null | undefined,
	episodeNumber: number | null | undefined,
): string {
	return (
		formatTvLogScopeChip(scope, seasonNumber, episodeNumber) ?? "Whole series"
	);
}

/** @deprecated Use `quickLogSubmitLabel` from `@/lib/quick-log-copy` */
export function quickLogTvSubmitLabel(
	scope: TvLogScope | null | undefined,
): string {
	const s = scope ?? "show";
	if (s === "episode") return "Add episode";
	if (s === "season") return "Add season";
	return "Add show";
}
