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

	// Lifetime ordinal on subline when the rating occupies the caption; period order when repeated in-window.
	const repeatParts: string[] = [];
	if (lifetimeOrdinal && ratingLabel) {
		repeatParts.push(lifetimeOrdinal);
	}
	if (watchCountInPeriod > 1) {
		repeatParts.push(
			leaderboardPeriodWatchOrdinalLabel(watchIndexInPeriod, period),
		);
	} else if (rewatch && !lifetimeOrdinal) {
		repeatParts.push("Rewatch");
	}

	const posterCaption =
		ratingLabel ?? lifetimeOrdinal ?? (rewatch ? "Rewatch" : null);
	const posterCaptionSubline =
		repeatParts.length > 0 ? repeatParts.join(" · ") : null;

	const watched = new Date(item.watchedAt);
	const watchedLabel = Number.isNaN(watched.getTime())
		? null
		: formatDate(watched);

	// Date only under the tile — rating, lifetime ordinal, and period count live on the poster.
	const metaLine = watchedLabel;

	return { posterCaption, posterCaptionSubline, metaLine };
}
