import { formatDate } from "@/lib/format";
import type { LeaderboardLogItem } from "@/lib/home-leaderboard-types";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

function ordinalWatchLabel(index: number): string {
	if (index === 1) return "1st watch";
	if (index === 2) return "2nd watch";
	if (index === 3) return "3rd watch";
	return `${index}th watch`;
}

/** Poster scrim + meta line for one ledger tile — surfaces rewatch and repeat counts. */
export function patronWatchLedgerPosterLabels(
	item: LeaderboardLogItem & {
		rewatch?: boolean;
		watchIndexInPeriod?: number;
		watchCountInPeriod?: number;
	},
): {
	posterCaption: string | null;
	posterCaptionSubline: string | null;
	metaLine: string | null;
} {
	const rewatch = item.rewatch ?? false;
	const watchIndexInPeriod = item.watchIndexInPeriod ?? 1;
	const watchCountInPeriod = item.watchCountInPeriod ?? 1;

	const ratingLabel =
		item.rating != null ? formatStoredLogRatingDisplay(item.rating) : null;

	const repeatParts: string[] = [];
	if (watchCountInPeriod > 1) {
		repeatParts.push(ordinalWatchLabel(watchIndexInPeriod));
		repeatParts.push(`${watchCountInPeriod}× in period`);
	} else if (rewatch) {
		repeatParts.push("Rewatch");
	}

	const posterCaption = ratingLabel ?? (rewatch ? "Rewatch" : null);
	const posterCaptionSubline =
		repeatParts.length > 0 ? repeatParts.join(" · ") : null;

	const watched = new Date(item.watchedAt);
	const watchedLabel = Number.isNaN(watched.getTime())
		? null
		: formatDate(watched);

	const metaParts = [watchedLabel, ratingLabel].filter(Boolean);
	if (rewatch) metaParts.push("Rewatch");
	if (watchCountInPeriod > 1) {
		metaParts.push(
			`${ordinalWatchLabel(watchIndexInPeriod)} of ${watchCountInPeriod}`,
		);
	}

	const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : null;

	return { posterCaption, posterCaptionSubline, metaLine };
}
