import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

/** Bottom-scrim label for catalogue tiles from a patron diary row (profile + lists). */
export function patronLogPosterCaption(args: {
	rating: number | null | undefined;
	liked?: boolean | null;
}): string | null {
	const score = formatStoredLogRatingDisplay(args.rating);
	if (score) return score;
	if (args.liked) return "Favorite";
	return null;
}

/** Ranked lists: score on scrim when logged; rank as subline so both stay visible. */
export function rankedListPosterLabels(
	index: number,
	ownerLog?: { rating: number | null; liked: boolean } | null,
): { posterCaption: string; posterCaptionSubline?: string } {
	const rankLabel = String(index + 1);
	const score = patronLogPosterCaption({
		rating: ownerLog?.rating,
		liked: ownerLog?.liked,
	});
	if (score) {
		return { posterCaption: score, posterCaptionSubline: rankLabel };
	}
	return { posterCaption: rankLabel };
}
