import { formatDate } from "@/lib/format";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { leaderboardPeriodWatchOrdinalLabel } from "@/lib/home-leaderboard-period";
import type { LeaderboardLogItem } from "@/lib/home-leaderboard-types";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

function ordinalWatchLabel(index: number): string {
	if (index === 1) return "1st watch";
	if (index === 2) return "2nd watch";
	if (index === 3) return "3rd watch";
	return `${index}th watch`;
}

/**
 * Distinguish same-series posters on TV/Episodes ledgers — whole series vs season vs episode.
 * When `episodeWeight` is set (Episodes ranks), append the episode-equivalent count.
 */
export function tvDiaryScopeCaption(
	item: Pick<
		LeaderboardLogItem,
		| "tvId"
		| "movieId"
		| "logScope"
		| "seasonNumber"
		| "episodeNumber"
		| "episodeWeight"
	>,
): string | null {
	if (item.tvId == null || item.movieId != null) return null;

	const weight = item.episodeWeight;
	const epSuffix =
		weight != null && weight >= 1
			? weight === 1
				? "1 episode"
				: `${weight} episodes`
			: null;

	const scope = item.logScope ?? null;
	if (scope === "season") {
		const season =
			item.seasonNumber != null ? `Season ${item.seasonNumber}` : "Season";
		return epSuffix ? `${season} · ${epSuffix}` : season;
	}
	if (scope === "show") {
		const label = "Whole series";
		return epSuffix ? `${label} · ${epSuffix}` : label;
	}
	if (scope === "episode") {
		const s = item.seasonNumber;
		const e = item.episodeNumber;
		let base: string;
		if (s != null && e != null) base = `S${s}E${e}`;
		else if (s != null) base = `Season ${s} · Episode`;
		else base = "Episode";
		return epSuffix ? `${base} · ${epSuffix}` : base;
	}
	return null;
}

/** Poster scrim + meta line for one ledger tile — lifetime rewatch ordinals + period repeats. */
export function patronWatchLedgerPosterLabels(
	item: LeaderboardLogItem & {
		rewatch?: boolean;
		watchIndexInPeriod?: number;
		watchCountInPeriod?: number;
		watchIndexLifetime?: number;
		watchCountLifetime?: number;
	},
	period: HomeLeaderboardPeriod = "month",
): {
	posterCaption: string | null;
	posterCaptionSubline: string | null;
	metaLine: string | null;
} {
	const rewatch = item.rewatch ?? false;
	const watchIndexInPeriod = item.watchIndexInPeriod ?? 1;
	const watchCountInPeriod = item.watchCountInPeriod ?? 1;
	const watchIndexLifetime = item.watchIndexLifetime ?? 1;

	const ratingLabel =
		item.rating != null ? formatStoredLogRatingDisplay(item.rating) : null;

	const lifetimeOrdinal =
		watchIndexLifetime > 1 ? ordinalWatchLabel(watchIndexLifetime) : null;

	// Always label TV diary scope so duplicate series posters stay distinguishable.
	const scopeCaption = tvDiaryScopeCaption(item);

	// Lifetime ordinal on subline when the rating occupies the caption; period order when repeated in-window.
	const repeatParts: string[] = [];
	if (lifetimeOrdinal && (ratingLabel || scopeCaption)) {
		repeatParts.push(lifetimeOrdinal);
	}
	if (watchCountInPeriod > 1) {
		repeatParts.push(
			leaderboardPeriodWatchOrdinalLabel(watchIndexInPeriod, period),
		);
	} else if (rewatch && !lifetimeOrdinal && !scopeCaption) {
		repeatParts.push("Rewatch");
	}

	const posterCaption =
		ratingLabel ??
		scopeCaption ??
		lifetimeOrdinal ??
		(rewatch ? "Rewatch" : null);
	const posterCaptionSublineParts = [...repeatParts];
	if (scopeCaption && ratingLabel) {
		posterCaptionSublineParts.unshift(scopeCaption);
	}
	const posterCaptionSubline =
		posterCaptionSublineParts.length > 0
			? posterCaptionSublineParts.join(" · ")
			: null;

	const watched = new Date(item.watchedAt);
	const watchedLabel = Number.isNaN(watched.getTime())
		? null
		: formatDate(watched);

	// Date only under the tile — rating, scope, and period count live on the poster.
	const metaLine = watchedLabel;

	return { posterCaption, posterCaptionSubline, metaLine };
}
